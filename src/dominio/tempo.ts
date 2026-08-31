/**
 * Tempo civil, sem fuso horário.
 *
 * O simulador raciocina em horário de parede do Porto de Vitória: "dia 12 às 19h"
 * é o período noturno do dia 12, e continua sendo depois de qualquer mudança de
 * fuso ou de horário de verão. Usar `Date` aqui convidaria a um erro silencioso de
 * um período inteiro, que é justamente a unidade em que o custo é cobrado.
 *
 * Toda a aritmética abaixo passa por `Date.UTC`, que é estável, mas nenhum
 * `Date` escapa deste módulo.
 */

export interface DataLocal {
  readonly ano: number;
  /** 1–12. */
  readonly mes: number;
  /** 1–31. */
  readonly dia: number;
}

export interface InstanteLocal extends DataLocal {
  /** 0–23. */
  readonly hora: number;
  /** 0–59. */
  readonly minuto: number;
}

export type DiaDaSemana =
  | 'DOMINGO'
  | 'SEGUNDA'
  | 'TERCA'
  | 'QUARTA'
  | 'QUINTA'
  | 'SEXTA'
  | 'SABADO';

const DIAS: readonly DiaDaSemana[] = [
  'DOMINGO',
  'SEGUNDA',
  'TERCA',
  'QUARTA',
  'QUINTA',
  'SEXTA',
  'SABADO',
];

export function data(ano: number, mes: number, dia: number): DataLocal {
  return { ano, mes, dia };
}

export function instante(
  ano: number,
  mes: number,
  dia: number,
  hora = 0,
  minuto = 0,
): InstanteLocal {
  return { ano, mes, dia, hora, minuto };
}

/** Número de dias desde a época, usado só como representação intermediária. */
function aoDiaSerial(d: DataLocal): number {
  return Date.UTC(d.ano, d.mes - 1, d.dia) / 86_400_000;
}

function doDiaSerial(serial: number): DataLocal {
  const d = new Date(serial * 86_400_000);
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

export function somarDias(d: DataLocal, dias: number): DataLocal {
  return doDiaSerial(aoDiaSerial(d) + dias);
}

export function diaDaSemana(d: DataLocal): DiaDaSemana {
  // 1970-01-01 foi uma quinta-feira.
  const indice = (((aoDiaSerial(d) + 4) % 7) + 7) % 7;
  return DIAS[indice]!;
}

export function mesmaData(a: DataLocal, b: DataLocal): boolean {
  return a.ano === b.ano && a.mes === b.mes && a.dia === b.dia;
}

/** Ordem cronológica: negativo se `a` vem antes de `b`. */
export function compararDatas(a: DataLocal, b: DataLocal): number {
  return aoDiaSerial(a) - aoDiaSerial(b);
}

export function compararInstantes(a: InstanteLocal, b: InstanteLocal): number {
  const dias = compararDatas(a, b);
  if (dias !== 0) return dias;
  return a.hora * 60 + a.minuto - (b.hora * 60 + b.minuto);
}

export function apenasData(i: InstanteLocal): DataLocal {
  return { ano: i.ano, mes: i.mes, dia: i.dia };
}

/** `2026-08-31` — para chaves de mapa e para mensagens legíveis. */
export function formatarData(d: DataLocal): string {
  const mm = String(d.mes).padStart(2, '0');
  const dd = String(d.dia).padStart(2, '0');
  return `${d.ano}-${mm}-${dd}`;
}

export function formatarInstante(i: InstanteLocal): string {
  const hh = String(i.hora).padStart(2, '0');
  const mi = String(i.minuto).padStart(2, '0');
  return `${formatarData(i)} ${hh}:${mi}`;
}
