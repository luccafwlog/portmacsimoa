import { describe, expect, it } from 'vitest';
import { calendarioOperacional } from '../src/calendario/operacional.js';
import { data } from '../src/dominio/tempo.js';

describe('calendário operacional', () => {
  it('avança a data depois do período 19-01', () => {
    const periodos = calendarioOperacional.projetar(
      { data: data(2026, 9, 4), periodo: '19-01' },
      3,
    );

    expect(periodos.map((periodo) => `${periodo.identificador}/${periodo.data.dia}`)).toEqual([
      '19-01/4',
      '01-07/5',
      '07-13/5',
    ]);
  });

  it('mantém quatro faixas no mesmo dia antes de avançar', () => {
    const periodos = calendarioOperacional.projetar(
      { data: data(2026, 9, 4), periodo: '01-07' },
      5,
    );

    expect(periodos.map((periodo) => `${periodo.identificador}/${periodo.data.dia}`)).toEqual([
      '01-07/4',
      '07-13/4',
      '13-19/4',
      '19-01/4',
      '01-07/5',
    ]);
  });
});
