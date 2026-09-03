import type { CalendarioOgmo } from '../calendario/portas.js';
import type { CatalogoOgmo } from '../catalogo/portas.js';
import type { EntradaDeSimulacao, ResultadoDeSimulacao } from '../dominio/tipos.js';
import { otimizarCenario, type ResultadoDeOtimizacao } from './otimizador.js';

export interface PontoDeSensibilidade {
  readonly produtividade: number;
  readonly custoPorTonelada: number;
  readonly periodos: number;
  readonly ehCenarioAtual?: boolean;
}

export interface AnaliseDeSensibilidade {
  readonly pontos: readonly PontoDeSensibilidade[];
  readonly otimizacao: ResultadoDeOtimizacao;
}

/** Série de referência da aba “Gráficos” da planilha legada de fertilizantes. */
export const CURVA_OTIMO_FERTILIZANTES: readonly [number, number][] = [
  [500, 34.05], [525, 32.45], [550, 30.8], [575, 29.46], [600, 29.46],
  [625, 28.11], [650, 26.92], [675, 27.35], [700, 26.32], [725, 26.7],
  [750, 26.21], [775, 26.57], [800, 26.94], [825, 26.61], [850, 26.95],
  [875, 27.29], [900, 26.62], [925, 26.93], [950, 27.25], [975, 26.47],
  [1000, 26.76], [1025, 27.05], [1050, 27.34], [1075, 27.63], [1100, 26.99],
  [1125, 27.26], [1150, 27.53], [1175, 27.79], [1200, 28.06], [1225, 27.31],
  [1250, 27.55], [1275, 27.8], [1300, 28.04], [1325, 28.29], [1350, 28.54],
  [1375, 28.78], [1400, 27.46], [1425, 27.68], [1450, 27.9], [1475, 28.11],
  [1500, 28.33], [1525, 28.55], [1550, 28.77], [1575, 28.99], [1600, 29.21],
  [1625, 27.59], [1650, 27.78], [1675, 27.97], [1700, 28.16], [1725, 28.35],
  [1750, 28.54], [1775, 28.73], [1800, 28.92],
];

export function gerarGradePorPeriodos(entrada: EntradaDeSimulacao): readonly number[] {
  // Para unidades sem uma faixa documental de produtividade, a grade de
  // períodos é fixa. Ela não pode ser derivada do cenário-base.
  const periodoMinimo = 1;
  const periodoMaximo = 36;
  return Array.from({ length: periodoMaximo - periodoMinimo + 1 }, (_, indice) => {
    const periodos = periodoMinimo + indice;
    const ternosPorPeriodo = entrada.ternosPorPeriodoPadrao ?? 1;
    return Number((entrada.volumeToneladas / (periodos * ternosPorPeriodo)).toFixed(2));
  });
}

export function obterAnaliseDeSensibilidade(
  resultado: ResultadoDeSimulacao,
  catalogo: CatalogoOgmo,
  calendario: CalendarioOgmo,
): AnaliseDeSensibilidade {
  const faina = catalogo.obterFaina(resultado.entrada.faina);
  const baseEntrada: EntradaDeSimulacao = {
    ...(resultado.entrada.cliente ? { cliente: resultado.entrada.cliente } : {}),
    ...(resultado.entrada.custosOpcionais?.length ? { custosOpcionais: resultado.entrada.custosOpcionais } : {}),
    faina: resultado.entrada.faina,
    inicio: resultado.entrada.inicio,
    volumeToneladas: resultado.entrada.volumeToneladas,
    produtividadeToneladasPorPeriodo: resultado.entrada.produtividadeToneladasPorPeriodo,
    ...(resultado.entrada.ternosPorPeriodoPadrao ? { ternosPorPeriodoPadrao: resultado.entrada.ternosPorPeriodoPadrao } : {}),
    totalDeTernos: resultado.entrada.totalDeTernos,
  };
  const produtividades = faina?.unidade === 'TON'
    ? CURVA_OTIMO_FERTILIZANTES.map(([produtividade]) => produtividade)
    : gerarGradePorPeriodos(baseEntrada);
  const otimizacao = otimizarCenario(baseEntrada, catalogo, calendario, produtividades);
  const pontos = otimizacao.candidatos.map((candidato) => ({
    produtividade: candidato.produtividade,
    custoPorTonelada: candidato.resultado.custoPorTonelada,
    periodos: candidato.periodos,
  }));
  const produtividadeBase = baseEntrada.produtividadeToneladasPorPeriodo;
  const candidatoAtual = produtividadeBase > 0 && pontos.some((ponto) => ponto.produtividade === produtividadeBase)
    ? undefined
    : {
      produtividade: produtividadeBase,
      custoPorTonelada: resultado.custoPorTonelada,
      periodos: resultado.quantidadeDePeriodos,
      ehCenarioAtual: true,
    };
  return {
    pontos: candidatoAtual ? [...pontos, candidatoAtual].sort((a, b) => a.produtividade - b.produtividade) : pontos,
    otimizacao,
  };
}
