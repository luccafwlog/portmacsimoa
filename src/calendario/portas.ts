import type { InicioDaOperacao, PeriodoOgmo } from '../dominio/tipos.js';

/**
 * Dependência das regras de jornada e calendário do OGMO.
 *
 * O início é declarado como data + período. O calendário decide como os
 * períodos seguintes são identificados e quais multiplicadores possuem.
 */
export interface CalendarioOgmo {
  projetar(inicio: InicioDaOperacao, quantidade: number): readonly PeriodoOgmo[];
}
