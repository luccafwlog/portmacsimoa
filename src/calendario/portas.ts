import type { DataLocal } from '../dominio/tempo.js';
import type { ClasseDeDia } from '../dominio/tipos.js';

/**
 * O calendário OGMO, visto pelo motor.
 *
 * É o que transforma "o navio começa dia 12 às 19h" em "períodos 3 e 4 de um
 * sábado, mais 1 a 4 de um domingo" — e é isso, não o volume, que faz o mesmo
 * navio custar valores diferentes conforme quando atraca (#10).
 *
 * A interface é deliberadamente estreita: uma data entra, uma classe sai. Se o
 * calendário real trouxer mais do que feriados — escala de revezamento, dias
 * sem operação — isso vira métodos novos aqui, sem tocar no cálculo.
 */
export interface CalendarioOgmo {
  classeDoDia(d: DataLocal): ClasseDeDia;

  /**
   * Até quando este calendário responde.
   *
   * Extrapolar seria mais cômodo e menos honesto: uma cotação para além do
   * horizonte precisa recusar, não chutar (#10, item 6).
   */
  cobre(d: DataLocal): boolean;
}
