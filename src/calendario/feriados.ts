import type { DataLocal } from '../dominio/tempo.js';

/** Feriados nacionais civis com data fixa reconhecidos no calendário brasileiro. */
const FERIADOS_NACIONAIS_FIXOS = new Set([
  '01-01', // Confraternização Universal
  '04-21', // Tiradentes
  '05-01', // Dia Mundial do Trabalho
  '09-07', // Independência do Brasil
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '11-20', // Dia Nacional de Zumbi e da Consciência Negra
  '12-25', // Natal
]);

export function ehFeriadoNacional(data: DataLocal): boolean {
  return FERIADOS_NACIONAIS_FIXOS.has(`${String(data.mes).padStart(2, '0')}-${String(data.dia).padStart(2, '0')}`);
}
