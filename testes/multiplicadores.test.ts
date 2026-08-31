import { describe, expect, it } from 'vitest';
import {
  FATOR_NOTURNO,
  multiplicadorDePeriodo,
} from '../src/motor/multiplicadores.js';
import type { ClasseDeDia, Turno } from '../src/dominio/tipos.js';

/** Os oito valores da Cláusula Sexta do ACT, um a um. */
describe('multiplicador de período', () => {
  const casos: [ClasseDeDia, Turno, number][] = [
    ['COMUM', 'DIURNO', 1],
    ['COMUM', 'NOTURNO', 1.25],
    ['SABADO', 'DIURNO', 1],
    ['SABADO', 'NOTURNO', 1.875],
    ['DOMINGO', 'DIURNO', 1.875],
    ['DOMINGO', 'NOTURNO', 2.34375],
    ['FERIADO', 'DIURNO', 2],
    ['FERIADO', 'NOTURNO', 2.5],
  ];

  it.each(casos)('%s %s → %f', (classe, turno, esperado) => {
    expect(multiplicadorDePeriodo(classe, turno)).toBeCloseTo(esperado, 6);
  });

  /**
   * O fator noturno de 1,25 compõe limpo em três das quatro classes.
   *
   * No sábado não compõe: 1,0 × 1,25 daria 1,25, e a tabela diz 1,875. Este
   * teste marca a fronteira entre a regra e a exceção, para que a exceção não
   * se perca quando alguém "simplificar" a fórmula.
   */
  it.each<ClasseDeDia>(['COMUM', 'DOMINGO', 'FERIADO'])(
    'em %s o noturno é o diurno × 1,25',
    (classe) => {
      expect(multiplicadorDePeriodo(classe, 'NOTURNO')).toBeCloseTo(
        multiplicadorDePeriodo(classe, 'DIURNO') * FATOR_NOTURNO,
        6,
      );
    },
  );

  it('no sábado o noturno não é o diurno × 1,25 — é a exceção documentada', () => {
    expect(multiplicadorDePeriodo('SABADO', 'NOTURNO')).not.toBeCloseTo(
      multiplicadorDePeriodo('SABADO', 'DIURNO') * FATOR_NOTURNO,
      6,
    );
  });
});
