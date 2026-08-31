import { describe, expect, it } from 'vitest';
import { data } from '../src/dominio/tempo.js';
import type { PeriodoOgmo } from '../src/dominio/tipos.js';
import {
  CatalogoPortmac,
  fainasActIniciais,
  type RegistroDeFaina,
} from '../src/catalogo/portmac.js';

const periodo: PeriodoOgmo = {
  indice: 0,
  data: data(2026, 9, 4),
  identificador: '01-07',
};

describe('catálogo documental do PORTMAC', () => {
  it('lista somente fainas cadastradas na primeira fatia da ACT', () => {
    const catalogo = new CatalogoPortmac(fainasActIniciais);

    expect(catalogo.listarFainas().map((faina) => faina.codigo)).toEqual([
      'GRANITO',
      'PRODUTO_SIDERURGICO',
      'TUBOS_E_TRILHOS',
    ]);
  });

  it('prioriza a ACT quando a mesma faina também aparece na CCT', () => {
    const act = fainasActIniciais[0]!;
    const cct: RegistroDeFaina = { ...act, fonte: 'CCT', vigencia: 'teste CCT' };
    const catalogo = new CatalogoPortmac([act], [cct]);

    expect(catalogo.obterFaina('GRANITO')?.fonte).toBe('ACT');
    expect(catalogo.listarFainas()).toHaveLength(1);
  });

  it('calcula a primeira faina com as taxas e cotas cadastradas', () => {
    const catalogo = new CatalogoPortmac(fainasActIniciais);
    const faina = catalogo.obterFaina('GRANITO')!;

    const custo = catalogo.calcularCustoDoPeriodo({
      faina,
      periodo,
      producaoToneladas: 10,
      ternos: 2,
    });

    expect(custo.total).toBeCloseTo(104.35, 2);
    expect(custo.memoria[2]?.descricao).toContain('ACT');
  });
});
