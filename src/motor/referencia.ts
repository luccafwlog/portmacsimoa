import type { CalendarioOgmo } from '../calendario/portas.js';
import type { CatalogoOgmo } from '../catalogo/portas.js';
import type { FainaCatalogada, InicioDaOperacao } from '../dominio/tipos.js';
import { dataDeReferenciaNeutra } from '../calendario/referencia.js';
import { gerarGradeDeProdutividades } from './otimizador.js';
import { simular } from './simulador.js';

export interface PontoDeReferencia {
  readonly produtividade: number;
  readonly periodos: number;
  readonly custoPorUnidade: number;
}

/**
 * O que a curva da faina diz, e não apenas onde ela tem o menor valor.
 *
 * - `CONSTANTE`: a produtividade muda a duração, não o preço por unidade.
 * - `CALENDARIO`: o custo varia, mas o mais barato não está no extremo rápido
 *   da faixa — o que oscila é onde a operação cai na semana, não a
 *   produtividade. Chamar isso de "ótimo da faina" seria descrever o relógio.
 * - `DECRESCENTE`: quanto mais rápido, mais barato — sem ponto de virada.
 * - `JOELHO`: existe uma produtividade a partir da qual o custo unitário para
 *   de cair. É a forma que uma produção mínima garantida produz.
 */
export type FormaDaCurva = 'CONSTANTE' | 'CALENDARIO' | 'DECRESCENTE' | 'JOELHO';

export interface ReferenciaDaFaina {
  readonly inicio: InicioDaOperacao;
  readonly volumeDeReferencia: number;
  readonly ternosDeReferencia: number;
  readonly pontos: readonly PontoDeReferencia[];
  readonly maisBarato: PontoDeReferencia | undefined;
  /** Onde o custo unitário para de cair; só existe quando há joelho. */
  readonly joelho: PontoDeReferencia | undefined;
  readonly forma: FormaDaCurva;
  /** Variação relativa entre o maior e o menor custo unitário da faixa. */
  readonly amplitude: number;
}

/**
 * Volume da operação de referência, na unidade da faina.
 *
 * Escolhido por unidade para que a faixa de produtividade varrida caia na
 * ordem de grandeza com que a operação é cotada — 500 a 3.000 t por terno em
 * carga a granel, algumas dezenas de contêineres, e assim por diante. Em
 * regime de produção o custo por unidade não depende do volume, então esta
 * escolha só ajusta a legibilidade do eixo; em salário-dia ela desloca o nível
 * da curva, e por isso o volume é declarado junto do gráfico.
 */
const VOLUMES_DE_REFERENCIA: Readonly<Record<string, number>> = {
  TON: 12000,
  VOLUME: 1200,
  UNIDADE: 600,
  CONTAINER: 600,
  EQUIPE: 24,
};
const VOLUME_DE_REFERENCIA_PADRAO = 1200;

export function volumeDeReferencia(unidade?: string): number {
  return (unidade && VOLUMES_DE_REFERENCIA[unidade]) || VOLUME_DE_REFERENCIA_PADRAO;
}
/** A referência usa um terno para não embutir uma decisão de alocação. */
export const TERNOS_DE_REFERENCIA = 1;
const PERIODOS_MAXIMOS_DA_REFERENCIA = 24;
/**
 * A referência começa em quatro períodos — um ciclo diário completo.
 *
 * Operações de um ou dois períodos cabem inteiras nas faixas diurnas e não
 * pagam adicional nenhum, o que as torna artificialmente baratas. Isso é uma
 * propriedade do relógio, não da faina, e dominaria a curva se entrasse nela.
 * A análise do cenário informado, essa sim, considera durações curtas.
 */
const PERIODOS_MINIMOS_DA_REFERENCIA = 4;

/** Abaixo desta variação a curva não distingue produtividades de verdade. */
const AMPLITUDE_CONSTANTE = 0.05;
/**
 * Crescimento do produto `custo × produtividade` que marca a saída do piso.
 *
 * A majoração de jornada serrilha a curva em alguns por cento; a tolerância
 * precisa ficar acima desse ruído para não ler o calendário como joelho.
 */
const TOLERANCIA_DO_PRODUTO = 0.10;
/** Pontos no piso antes do joelho, para distinguir um trecho plano de ruído. */
const PONTOS_MINIMOS_NO_PISO = 2;

/**
 * Curva de custo por produtividade da faina, em calendário e volume fixos.
 *
 * A varredura percorre durações inteiras — "e se a operação fechasse em k
 * períodos?" — e converte cada uma na produtividade por terno que ela exigiria.
 * Nada aqui vem do que o usuário digitou: é a faina medida contra uma régua.
 */
