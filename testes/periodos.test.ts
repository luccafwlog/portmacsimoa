import { describe, expect, it } from 'vitest';
import { instante } from '../src/dominio/tempo.js';
import { calendarioProvisorio } from '../src/calendario/calendario.js';
import { POLITICAS_PADRAO, comPoliticas } from '../src/motor/politicas.js';
import {
  ForaDoHorizonteDoCalendario,
  janelaQueContem,
  projetarPeriodos,
} from '../src/motor/periodos.js';

const calendario = calendarioProvisorio(2026, 2028);

describe('ancoragem do instante no período', () => {
  it('19h30 de um sábado é a jornada noturna que começa no sábado', () => {
    // 2026-07-11 é sábado.
    const j = janelaQueContem(instante(2026, 7, 11, 19, 30));
    expect(j).toEqual({ diaDeInicio: { ano: 2026, mes: 7, dia: 11 }, turno: 'NOTURNO' });
  });

  it('3h da manhã de domingo ainda é a jornada noturna do sábado', () => {
    const j = janelaQueContem(instante(2026, 7, 12, 3, 0));
    expect(j).toEqual({ diaDeInicio: { ano: 2026, mes: 7, dia: 11 }, turno: 'NOTURNO' });
  });

  it('9h é a jornada diurna do próprio dia', () => {
    const j = janelaQueContem(instante(2026, 7, 12, 9, 0));
    expect(j).toEqual({ diaDeInicio: { ano: 2026, mes: 7, dia: 12 }, turno: 'DIURNO' });
  });
});

describe('projeção da linha do tempo', () => {
  it('atravessa o fim de semana com as classes e multiplicadores certos', () => {
    // Sábado 11/07/2026 às 19h, quatro períodos.
    const periodos = projetarPeriodos(
      instante(2026, 7, 11, 19, 0),
      4,
      calendario,
      POLITICAS_PADRAO,
    );

    expect(periodos.map((p) => [p.classeDeDia, p.turno, p.multiplicador])).toEqual([
      ['SABADO', 'NOTURNO', 1.875],
      ['DOMINGO', 'DIURNO', 1.875],
      ['DOMINGO', 'NOTURNO', 2.34375],
      ['COMUM', 'DIURNO', 1],
    ]);
  });

  it('7 de setembro cai como feriado, não como dia comum', () => {
    // 2026-09-07 é segunda-feira.
    const [periodo] = projetarPeriodos(
      instante(2026, 9, 7, 7, 0),
      1,
      calendario,
      POLITICAS_PADRAO,
    );
    expect(periodo?.classeDeDia).toBe('FERIADO');
    expect(periodo?.multiplicador).toBe(2);
  });

  it('a política do noturno muda a classe do período que atravessa a meia-noite', () => {
    const porTermino = projetarPeriodos(
      instante(2026, 7, 11, 19, 0),
      1,
      calendario,
      comPoliticas({ classeDoPeriodoNoturno: 'DIA_DE_TERMINO' }),
    );
    // A mesma jornada, classificada pelo domingo em que termina.
    expect(porTermino[0]?.classeDeDia).toBe('DOMINGO');
    expect(porTermino[0]?.multiplicador).toBeCloseTo(2.34375, 6);
  });

  it('recusa em vez de extrapolar além do horizonte do calendário', () => {
    const curto = calendarioProvisorio(2026, 2026);
    expect(() =>
      projetarPeriodos(instante(2026, 12, 31, 19, 0), 4, curto, POLITICAS_PADRAO),
    ).toThrow(ForaDoHorizonteDoCalendario);
  });
});
