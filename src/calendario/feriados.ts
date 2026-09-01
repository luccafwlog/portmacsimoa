import type { DataLocal } from '../dominio/tempo.js';

/** Feriados nacionais listados no calendário de Vila Velha usado pelo simulador. */
const FERIADOS_NACIONAIS_FIXOS = new Set([
  '01-01', // Confraternização Universal
  '04-18', // Paixão de Cristo
  '04-21', // Tiradentes
  '05-01', // Dia Mundial do Trabalho
  '09-07', // Independência do Brasil
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '11-20', // Dia Nacional de Zumbi e da Consciência Negra
  '12-25', // Natal
]);

/** Feriados municipais de Vila Velha conforme o calendário de referência de 2025, transpostos para 2026. */
const FERIADOS_MUNICIPAIS_VILA_VELHA = new Set([
  '04-28', // Nossa Senhora da Penha
  '05-23', // Colonização do Solo Espírito-Santense
  '06-19', // Corpus Christi
]);

export function ehFeriadoNacional(data: DataLocal): boolean {
  return FERIADOS_NACIONAIS_FIXOS.has(`${String(data.mes).padStart(2, '0')}-${String(data.dia).padStart(2, '0')}`);
}

export function ehFeriadoVilaVelha(data: DataLocal): boolean {
  const chave = `${String(data.mes).padStart(2, '0')}-${String(data.dia).padStart(2, '0')}`;
  return FERIADOS_NACIONAIS_FIXOS.has(chave) || FERIADOS_MUNICIPAIS_VILA_VELHA.has(chave);
}
