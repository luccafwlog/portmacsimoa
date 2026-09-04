import { describe, expect, it } from 'vitest';
import { data } from '../src/dominio/tempo.js';
import type { PeriodoOgmo } from '../src/dominio/tipos.js';
import {
  CatalogoPortmac,
  fainasAct,
  type RegistroDeFaina,
} from '../src/catalogo/portmac.js';
import {
  COTAS_DA_CARGA_GERAL,
  COTAS_DA_PEACAO,
  ENCARGOS_DE_TESTE,
  fainaDeProducao,
  fainaDeSalarioDia,
} from './fainas-de-teste.js';

const periodo: PeriodoOgmo = {
  indice: 0,
  data: data(2026, 9, 4),
  identificador: '01-07',
};

const diaNormal = { ...periodo, data: data(2026, 9, 8), identificador: '07-13' };

describe('catálogo documental do PORTMAC', () => {
  it('está vazio enquanto a ACT correta não for transcrita', () => {
    // O cadastro anterior (ACT e CCT) foi retirado por estar incorreto: é
    // preferível não ter faina a cotar com número errado.
    expect(fainasAct).toEqual([]);
    expect(new CatalogoPortmac(fainasAct).listarFainas()).toEqual([]);
  });

  it('só reconhece a ACT como fonte documental', () => {
    const catalogo = new CatalogoPortmac([fainaDeProducao, fainaDeSalarioDia]);

    expect(catalogo.listarFainas().every((faina) => faina.fonte === 'ACT')).toBe(true);
  });

  it('mantém um único registro por código', () => {
    const duplicada: RegistroDeFaina = { ...fainaDeProducao, vigencia: 'recadastro' };
    const catalogo = new CatalogoPortmac([fainaDeProducao, duplicada]);

    expect(catalogo.listarFainas()).toHaveLength(1);
    expect(catalogo.obterFaina(fainaDeProducao.codigo)?.vigencia).toBe('recadastro');
  });

  it('calcula uma faina de produção com a composição do terno', () => {
    const catalogo = new CatalogoPortmac([fainaDeProducao]);

    const custo = catalogo.calcularCustoDoPeriodo({
      faina: fainaDeProducao,
      periodo: diaNormal,
      producaoToneladas: 100,
      ternos: 1,
    });

    expect(custo.total).toBeCloseTo(100 * 3.01 * COTAS_DA_CARGA_GERAL * (1 + ENCARGOS_DE_TESTE), 6);
    expect(custo.memoria).toHaveLength(3);
    expect(custo.memoria[2]?.descricao).toContain('Fonte: ACT');
  });

  it('não multiplica novamente a produção agregada pelos ternos', () => {
    const catalogo = new CatalogoPortmac([fainaDeProducao]);
    const custo = catalogo.calcularCustoDoPeriodo({
      faina: fainaDeProducao,
      periodo: diaNormal,
      producaoToneladas: 200,
      ternos: 2,
    });

    expect(custo.total).toBeCloseTo(200 * 3.01 * COTAS_DA_CARGA_GERAL * (1 + ENCARGOS_DE_TESTE), 6);
  });

  it('mantém a base fixa da faina em salário-dia', () => {
    const catalogo = new CatalogoPortmac([fainaDeSalarioDia]);

    const custo = catalogo.calcularCustoDoPeriodo({
      faina: fainaDeSalarioDia,
      periodo: diaNormal,
      producaoToneladas: 999,
      ternos: 1,
    });

    expect(custo.total).toBeCloseTo(COTAS_DA_PEACAO * 515.2 * (1 + ENCARGOS_DE_TESTE), 6);
  });

  it('multiplica a composição de salário-dia pela quantidade de ternos', () => {
    const catalogo = new CatalogoPortmac([fainaDeSalarioDia]);
    const custo = catalogo.calcularCustoDoPeriodo({
      faina: fainaDeSalarioDia,
      periodo: diaNormal,
      producaoToneladas: 999,
      ternos: 2,
    });

    expect(custo.total).toBeCloseTo(2 * COTAS_DA_PEACAO * 515.2 * (1 + ENCARGOS_DE_TESTE), 6);
  });

  it('recusa uma faina que não está no catálogo', () => {
    const catalogo = new CatalogoPortmac([fainaDeProducao]);

    expect(() => catalogo.calcularCustoDoPeriodo({
      faina: fainaDeSalarioDia,
      periodo: diaNormal,
      producaoToneladas: 10,
      ternos: 1,
    })).toThrow(/não está no catálogo/);
  });
});

describe('produção mínima garantida', () => {
  const base = fainaDeProducao;
  const comPiso: RegistroDeFaina = {
    ...base,
    regraAct: { ...base.regraAct!, producaoMinimaPorTernoPorPeriodo: 400 },
  };

  function custoDe(registro: RegistroDeFaina, producao: number, ternos: number): number {
    return new CatalogoPortmac([registro]).calcularCustoDoPeriodo({
      faina: registro,
      periodo: diaNormal,
      producaoToneladas: producao,
      ternos,
    }).total;
  }

  it('nenhuma faina do catálogo declara piso, então o cálculo atual não muda', () => {
    const declaram = fainasAct
      .filter((registro) => registro.regraAct?.producaoMinimaPorTernoPorPeriodo !== undefined);
    expect(declaram).toEqual([]);
  });

  it('cobra o piso quando a produção fica abaixo dele', () => {
    // 100 t produzidas contra um piso de 400 t por terno: cobra-se o piso.
    expect(custoDe(comPiso, 100, 1)).toBeCloseTo(custoDe(base, 400, 1), 6);
  });

  it('cobra a produção quando ela supera o piso', () => {
    expect(custoDe(comPiso, 900, 1)).toBeCloseTo(custoDe(base, 900, 1), 6);
  });

  it('multiplica o piso pelos ternos alocados no período', () => {
    expect(custoDe(comPiso, 100, 2)).toBeCloseTo(custoDe(base, 800, 2), 6);
  });

  it('anuncia na memória que o piso foi aplicado', () => {
    const catalogo = new CatalogoPortmac([comPiso]);
    const abaixo = catalogo.calcularCustoDoPeriodo({ faina: comPiso, periodo: diaNormal, producaoToneladas: 100, ternos: 1 });
    const acima = catalogo.calcularCustoDoPeriodo({ faina: comPiso, periodo: diaNormal, producaoToneladas: 900, ternos: 1 });
    expect(abaixo.memoria[0]?.descricao).toContain('produção mínima garantida');
    expect(acima.memoria[0]?.descricao).toContain('produção do período');
  });
});
