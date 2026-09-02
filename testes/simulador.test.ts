import { describe, expect, it } from 'vitest';
import { data } from '../src/dominio/tempo.js';
import type {
  CalendarioOgmo,
} from '../src/calendario/portas.js';
import type { CatalogoOgmo } from '../src/catalogo/portas.js';
import type { PeriodoOgmo } from '../src/dominio/tipos.js';
import { EntradaInvalida, simular } from '../src/motor/simulador.js';
import { gerarGradeDeProdutividades, otimizarCenario } from '../src/motor/otimizador.js';

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

  it('usa a produtividade customizada de cada período e limita o último ao volume restante', () => {
    const resultado = simular(
      {
        ...entrada,
        volumeToneladas: 20,
        produtividadeToneladasPorPeriodo: 10,
        totalDeTernos: 3,
        produtividadesPorPeriodo: [6, 14],
      },
      catalogo,
      calendario,
    );

    expect(resultado.periodos.map((periodo) => periodo.producaoToneladas)).toEqual([6, 14]);
    expect(resultado.entrada.produtividadesPorPeriodo).toEqual([6, 14]);
  });

  it('recusa produtividade customizada diferente do volume da operação', () => {
    expect(() => simular(
      {
        ...entrada,
        volumeToneladas: 20,
        produtividadeToneladasPorPeriodo: 10,
        totalDeTernos: 3,
        produtividadesPorPeriodo: [6, 13],
      },
      catalogo,
      calendario,
    )).toThrow('exatamente igual ao volume');

    expect(() => simular(
      {
        ...entrada,
        volumeToneladas: 20,
        produtividadeToneladasPorPeriodo: 10,
        totalDeTernos: 3,
        produtividadesPorPeriodo: [7, 14],
      },
      catalogo,
      calendario,
    )).toThrow('exatamente igual ao volume');
  });

  it('aceita períodos sem terno quando a distribuição preserva o total', () => {
    const resultado = simular(
      {
        ...entrada,
        volumeToneladas: 20,
        produtividadeToneladasPorPeriodo: 10,
        totalDeTernos: 1,
        ternosPorPeriodo: [0, 1],
      },
      catalogo,
      calendario,
    );

    expect(resultado.distribuicaoDeTernos).toEqual([0, 1]);
  });

  it('limita a distribuição a quatro ternos por período', () => {
    expect(() => simular(
      { ...entrada, volumeToneladas: 20, produtividadeToneladasPorPeriodo: 10, totalDeTernos: 7 },
      catalogo,
      calendario,
    )).not.toThrow();

    expect(() => simular(
      { ...entrada, volumeToneladas: 20, produtividadeToneladasPorPeriodo: 10, totalDeTernos: 9 },
      catalogo,
      calendario,
    )).toThrow('máximo de 4 ternos');
  });

  it('deriva e valida o total de ternos a partir dos ternos por período', () => {
    const resultado = simular(
      {
        ...entrada,
        volumeToneladas: 20,
        produtividadeToneladasPorPeriodo: 10,
        ternosPorPeriodoPadrao: 2,
        totalDeTernos: 2,
      },
      catalogo,
      calendario,
    );

    expect(resultado.quantidadeDePeriodos).toBe(1);
    expect(resultado.distribuicaoDeTernos).toEqual([2]);
    expect(resultado.periodos[0]?.producaoToneladas).toBe(20);
    expect(() => simular(
      {
        ...entrada,
        volumeToneladas: 20,
        produtividadeToneladasPorPeriodo: 10,
        ternosPorPeriodoPadrao: 2,
        totalDeTernos: 3,
      },
      catalogo,
      calendario,
    )).toThrow('períodos multiplicados pelos ternos por período');
  });

  it('considera os ternos por período no custo de mão de obra', () => {
    const umTerno = simular(
      {
        ...entrada,
        volumeToneladas: 10,
        produtividadeToneladasPorPeriodo: 10,
        ternosPorPeriodoPadrao: 1,
        totalDeTernos: 1,
      },
      catalogo,
      calendario,
    );
    const doisTernos = simular(
      {
        ...entrada,
        volumeToneladas: 10,
        produtividadeToneladasPorPeriodo: 10,
        ternosPorPeriodoPadrao: 2,
        totalDeTernos: 2,
      },
      catalogo,
      calendario,
    );

    expect(doisTernos.periodos.every((periodo) => periodo.ternos === 2)).toBe(true);
    expect(doisTernos.custoDeMaoDeObra).toBeGreaterThan(umTerno.custoDeMaoDeObra);
  });

  it('aplica a produtividade por terno a cada terno do período', () => {
    const resultado = simular(
      {
        ...entrada,
        volumeToneladas: 30,
        produtividadeToneladasPorPeriodo: 10,
        ternosPorPeriodoPadrao: 2,
        totalDeTernos: 4,
        ternosPorPeriodo: [2, 2],
        produtividadesPorPeriodo: [5, 10],
      },
      catalogo,
      calendario,
    );

    expect(resultado.periodos.map((periodo) => periodo.producaoToneladas)).toEqual([10, 20]);
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

  it('calcula o ótimo em uma grade independente da produtividade informada', () => {
    const entradaComProdutividadeBaixa = {
      ...entrada,
      volumeToneladas: 20,
      produtividadeToneladasPorPeriodo: 5,
      totalDeTernos: 3,
      produtividadesPorPeriodo: [5, 5, 5, 5],
    };
    const { produtividadesPorPeriodo: _produtividades, ...entradaSemAjustes } = entradaComProdutividadeBaixa;
    const entradaComProdutividadeAlta = {
      ...entradaSemAjustes,
      produtividadeToneladasPorPeriodo: 20,
    };

    const primeiraAnalise = otimizarCenario(
      entradaComProdutividadeBaixa,
      catalogo,
      calendario,
      [5, 10, 20],
    );
    const segundaAnalise = otimizarCenario(
      entradaComProdutividadeAlta,
      catalogo,
      calendario,
      [5, 10, 20],
    );

    expect(primeiraAnalise.melhor?.produtividade).toBe(20);
    expect(segundaAnalise.melhor?.produtividade).toBe(20);
    expect(primeiraAnalise.melhor?.periodos).toBe(1);
    expect(primeiraAnalise.candidatos.map((candidato) => candidato.produtividade)).toEqual([10, 20]);
    expect(primeiraAnalise.melhor?.resultado.periodos.reduce((total, periodo) => total + periodo.producaoToneladas, 0)).toBe(20);

    const analiseComDoisTernos = otimizarCenario(
      {
        ...entradaSemAjustes,
        volumeToneladas: 20,
        produtividadeToneladasPorPeriodo: 10,
        ternosPorPeriodoPadrao: 2,
        totalDeTernos: 4,
      },
      catalogo,
      calendario,
      [5, 10, 20],
    );
    expect(analiseComDoisTernos.candidatos.map((candidato) => candidato.resultado.entrada.totalDeTernos)).toEqual([4, 2, 2]);
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

describe('memória do cenário', () => {
  it('marca contagens como quantidade e dinheiro como moeda', () => {
    const resultado = simular({
      faina: 'GRANITO',
      inicio: { data: data(2026, 4, 17), periodo: '07-13' },
      volumeToneladas: 100,
      produtividadeToneladasPorPeriodo: 25,
      ternosPorPeriodoPadrao: 2,
      totalDeTernos: 4,
    }, catalogo, calendario);

    const porDescricao = new Map(resultado.memoria.map((linha) => [linha.descricao, linha]));
    // Contar ternos como dinheiro fazia a memória exibir "R$ 4,00".
    expect(porDescricao.get('Total de ternos')?.formato).toBe('QUANTIDADE');
    expect(porDescricao.get('Quantidade de períodos')?.formato).toBe('QUANTIDADE');
    expect(porDescricao.get('Custo total')?.formato).toBe('MOEDA');
    expect(porDescricao.get('Mão de obra')?.formato).toBe('MOEDA');
  });

  it('nomeia a unidade da faina no resumo', () => {
    const resultado = simular({
      faina: 'GRANITO',
      inicio: { data: data(2026, 4, 17), periodo: '07-13' },
      volumeToneladas: 100,
      produtividadeToneladasPorPeriodo: 50,
      ternosPorPeriodoPadrao: 1,
      totalDeTernos: 2,
    }, catalogo, calendario);

    expect(resultado.memoria[0]?.descricao).toBe('Quantidade total (toneladas)');
  });
});

describe('grade de produtividades', () => {
  const volume = 9000;
  const ternos = 2;

  it('cobre da duração mais longa à mais curta da faixa', () => {
    const grade = gerarGradeDeProdutividades(volume, ternos, { periodosMinimos: 2, periodosMaximos: 48 });
    expect(Math.min(...grade)).toBeCloseTo(volume / (48 * ternos), 1);
    expect(Math.max(...grade)).toBeCloseTo(volume / (2 * ternos), 1);
  });

  it('espaça os candidatos por igual, como a planilha de origem', () => {
    const grade = [...gerarGradeDeProdutividades(volume, ternos, { pontos: 11 })].sort((a, b) => a - b);
    const saltos = grade.slice(1).map((valor, indice) => valor - grade[indice]!);
    const maior = Math.max(...saltos);
    const menor = Math.min(...saltos);
    // Uma grade derivada de durações inteiras teria saltos dezenas de vezes
    // maiores no extremo rápido; aqui eles são praticamente iguais.
    expect(maior - menor).toBeLessThan(0.05);
  });

  it('não repete produtividades e recusa operação sem volume ou sem ternos', () => {
    const grade = gerarGradeDeProdutividades(volume, ternos);
    expect(new Set(grade).size).toBe(grade.length);
    expect(gerarGradeDeProdutividades(0, ternos)).toEqual([]);
    expect(gerarGradeDeProdutividades(volume, 0)).toEqual([]);
  });

  it('cada candidato tem capacidade para o volume na duração prevista', () => {
    for (const produtividade of gerarGradeDeProdutividades(volume, ternos)) {
      const periodos = Math.ceil(volume / (produtividade * ternos));
      expect(produtividade * ternos * periodos).toBeGreaterThanOrEqual(volume - 0.0001);
    }
  });

  it('alimenta o otimizador com cenários viáveis do próprio volume', () => {
    const entrada = {
      faina: 'GRANITO',
      inicio: { data: data(2026, 4, 17), periodo: '07-13' },
      volumeToneladas: volume,
      produtividadeToneladasPorPeriodo: 250,
      ternosPorPeriodoPadrao: ternos,
      totalDeTernos: 36,
    } as const;
    const otimizacao = otimizarCenario(entrada, catalogo, calendario, gerarGradeDeProdutividades(volume, ternos));
    expect(otimizacao.candidatos.length).toBeGreaterThan(1);
    for (const candidato of otimizacao.candidatos) {
      expect(candidato.resultado.custoPorTonelada).toBeGreaterThan(0);
    }
    expect(otimizacao.melhor?.resultado.custoPorTonelada)
      .toBe(Math.min(...otimizacao.candidatos.map((candidato) => candidato.resultado.custoPorTonelada)));
  });
});
