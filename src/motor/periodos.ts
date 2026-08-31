import {
  apenasData,
  somarDias,
  type DataLocal,
  type InstanteLocal,
} from '../dominio/tempo.js';
import type { ClasseDeDia, Turno } from '../dominio/tipos.js';
import type { CalendarioOgmo } from '../calendario/portas.js';
import { multiplicadorDePeriodo } from './multiplicadores.js';
import type { PoliticasDeCalculo } from './politicas.js';

/** Jornadas do ACT: 7h–19h e 19h–7h. Dois períodos por dia. */
export const HORA_INICIO_DIURNO = 7;
export const HORA_INICIO_NOTURNO = 19;
export const HORAS_POR_PERIODO = 12;

/** Um período identificado pelo dia em que a jornada começa e pelo turno. */
export interface JanelaDePeriodo {
  readonly diaDeInicio: DataLocal;
  readonly turno: Turno;
}

export interface PeriodoRequisitado {
  readonly indice: number;
  readonly janela: JanelaDePeriodo;
  readonly turno: Turno;
  readonly inicio: InstanteLocal;
  readonly fim: InstanteLocal;
  /** Dia efetivamente usado para classificar — ver `classeDoPeriodoNoturno`. */
  readonly diaDeClassificacao: DataLocal;
  readonly classeDeDia: ClasseDeDia;
  readonly multiplicador: number;
}

/**
 * O período que contém um instante.
 *
 * A granularidade da requisição é o período, não a hora (#8, item 7): pedir
 * 21h30 e pedir 19h é pedir a mesma jornada noturna. O instante informado é
 * ancorado para baixo, no início do período que o contém.
 */
export function janelaQueContem(i: InstanteLocal): JanelaDePeriodo {
  const dia = apenasData(i);
  if (i.hora < HORA_INICIO_DIURNO) {
    // Madrugada pertence à jornada noturna que começou no dia anterior.
    return { diaDeInicio: somarDias(dia, -1), turno: 'NOTURNO' };
  }
  if (i.hora < HORA_INICIO_NOTURNO) return { diaDeInicio: dia, turno: 'DIURNO' };
  return { diaDeInicio: dia, turno: 'NOTURNO' };
}

export function proximaJanela(j: JanelaDePeriodo): JanelaDePeriodo {
  return j.turno === 'DIURNO'
    ? { diaDeInicio: j.diaDeInicio, turno: 'NOTURNO' }
    : { diaDeInicio: somarDias(j.diaDeInicio, 1), turno: 'DIURNO' };
}

export function inicioDaJanela(j: JanelaDePeriodo): InstanteLocal {
  const hora = j.turno === 'DIURNO' ? HORA_INICIO_DIURNO : HORA_INICIO_NOTURNO;
  return { ...j.diaDeInicio, hora, minuto: 0 };
}

export function fimDaJanela(j: JanelaDePeriodo): InstanteLocal {
  if (j.turno === 'DIURNO') {
    return { ...j.diaDeInicio, hora: HORA_INICIO_NOTURNO, minuto: 0 };
  }
  return { ...somarDias(j.diaDeInicio, 1), hora: HORA_INICIO_DIURNO, minuto: 0 };
}

export class ForaDoHorizonteDoCalendario extends Error {
  constructor(readonly dia: DataLocal) {
    super(
      `A operação alcança ${dia.ano}-${dia.mes}-${dia.dia}, além do horizonte do calendário carregado.`,
    );
    this.name = 'ForaDoHorizonteDoCalendario';
  }
}

/**
 * Enumera os períodos consumidos, a partir do início e da quantidade.
 *
 * Recusar além do horizonte é deliberado: extrapolar feriado é o tipo de erro
 * silencioso que só aparece na fatura (#10, item 6).
 */
export function projetarPeriodos(
  inicio: InstanteLocal,
  quantidade: number,
  calendario: CalendarioOgmo,
  politicas: PoliticasDeCalculo,
): readonly PeriodoRequisitado[] {
  const periodos: PeriodoRequisitado[] = [];
  let janela = janelaQueContem(inicio);

  for (let indice = 0; indice < quantidade; indice++) {
    const abertura = inicioDaJanela(janela);
    const encerramento = fimDaJanela(janela);
    const diaDeClassificacao =
      janela.turno === 'NOTURNO' &&
      politicas.classeDoPeriodoNoturno === 'DIA_DE_TERMINO'
        ? apenasData(encerramento)
        : janela.diaDeInicio;

    if (!calendario.cobre(diaDeClassificacao)) {
      throw new ForaDoHorizonteDoCalendario(diaDeClassificacao);
    }

    const classeDeDia = calendario.classeDoDia(diaDeClassificacao);
    periodos.push({
      indice,
      janela,
      turno: janela.turno,
      inicio: abertura,
      fim: encerramento,
      diaDeClassificacao,
      classeDeDia,
      multiplicador: multiplicadorDePeriodo(classeDeDia, janela.turno),
    });
    janela = proximaJanela(janela);
  }

  return periodos;
}
