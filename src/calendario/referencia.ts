import { diaDaSemana, somarDias, type DataLocal } from '../dominio/tempo.js';
import { ehFeriadoVilaVelha } from './feriados.js';

/**
 * Calendário neutro para comparar fainas entre si.
 *
 * O custo por unidade de uma operação depende de onde os feriados e os fins de
 * semana caem: a mesma faina, com o mesmo volume e os mesmos ternos, tem ótimo
 * em 500 t começando na véspera de um feriado e em 1.600 t começando em uma
 * semana limpa. Uma curva que se proponha a descrever *a faina* precisa então
 * fixar o calendário, ou estará descrevendo a data.
 *
 * A referência é a primeira segunda-feira, a partir de uma âncora fixa, sem
 * feriado na janela que a varredura alcança. O fim de semana natural continua
 * lá — operações longas realmente o atravessam, e escondê-lo tornaria a
 * referência otimista.
 */

/** Âncora do calendário de referência; qualquer data anterior à busca serve. */
const ANCORA: DataLocal = { ano: 2026, mes: 1, dia: 1 };

/** Janela varrida pela curva de referência: 24 períodos são 6 dias. */
export const DIAS_SEM_FERIADO_NA_REFERENCIA = 21;

export function dataDeReferenciaNeutra(): DataLocal {
  for (let deslocamento = 0; deslocamento < 366; deslocamento += 1) {
    const candidata = somarDias(ANCORA, deslocamento);
    if (diaDaSemana(candidata) !== 'SEGUNDA') continue;
    if (janelaLimpa(candidata)) return candidata;
  }
  // Um ano inteiro sem uma janela limpa significaria um calendário quebrado.
  throw new Error('Nenhuma segunda-feira sem feriado encontrada para a referência.');
}

function janelaLimpa(inicio: DataLocal): boolean {
  for (let dia = 0; dia <= DIAS_SEM_FERIADO_NA_REFERENCIA; dia += 1) {
    if (ehFeriadoVilaVelha(somarDias(inicio, dia))) return false;
  }
  return true;
}
