import { describe, expect, it } from 'vitest';
import { data } from '../src/dominio/tempo.js';
import { CatalogoEmMemoria } from '../src/catalogo/memoria.js';
import { CATALOGO_SEMENTE } from '../src/catalogo/semente.js';
import type { Faina } from '../src/dominio/tipos.js';

const catalogo = new CatalogoEmMemoria(CATALOGO_SEMENTE);
const durante = data(2026, 7, 6);

/**
 * A matriz de cobertura é esparsa: uma lista curta de exceções ACT sobre um
 * default CCT que a própria norma impõe (#9).
 */
describe('instrumento aplicável ao par (faina, categoria)', () => {
  it('estiva em granito é ACT — é uma das oito fainas do acordo', () => {
    expect(catalogo.instrumentoAplicavel('5.1', 'ESTIVADORES', durante)).toBe('ACT');
  });

  it('conferência em granito é ACT', () => {
    expect(catalogo.instrumentoAplicavel('5.1', 'CONFERENTES', durante)).toBe('ACT');
  });

  it.each(['ARRUMADORES', 'VIGIAS', 'SUPORTE'] as const)(
    '%s é CCT mesmo numa faina que o ACT cobre — o acordo não representa a categoria',
    (categoria) => {
      expect(catalogo.instrumentoAplicavel('5.1', categoria, durante)).toBe('CCT');
    },
  );

  it('uma carga que ninguém cadastrou cai na CCT, sem recusar', () => {
    expect(catalogo.instrumentoAplicavel('99.9', 'ESTIVADORES', durante)).toBe('CCT');
  });

  it('antes da vigência do ACT o mesmo par volta a ser CCT', () => {
    expect(
      catalogo.instrumentoAplicavel('5.1', 'ESTIVADORES', data(2026, 5, 31)),
    ).toBe('CCT');
  });

  it('depois de 30/06/2028 o ACT também deixa de alcançar', () => {
    expect(
      catalogo.instrumentoAplicavel('5.1', 'ESTIVADORES', data(2028, 7, 1)),
    ).toBe('CCT');
  });
});

/**
 * A faina também é datada.
 *
 * A CCT sucessora pode renumerar fainas ou mudar a unidade de uma carga
 * ([#9](https://github.com/luccafwlog/portmacsimoa/issues/9) deixou essa
 * pergunta em aberto). Se a busca ignorasse a data, uma simulação antiga
 * passaria a ser lida com a unidade nova — e trocar TON por UND troca o
 * significado do número-título inteiro.
 */
describe('versionamento da própria faina', () => {
  const antiga: Faina = {
    codigo: 'X',
    descricao: 'Carga X, medida em tonelada',
    unidade: 'TON',
    vigencia: { de: data(2026, 1, 1), ate: data(2026, 12, 31) },
  };
  const nova: Faina = {
    codigo: 'X',
    descricao: 'Carga X, remedida em unidade',
    unidade: 'UND',
    vigencia: { de: data(2027, 1, 1), ate: null },
  };
  const versionado = new CatalogoEmMemoria({
    fainas: [antiga, nova],
    coberturas: [],
    composicoes: [],
    remuneracoes: [],
  });

  it('devolve a versão vigente na data pedida', () => {
    expect(versionado.faina('X', data(2026, 6, 1))?.unidade).toBe('TON');
    expect(versionado.faina('X', data(2027, 6, 1))?.unidade).toBe('UND');
  });

  it('não devolve nada antes da primeira vigência', () => {
    expect(versionado.faina('X', data(2025, 12, 31))).toBeUndefined();
  });
});