export function analisarFainaDeReferencia(
  faina: FainaCatalogada,
  catalogo: CatalogoOgmo,
  calendario: CalendarioOgmo,
): ReferenciaDaFaina {
  const inicio: InicioDaOperacao = { data: dataDeReferenciaNeutra(), periodo: '07-13' };
  const volume = volumeDeReferencia(faina.unidade);
  const pontos: PontoDeReferencia[] = [];
  const grade = gerarGradeDeProdutividades(volume, TERNOS_DE_REFERENCIA, {
    periodosMinimos: PERIODOS_MINIMOS_DA_REFERENCIA,
    periodosMaximos: PERIODOS_MAXIMOS_DA_REFERENCIA,
  });
  for (const produtividade of grade) {
    const periodos = Math.ceil(volume / (produtividade * TERNOS_DE_REFERENCIA));
    try {
      const resultado = simular({
        faina: faina.codigo,
        inicio,
        volumeToneladas: volume,
        produtividadeToneladasPorPeriodo: produtividade,
        ternosPorPeriodoPadrao: TERNOS_DE_REFERENCIA,
        totalDeTernos: TERNOS_DE_REFERENCIA * periodos,
      }, catalogo, calendario);
      pontos.push({
        produtividade,
        periodos: resultado.quantidadeDePeriodos,
        custoPorUnidade: resultado.custoPorTonelada,
      });
    } catch {
      // Faina sem regra habilitada, ou duração inviável: fica fora da curva.
    }
  }

  const custos = pontos.map((ponto) => ponto.custoPorUnidade);
  const menor = custos.length ? Math.min(...custos) : 0;
  const maior = custos.length ? Math.max(...custos) : 0;
  const amplitude = menor > 0 ? (maior - menor) / menor : 0;
  const maisBarato = pontos.find((ponto) => ponto.custoPorUnidade === menor);
  const joelho = amplitude > AMPLITUDE_CONSTANTE ? localizarJoelho(pontos) : undefined;
  const forma: FormaDaCurva = amplitude <= AMPLITUDE_CONSTANTE
    ? 'CONSTANTE'
    : joelho ? 'JOELHO'
    : maisBaratoNoExtremoRapido(pontos, maisBarato) ? 'DECRESCENTE'
    : 'CALENDARIO';

  return {
    inicio,
    volumeDeReferencia: volume,
    ternosDeReferencia: TERNOS_DE_REFERENCIA,
    pontos,
    maisBarato,
    ...(joelho ? { joelho } : { joelho: undefined }),
    forma,
    amplitude,
  };
}

/**
 * Produtividade em que o custo unitário para de cair.
 *
 * O sinal é o produto `custo por unidade × produtividade`, que tem significado
 * direto: ele é a quantidade efetivamente cobrada por período, por terno.
 *
 * - Enquanto a operação paga um piso, cobra-se o piso independentemente do que
 *   foi produzido, então o produto fica **constante**.
 * - Assim que a produção supera o piso, cobra-se a produção, e o produto passa
 *   a **crescer** junto com a produtividade.
 *
 * O joelho é a fronteira entre os dois trechos. Uma curva de salário-dia tem o
 * produto constante do começo ao fim — nunca sai do piso, e por isso não tem
 * joelho, só recompensa por terminar antes. Uma curva sem piso nenhum tem o
 * produto crescendo desde o primeiro ponto.
 */
function localizarJoelho(pontos: readonly PontoDeReferencia[]): PontoDeReferencia | undefined {
  const ordenados = [...pontos].sort((a, b) => a.produtividade - b.produtividade);
  if (ordenados.length < PONTOS_MINIMOS_NO_PISO + 3) return undefined;
  const produtos = ordenados.map((ponto) => ponto.custoPorUnidade * ponto.produtividade);
  const piso = produtos[0]!;
  if (!(piso > 0)) return undefined;

  const saida = produtos.findIndex((produto) => produto > piso * (1 + TOLERANCIA_DO_PRODUTO));
  // Nunca sai do piso: o custo cai como 1/produtividade em toda a faixa.
  if (saida < 0) return undefined;
  // Sai no primeiro ponto: não havia piso, só a produção sendo cobrada.
  if (saida < PONTOS_MINIMOS_NO_PISO) return undefined;
  return ordenados[saida];
}

/**
 * O menor custo está no extremo rápido da faixa?
 *
 * Só então "mais produtivo é mais barato" descreve a faina. Quando o mínimo cai
 * no meio da varredura, o que se está medindo é a semana — a operação que
 * escapa do fim de semana, não a que produz mais.
 */
function maisBaratoNoExtremoRapido(
  pontos: readonly PontoDeReferencia[],
  maisBarato: PontoDeReferencia | undefined,
): boolean {
  if (!maisBarato) return false;
  const ordenados = [...pontos].sort((a, b) => a.produtividade - b.produtividade);
  const posicao = ordenados.findIndex((ponto) => ponto === maisBarato);
  return posicao >= ordenados.length - 2;
}
