import type { Remuneracao, TabelaDeTaxa, ValorTabelado } from '../dominio/tipos.js';
import {
  totalDeCotas,
  totalDeTrabalhadores,
  type PosicaoDimensionada,
} from './equipe.js';
import type { PoliticasDeCalculo } from './politicas.js';

/** Em que regime um trabalhador caiu no período. */
export type Regime = 'PRODUCAO' | 'PISO';

export interface CustoDeCategoriaNoPeriodo {
  readonly custo: number;
  readonly trabalhadores: number;
  /** Quantos deles ficaram no piso — o sinal que o comercial precisa ver. */
  readonly trabalhadoresNoPiso: number;
  readonly regimeDominante: Regime;
  readonly multiplicador: number;
}

export class FaixaDeTaxaNaoEncontrada extends Error {
  constructor(quantidade: number) {
    super(`Nenhuma faixa de taxa cobre a quantidade ${quantidade}.`);
    this.name = 'FaixaDeTaxaNaoEncontrada';
  }
}

/**
 * Resolve a taxa aplicável, escolhendo a faixa pela quantidade total da carga.
 *
 * A faixa é escolhida pela quantidade do navio inteiro, não pela produção do
 * período: as faixas das fainas de veículos e máquinas são degraus de porte de
 * operação (#17, item 5). Se a leitura correta for outra, é aqui que muda.
 */
export function resolverTaxa(
  tabela: TabelaDeTaxa,
  quantidadeTotal: number,
): ValorTabelado {
  if (tabela.tipo === 'LINEAR') return tabela.valor;
  for (const faixa of tabela.faixas) {
    if (faixa.ate === null || quantidadeTotal <= faixa.ate) return faixa.valor;
  }
  throw new FaixaDeTaxaNaoEncontrada(quantidadeTotal);
}

interface ContextoDoPeriodo {
  readonly producaoDoPeriodo: number;
  readonly producaoPorTerno: number;
  readonly quantidadeTotalDaCarga: number;
  readonly multiplicador: number;
  /** 1 em período cheio; menor sob a política `EXATO`. */
  readonly fracaoRequisitada: number;
}

/**
 * O custo de uma categoria num período.
 *
 * A regra que governa tudo (ACT, Cláusula Quinta, §2º), por trabalhador e por
 * período requisitado:
 *
 * ```
 * remuneração = max( cota × taxa × produção , salário-dia )
 * ```
 *
 * O tempo não multiplica o custo. O que ele faz é decidir quantos períodos
 * existem — e cada período requisitado carrega o piso, mesmo sem produção.
 *
 * Daí a fração de período incidir **só sobre o piso**, antes do `max`. O piso é
 * a contrapartida de ter requisitado um período; requisitar meio período dá
 * direito a meio piso. Já a remuneração por produção é do que foi produzido, e
 * escaliná-la pelo tempo seria voltar ao modelo errado que o ADR 0002 descarta:
 * quem moveu 100 toneladas recebe por 100 toneladas, tenha isso ocupado o
 * período inteiro ou um décimo dele.
 */
export function custoDaCategoriaNoPeriodo(
  remuneracao: Remuneracao,
  posicoes: readonly PosicaoDimensionada[],
  contexto: ContextoDoPeriodo,
  politicas: PoliticasDeCalculo,
): CustoDeCategoriaNoPeriodo {
  const taxa = resolverTaxa(
    remuneracao.taxa,
    contexto.quantidadeTotalDaCarga,
  ).totalComEncargos;
  const piso = remuneracao.salarioDia.totalComEncargos * contexto.fracaoRequisitada;
  const trabalhadores = totalDeTrabalhadores(posicoes);

  if (trabalhadores === 0) {
    return {
      custo: 0,
      trabalhadores: 0,
      trabalhadoresNoPiso: 0,
      regimeDominante: 'PRODUCAO',
      multiplicador: contexto.multiplicador,
    };
  }

  const porProducao =
    remuneracao.unidadeDaTaxa === 'POR_EQUIPE'
      ? rateioPorEquipe(taxa, posicoes, contexto)
      : porHomem(taxa, posicoes, contexto);

  let custo = 0;
  let noPiso = 0;
  for (const bruto of porProducao) {
    const venceuOPiso = bruto >= piso;
    if (!venceuOPiso) noPiso++;
    const remunerado = venceuOPiso ? bruto : piso;
    const aplicaMultiplicador = venceuOPiso || politicas.adicionalIncideSobreOPiso;
    custo += aplicaMultiplicador ? remunerado * contexto.multiplicador : remunerado;
  }

  return {
    custo,
    trabalhadores,
    trabalhadoresNoPiso: noPiso,
    regimeDominante: noPiso * 2 > trabalhadores ? 'PISO' : 'PRODUCAO',
    multiplicador: contexto.multiplicador,
  };
}

/**
 * Taxa homem: cada trabalhador ganha `cota × taxa × produção`.
 *
 * O custo da PORTMAC cresce com o tamanho da equipe. A produção relevante é a
 * do terno para posições por terno; para posição por navio sob taxa-homem, é a
 * produção total — leitura a confirmar, porque o ACT só descreve esse caso na
 * conferência, que é taxa-equipe.
 */
function porHomem(
  taxa: number,
  posicoes: readonly PosicaoDimensionada[],
  contexto: ContextoDoPeriodo,
): number[] {
  const valores: number[] = [];
  for (const { posicao, efetivo } of posicoes) {
    const producao =
      posicao.escala === 'POR_TERNO'
        ? contexto.producaoPorTerno
        : contexto.producaoDoPeriodo;
    const valor = posicao.cota * taxa * producao;
    for (let i = 0; i < efetivo; i++) valores.push(valor);
  }
  return valores;
}

/**
 * Taxa equipe: existe um bolo `taxa × produção` rateado pelas cotas.
 *
 * O custo da PORTMAC não depende da quantidade de ternos — o ACT diz isso com
 * todas as letras para o granito: *"independentemente da quantidade de ternos
 * será remunerada por R$ 3,01 para cada tonelada de granito movimentada"*.
 *
 * O rateio interno é irrelevante para o custo da PORTMAC... **exceto pelo
 * piso**. Se o rateio deixar alguém abaixo do salário-dia, o piso é por
 * trabalhador, e aí o bolo deixa de ser o custo. É por isso que o rateio é
 * calculado aqui em vez de o bolo ser somado direto.
 */
function rateioPorEquipe(
  taxa: number,
  posicoes: readonly PosicaoDimensionada[],
  contexto: ContextoDoPeriodo,
): number[] {
  const bolo = taxa * contexto.producaoDoPeriodo;
  const cotas = totalDeCotas(posicoes);
  const valores: number[] = [];
  for (const { posicao, efetivo } of posicoes) {
    const valor = cotas === 0 ? 0 : (bolo * posicao.cota) / cotas;
    for (let i = 0; i < efetivo; i++) valores.push(valor);
  }
  return valores;
}
