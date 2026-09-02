import { describe, expect, it } from 'vitest';
import { data } from '../src/dominio/tempo.js';
import type { PeriodoOgmo } from '../src/dominio/tipos.js';
import {
  CatalogoPortmac,
  fainasCctIniciais,
  type RegistroDeFaina,
} from '../src/catalogo/portmac.js';
import { fainasActProvisorias } from '../src/catalogo/act-provisorio.js';
import { fainasCctProvisorias } from '../src/catalogo/cct-provisorio.js';

const periodo: PeriodoOgmo = {
  indice: 0,
  data: data(2026, 9, 4),
  identificador: '01-07',
};

describe('catálogo documental do PORTMAC', () => {
  it('mantém no catálogo ACT ativo somente as fainas da planilha provisória', () => {
    const catalogo = new CatalogoPortmac(fainasActProvisorias);

    expect(catalogo.listarFainas()).toEqual(fainasActProvisorias);
    expect(catalogo.listarFainas().every((faina) => faina.referencia.includes('Analise_ACT_PORTMAC_Calculadora_Terno_Portuario.xlsx')))
      .toBe(true);
    expect(catalogo.listarFainas().some((faina) => faina.referencia.includes('Anexo I')))
      .toBe(false);
  });

  it('prioriza a ACT quando a mesma faina também aparece na CCT', () => {
    const act = fainasActProvisorias[0]!;
    const cct: RegistroDeFaina = { ...act, fonte: 'CCT', vigencia: 'teste CCT' };
    const catalogo = new CatalogoPortmac([act], [cct]);

    expect(catalogo.obterFaina(act.codigo)?.fonte).toBe('ACT');
    expect(catalogo.listarFainas()).toHaveLength(1);
  });

  it('calcula uma faina ACT provisória com a composição da planilha', () => {
    const catalogo = new CatalogoPortmac(fainasActProvisorias);
    const faina = fainasActProvisorias.find((registro) => registro.codigoDaTabela === '7.5.1')!;

    const custo = catalogo.calcularCustoDoPeriodo({
      faina,
      periodo: { ...periodo, data: data(2026, 9, 8), identificador: '07-13' },
      producaoToneladas: 100,
      ternos: 1,
    });

    expect(custo.total).toBeCloseTo(100 * 34.46 * 15.4 * (1 + 1.152877), 6);
    expect(custo.memoria).toHaveLength(3);
    expect(custo.memoria[2]?.descricao).toContain('ACT provisória');
  });

  it('não multiplica novamente a produção agregada pelos ternos', () => {
    const catalogo = new CatalogoPortmac(fainasActProvisorias);
    const faina = fainasActProvisorias.find((registro) => registro.codigoDaTabela === '7.5.1')!;
    const custo = catalogo.calcularCustoDoPeriodo({
      faina,
      periodo: { ...periodo, data: data(2026, 9, 8), identificador: '07-13' },
      producaoToneladas: 200,
      ternos: 2,
    });

    expect(custo.total).toBeCloseTo(200 * 34.46 * 15.4 * (1 + 1.152877), 6);
  });

  it('mantém a base fixa da faina ACT provisória em salário-dia', () => {
    const catalogo = new CatalogoPortmac(fainasActProvisorias);
    const faina = fainasActProvisorias.find((registro) => registro.codigoDaTabela === '14.1.0')!;

    const custo = catalogo.calcularCustoDoPeriodo({
      faina,
      periodo: { ...periodo, data: data(2026, 9, 8), identificador: '07-13' },
      producaoToneladas: 999,
      ternos: 1,
    });

    expect(custo.total).toBeCloseTo(4 * 515.2 * (1 + 1.152877), 6);
  });

  it('multiplica a composição de salário-dia pela quantidade de ternos', () => {
    const catalogo = new CatalogoPortmac(fainasActProvisorias);
    const faina = fainasActProvisorias.find((registro) => registro.codigoDaTabela === '14.1.0')!;
    const custo = catalogo.calcularCustoDoPeriodo({
      faina,
      periodo: { ...periodo, data: data(2026, 9, 8), identificador: '07-13' },
      producaoToneladas: 999,
      ternos: 2,
    });

    expect(custo.total).toBeCloseTo(2 * 4 * 515.2 * (1 + 1.152877), 6);
  });

  it('calcula a CCT de contêiner como tarifa unitária, sem multiplicar pelas cotas', () => {
    const catalogo = new CatalogoPortmac([], fainasCctProvisorias);
    const faina = fainasCctProvisorias.find((registro) => registro.codigoDaTabela === '6.0')!;
    const custo = catalogo.calcularCustoDoPeriodo({ faina, periodo, producaoToneladas: 20, ternos: 1 });

    expect(custo.total).toBeCloseTo(20 * 0.9625 * (1 + 1.152877) * 1.25, 6);
    expect(custo.memoria[0]?.descricao).toContain('tarifa unitária');
  });

  it('cadastra somente as fainas CCT mapeadas na planilha provisória', () => {
    expect(fainasCctIniciais).toEqual(fainasCctProvisorias);
    expect(new Set(fainasCctIniciais.map((faina) => faina.codigo)).size)
      .toBe(fainasCctIniciais.length);
    expect(fainasCctIniciais.every((faina) => faina.fonte === 'CCT'))
      .toBe(true);
    expect(fainasCctIniciais.every((faina) => faina.status === 'PROVISORIA'))
      .toBe(true);
    expect(fainasCctIniciais.every((faina) => faina.referencia.includes('Analise_CCT_Calculadora_Terno_Portuario (1).xlsx')))
      .toBe(true);
  });
});

describe('produção mínima garantida', () => {
  const base = fainasActProvisorias.find((registro) => registro.codigoDaTabela === '3.1')!;
  const comPiso: RegistroDeFaina = {
    ...base,
    regraActProvisoria: { ...base.regraActProvisoria!, producaoMinimaPorTernoPorPeriodo: 400 },
  };
  const diaNormal = { ...periodo, data: data(2026, 9, 8), identificador: '07-13' };

  function custoDe(registro: RegistroDeFaina, producao: number, ternos: number): number {
    return new CatalogoPortmac([registro]).calcularCustoDoPeriodo({
      faina: registro,
      periodo: diaNormal,
      producaoToneladas: producao,
      ternos,
    }).total;
  }

  it('nenhuma faina do catálogo declara piso, então o cálculo atual não muda', () => {
    const declaram = [...fainasActProvisorias, ...fainasCctProvisorias].filter((registro) =>
      (registro.regraActProvisoria ?? registro.regraCctProvisoria)?.producaoMinimaPorTernoPorPeriodo !== undefined);
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
