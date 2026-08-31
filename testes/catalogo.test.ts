import { describe, expect, it } from 'vitest';
import { data } from '../src/dominio/tempo.js';
import { CatalogoEmMemoria } from '../src/catalogo/memoria.js';
import { CATALOGO_SEMENTE } from '../src/catalogo/semente.js';

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
