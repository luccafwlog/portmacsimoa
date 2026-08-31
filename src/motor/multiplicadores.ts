import type { ClasseDeDia, Turno } from '../dominio/tipos.js';

/**
 * O multiplicador de período — ACT, Cláusula Sexta e §1º.
 *
 * Os oito valores documentados:
 *
 * | Quando            | Adicional  | Multiplicador |
 * |-------------------|------------|---------------|
 * | Comum 7h–19h      | —          | 1,0           |
 * | Comum 19h–7h      | 25%        | 1,25          |
 * | Sábado 7h–19h     | —          | 1,0           |
 * | Sábado 19h–7h     | 87,50%     | 1,875         |
 * | Domingo 7h–19h    | 87,50%     | 1,875         |
 * | Domingo 19h–7h    | 134,375%   | 2,34375       |
 * | Feriado 7h–19h    | 100%       | 2,0           |
 * | Feriado 19h–7h    | 150%       | 2,5           |
 *
 * ## O sábado noturno não fecha com a fórmula simples
 *
 * O mapa (#1) enuncia `multiplicador = (1 + adicional_do_dia) × (1,25 se
 * noturno)`, com adicional 0% em sábado. Isso daria **1,25** no sábado
 * noturno, contra os **1,875** da tabela — uma diferença de 50% no custo de
 * toda madrugada de sábado, que é justamente quando navio costuma operar.
 *
 * A composição só fecha se o adicional de dia do sábado **mudar de 0% para
 * 50% à noite**: `1,50 × 1,25 = 1,875`. Nas outras três classes o adicional é
 * o mesmo nos dois turnos e o fator noturno de 1,25 se aplica limpo:
 * `1,875 × 1,25 = 2,34375` e `2,0 × 1,25 = 2,5`.
 *
 * Por isso o adicional aqui é função de `(classe, turno)`, não da classe
 * sozinha. Os oito valores continuam saindo de uma regra composta — mas a
 * irregularidade do sábado fica à vista em vez de virar erro de digitação.
 *
 * Se a leitura correta for outra (por exemplo, que a jornada 19h–7h de sábado
 * já conta como domingo), o resultado numérico é o mesmo e só o nome muda.
 * Fica registrado para confirmar com o diretor.
 */
export const FATOR_NOTURNO = 1.25;

/** Adicional do dia, por classe e turno, em fração. */
export function adicionalDoDia(classe: ClasseDeDia, turno: Turno): number {
  switch (classe) {
    case 'COMUM':
      return 0;
    case 'SABADO':
      return turno === 'NOTURNO' ? 0.5 : 0;
    case 'DOMINGO':
      return 0.875;
    case 'FERIADO':
      return 1;
  }
}

export function multiplicadorDePeriodo(
  classe: ClasseDeDia,
  turno: Turno,
): number {
  const base = 1 + adicionalDoDia(classe, turno);
  return turno === 'NOTURNO' ? base * FATOR_NOTURNO : base;
}
