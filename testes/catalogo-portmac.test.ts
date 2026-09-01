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
