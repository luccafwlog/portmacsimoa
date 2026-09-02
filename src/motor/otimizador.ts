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

/** Teto de candidatos da grade; cada um custa uma simulação completa. */
const PERIODOS_MAXIMOS_DA_GRADE = 96;
const PERIODOS_MINIMOS_DA_GRADE = 24;

/**
 * Grade de comparação derivada da operação, não da produtividade informada.
 *
 * Cada candidato responde a uma pergunta operacional — "e se a operação fechar
 * em k períodos?" — e a produtividade correspondente sai de `volume ÷ (k ×
 * ternos por período)`. A grade depende apenas do volume e dos ternos, que são
 * fatos da operação; a produtividade-base entra somente na largura da faixa
 * varrida, nunca na escolha do ótimo.
 *
 * O arredondamento é sempre para cima: uma produtividade truncada para baixo
 * empurraria `ceil(volume ÷ capacidade)` para k + 1 e a grade repetiria
 * períodos.
 */
export function gerarGradeDeProdutividades(
  entrada: EntradaDeSimulacao,
  periodosDoCenario: number,
): readonly number[] {
  const ternosPorPeriodo = entrada.ternosPorPeriodoPadrao ?? 1;
  if (!(entrada.volumeToneladas > 0) || ternosPorPeriodo <= 0) return [];
  const limite = Math.min(
    PERIODOS_MAXIMOS_DA_GRADE,
    Math.max(PERIODOS_MINIMOS_DA_GRADE, Math.ceil(periodosDoCenario * 2)),
  );
  const grade = new Set<number>();
  for (let periodos = 1; periodos <= limite; periodos += 1) {
    const exata = entrada.volumeToneladas / (periodos * ternosPorPeriodo);
    const arredondada = Math.ceil(exata * 100) / 100;
    if (arredondada > 0 && Number.isFinite(arredondada)) grade.add(arredondada);
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
