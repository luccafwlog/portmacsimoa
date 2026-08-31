import { compararDatas, type DataLocal } from '../dominio/tempo.js';
import type { Vigencia } from '../dominio/tipos.js';

export function vigenteEm(v: Vigencia, em: DataLocal): boolean {
  if (compararDatas(em, v.de) < 0) return false;
  if (v.ate !== null && compararDatas(em, v.ate) > 0) return false;
  return true;
}

/**
 * Entre linhas vigentes na mesma data, vence a de início mais recente.
 *
 * Isso dá de graça o comportamento de correção: cadastrar uma versão nova com
 * início igual ou posterior substitui a anterior sem apagar o histórico, que é
 * o que a reprodutibilidade exige (#12, item 4).
 */
export function maisEspecifica<T extends { vigencia: Vigencia }>(
  candidatos: readonly T[],
  em: DataLocal,
): T | undefined {
  let escolhido: T | undefined;
  for (const c of candidatos) {
    if (!vigenteEm(c.vigencia, em)) continue;
    if (escolhido === undefined || compararDatas(c.vigencia.de, escolhido.vigencia.de) > 0) {
      escolhido = c;
    }
  }
  return escolhido;
}
