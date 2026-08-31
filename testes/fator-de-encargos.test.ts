import { describe, expect, it } from 'vitest';
import { FATOR_ENCARGOS, totalComEncargos } from '../src/catalogo/semente.js';

/**
 * O fator 2,152842 é o conversor entre a coluna `Base` e a coluna
 * `Total c/E.S`, e é `Total c/E.S` que a PORTMAC paga (#11).
 *
 * Estes quatro pontos foram conferidos contra o ANEXO I do ACT. Se algum dia
 * um deles quebrar, ou o fator mudou no acordo novo ou alguém digitou errado —
 * e nos dois casos é isto que precisa gritar primeiro.
 */
describe('fator de encargos do ANEXO I', () => {
  it('vale 2,152842', () => {
    expect(FATOR_ENCARGOS).toBe(2.152842);
  });

  it.each([
    ['taxa homem, estiva, granito', 0.46, 0.99],
    ['salário-dia, estiva, granito', 190.51, 410.14],
    ['taxa equipe, conferente, granito', 1.399, 3.01],
    ['taxa de granéis', 0.223, 0.48],
  ])('deriva %s: %f → %f', (_nome, base, publicado) => {
    expect(totalComEncargos(base)).toBeCloseTo(publicado, 2);
  });
});
