import { describe, expect, it } from 'vitest';
import { data } from '../src/dominio/tempo.js';
import type {
  CalendarioOgmo,
} from '../src/calendario/portas.js';
import type { CatalogoOgmo } from '../src/catalogo/portas.js';
import type { PeriodoOgmo } from '../src/dominio/tipos.js';
import { EntradaInvalida, simular } from '../src/motor/simulador.js';

const catalogo: CatalogoOgmo = {
  listarFainas() {
    return [{
      codigo: 'GRANITO',
      descricao: 'Granito',
      tipoDeCarga: 'Granito',
      unidade: 'TON',
      fonte: 'ACT',
      vigencia: 'teste',
      referencia: 'teste',
    }];
  },
  obterFaina(codigo) {
    return codigo === 'GRANITO'
      ? {
        codigo,
        descricao: 'Granito',
        tipoDeCarga: 'Granito',
        unidade: 'TON',
        fonte: 'ACT',
        vigencia: 'teste',
        referencia: 'teste',
      }
      : undefined;
  },
  calcularCustoDoPeriodo({ producaoToneladas, ternos }) {
    const custo = producaoToneladas * 10 + ternos * 100;
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
    }));
  },
};

const entrada = {
  faina: 'GRANITO',
  inicio: { data: data(2026, 9, 4), periodo: 'P1' },
  volumeToneladas: 105,
  produtividadeToneladasPorPeriodo: 10,
  totalDeTernos: 11,
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

    expect(resultado.distribuicaoDeTernos).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('equilibra a distribuição quando o total não divide pelos períodos', () => {
    const resultado = simular(
      { ...entrada, volumeToneladas: 30, produtividadeToneladasPorPeriodo: 10, totalDeTernos: 8 },
      catalogo,
      calendario,
    );

    expect(resultado.distribuicaoDeTernos).toEqual([2, 3, 3]);
  });

  it('aceita uma redistribuição manual somente quando a soma permanece igual', () => {
    const resultado = simular(
      { ...entrada, ternosPorPeriodo: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
      catalogo,
      calendario,
    );
    expect(resultado.distribuicaoDeTernos.reduce((soma, n) => soma + n, 0)).toBe(11);
  });

  it('recusa uma redistribuição que altera o total da operação', () => {
    expect(() =>
      simular(
        {
          ...entrada,
          volumeToneladas: 20,
          produtividadeToneladasPorPeriodo: 10,
          totalDeTernos: 3,
          ternosPorPeriodo: [1, 1],
        },
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

  it('exige pelo menos um terno por período', () => {
    expect(() => simular(
      { ...entrada, volumeToneladas: 30, produtividadeToneladasPorPeriodo: 10, totalDeTernos: 2 },
      catalogo,
      calendario,
    )).toThrow('pelo menos 1 terno');
  });

  it('limita a distribuição a três ternos por período', () => {
    expect(() => simular(
      { ...entrada, volumeToneladas: 20, produtividadeToneladasPorPeriodo: 10, totalDeTernos: 7 },
      catalogo,
      calendario,
    )).toThrow('máximo de 3 ternos');
  });

  it('soma custos opcionais ao total e calcula seu valor por tonelada', () => {
    const resultado = simular(
      {
        ...entrada,
        volumeToneladas: 20,
        produtividadeToneladasPorPeriodo: 10,
        totalDeTernos: 3,
        custosOpcionais: [{ tipo: 'MADEIRA', custoTotal: 1000 }],
      },
      catalogo,
      calendario,
    );

    expect(resultado.custoDeMaoDeObra).toBe(500);
    expect(resultado.custosOpcionais[0]?.custoPorTonelada).toBe(50);
    expect(resultado.custoOpcionalTotal).toBe(1000);
    expect(resultado.custoTotal).toBe(1500);
    expect(resultado.custoPorTonelada).toBe(75);
  });

  it('aceita vários custos opcionais personalizados com descrição', () => {
    const resultado = simular(
      {
        ...entrada,
        volumeToneladas: 20,
        produtividadeToneladasPorPeriodo: 10,
        totalDeTernos: 3,
        custosOpcionais: [
          { tipo: 'OUTRO', descricao: 'Taxa de acesso', custoTotal: 200 },
          { tipo: 'OUTRO', descricao: 'Serviço adicional', custoTotal: 300 },
        ],
      },
      catalogo,
      calendario,
    );

    expect(resultado.custosOpcionais[0]?.descricao).toBe('Taxa de acesso');
    expect(resultado.custosOpcionais[1]?.descricao).toBe('Serviço adicional');
    expect(resultado.custoOpcionalTotal).toBe(500);
    expect(resultado.custoTotal).toBe(1000);
    expect(resultado.custoPorTonelada).toBe(50);
  });
});
