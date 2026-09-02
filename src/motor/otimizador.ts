import type { CalendarioOgmo } from '../calendario/portas.js';
import type { CatalogoOgmo } from '../catalogo/portas.js';
import type { EntradaDeSimulacao, ResultadoDeSimulacao } from '../dominio/tipos.js';
import { simular } from './simulador.js';

export interface PontoDeOtimizacao {
  readonly produtividade: number;
  readonly periodos: number;
  readonly resultado: ResultadoDeSimulacao;
}

export interface ResultadoDeOtimizacao {
  readonly candidatos: readonly PontoDeOtimizacao[];
  readonly melhor: PontoDeOtimizacao | undefined;
}

/** Quantos candidatos a grade produz; cada um custa uma simulação completa. */
const PONTOS_DA_GRADE = 28;
/**
 * Durações que a faixa varrida cobre, em períodos de seis horas.
 *
 * O piso é um ciclo diário completo: uma operação de um ou dois períodos cabe
 * inteira nas faixas diurnas e não paga adicional nenhum, o que a torna
 * artificialmente barata. Isso é propriedade do relógio, não da operação, e
 * faria a varredura recomendar sempre a duração mais curta possível.
 */
const PERIODOS_MINIMOS_DA_GRADE = 4;
const PERIODOS_MAXIMOS_DA_GRADE = 48;

export interface FaixaDaGrade {
  /** Duração mais curta considerada, em períodos. */
  readonly periodosMinimos?: number;
  /** Duração mais longa considerada, em períodos. */
  readonly periodosMaximos?: number;
  readonly pontos?: number;
}

/**
 * Grade linear de produtividades derivada da operação.
 *
 * A faixa sai do volume e dos ternos — fatos da operação —, indo da
 * produtividade que fecharia na duração mais longa considerada até a que
 * fecharia na mais curta. Dentro dela os candidatos são igualmente espaçados,
 * como na planilha de origem: uma grade que varresse durações inteiras
 * amontoaria os pontos justamente na faixa baixa, que é onde uma produção
 * mínima faz o custo unitário virar.
 *
 * A produtividade informada pelo usuário não entra: ela não pode definir a
 * faixa em que a própria escolha será julgada.
 */
export function gerarGradeDeProdutividades(
  volume: number,
  ternosPorPeriodo: number,
  faixa: FaixaDaGrade = {},
): readonly number[] {
  const periodosMinimos = Math.max(1, faixa.periodosMinimos ?? PERIODOS_MINIMOS_DA_GRADE);
  const periodosMaximos = Math.max(periodosMinimos, faixa.periodosMaximos ?? PERIODOS_MAXIMOS_DA_GRADE);
  const pontos = Math.max(2, faixa.pontos ?? PONTOS_DA_GRADE);
  if (!(volume > 0) || !(ternosPorPeriodo > 0)) return [];

  const menor = volume / (periodosMaximos * ternosPorPeriodo);
  const maior = volume / (periodosMinimos * ternosPorPeriodo);
  const passo = (maior - menor) / (pontos - 1);
  const grade = new Set<number>();
  for (let indice = 0; indice < pontos; indice += 1) {
    // Duas casas bastam para uma produtividade cotável, e arredondar para cima
    // garante que a capacidade do candidato cubra o volume na duração prevista.
    const valor = Math.ceil((menor + passo * indice) * 100) / 100;
    if (valor > 0 && Number.isFinite(valor)) grade.add(valor);
  }
  return [...grade];
}

/**
 * Compara produtividades a partir de uma grade externa e fixa.
 *
 * A produtividade informada no cenário é apenas a base da cotação atual; ela
 * não define a grade, a faixa ou o ponto ótimo da análise.
 */
export function otimizarCenario(
  entrada: EntradaDeSimulacao,
  catalogo: CatalogoOgmo,
  calendario: CalendarioOgmo,
  produtividades: readonly number[],
): ResultadoDeOtimizacao {
  const candidatos = produtividades
    .filter((produtividade, indice, todas) =>
      Number.isFinite(produtividade) && produtividade > 0 && todas.indexOf(produtividade) === indice,
    )
    .sort((a, b) => a - b)
    .flatMap((produtividade): PontoDeOtimizacao[] => {
      const capacidadePorPeriodo = entrada.ternosPorPeriodoPadrao === undefined
        ? produtividade
        : produtividade * entrada.ternosPorPeriodoPadrao;
      const periodosEsperados = Math.ceil(entrada.volumeToneladas / capacidadePorPeriodo);
      const totalDeTernos = entrada.ternosPorPeriodoPadrao !== undefined
        ? entrada.ternosPorPeriodoPadrao * periodosEsperados
        : entrada.totalDeTernos;

      // Uma operação produtiva precisa de pelo menos um terno em cada período
      // e a regra do catálogo limita a quatro ternos por período.
      if (totalDeTernos < periodosEsperados || totalDeTernos > periodosEsperados * 4) {
        return [];
      }

      try {
        const { produtividadesPorPeriodo: _produtividades, ternosPorPeriodo: _ternos, ...entradaSemAjustes } = entrada;
        const resultado = simular({
          ...entradaSemAjustes,
          produtividadeToneladasPorPeriodo: produtividade,
          totalDeTernos,
          // A otimização compara uma distribuição nova; não reaproveita os
          // ajustes manuais feitos no cenário informado.
        }, catalogo, calendario);
        return [{ produtividade, periodos: resultado.quantidadeDePeriodos, resultado }];
      } catch {
        return [];
      }
    });

  const melhor = candidatos.reduce<PontoDeOtimizacao | undefined>((atual, candidato) => {
    if (!atual) return candidato;
    if (candidato.resultado.custoPorTonelada < atual.resultado.custoPorTonelada) return candidato;
    if (
      candidato.resultado.custoPorTonelada === atual.resultado.custoPorTonelada
      && candidato.periodos < atual.periodos
    ) return candidato;
    return atual;
  }, undefined);

  return { candidatos, melhor };
}
