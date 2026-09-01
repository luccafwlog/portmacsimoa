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
