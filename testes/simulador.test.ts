import { describe, expect, it } from 'vitest';
import { data } from '../src/dominio/tempo.js';
import type {
  CalendarioOgmo,
} from '../src/calendario/portas.js';
import type { CatalogoOgmo } from '../src/catalogo/portas.js';
import type { PeriodoOgmo } from '../src/dominio/tipos.js';
import { EntradaInvalida, simular } from '../src/motor/simulador.js';

const catalogo: CatalogoOgmo = {
  obterFaina(codigo) {
    return codigo === 'GRANITO'
      ? { codigo, descricao: 'Granito', unidade: 'TON' }
      : undefined;
  },
  calcularCustoDoPeriodo({ producaoToneladas, ternos, periodo }) {
    const custo = producaoToneladas * 10 + ternos * 100 * periodo.multiplicador;
    return {
      total: custo,
      memoria: [{ descricao: 'Custo fictício do catálogo de teste', valor: custo }],
    };
  },
};

const calendario: CalendarioOgmo = {
  projetar(inicio, quantidade) {
    return Array.from({ length: quantidade }, (_, indice): PeriodoOgmo => ({
      indice,
      data: inicio.data,
      identificador: indice === 0 ? inicio.periodo : `P${indice + 1}`,
      multiplicador: indice === 1 ? 2 : 1,
    }));
  },
};

const entrada = {
  faina: 'GRANITO',
  inicio: { data: data(2026, 9, 4), periodo: 'P1' },
  volumeToneladas: 105,
  produtividadeToneladasPorPeriodo: 10,
  totalDeTernos: 10,
};

describe('simulador mínimo', () => {
  it('calcula períodos arredondando para cima e cobre todo o volume', () => {
    const resultado = simular(entrada, catalogo, calendario);

    expect(resultado.quantidadeDePeriodos).toBe(11);
    expect(resultado.periodos[10]?.producaoToneladas).toBe(5);
    expect(resultado.periodos.reduce((soma, p) => soma + p.producaoToneladas, 0)).toBe(105);
  });

  it('distribui ternos inteiros e preserva o total', () => {
    const resultado = simular(entrada, catalogo, calendario);

    expect(resultado.distribuicaoDeTernos).toEqual([0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('equilibra a distribuição quando o total não divide pelos períodos', () => {
    const resultado = simular(
      { ...entrada, volumeToneladas: 30, produtividadeToneladasPorPeriodo: 10 },
      catalogo,
      calendario,
    );

    expect(resultado.distribuicaoDeTernos).toEqual([3, 3, 4]);
  });

  it('aceita uma redistribuição manual somente quando a soma permanece igual', () => {
    const resultado = simular(
      { ...entrada, ternosPorPeriodo: [1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1] },
      catalogo,
      calendario,
    );
    expect(resultado.distribuicaoDeTernos.reduce((soma, n) => soma + n, 0)).toBe(10);
  });

  it('recusa uma redistribuição que altera o total da operação', () => {
    expect(() =>
      simular(
        { ...entrada, ternosPorPeriodo: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
        catalogo,
        calendario,
      ),
    ).toThrow(EntradaInvalida);
  });

  it('mantém produtividade e ternos como entradas independentes', () => {
    const resultado = simular(
      { ...entrada, volumeToneladas: 20, produtividadeToneladasPorPeriodo: 10, totalDeTernos: 3 },
      catalogo,
      calendario,
    );
    expect(resultado.periodos.map((p) => p.producaoToneladas)).toEqual([10, 10]);
    expect(resultado.periodos.map((p) => p.ternos)).toEqual([1, 2]);
  });
});
