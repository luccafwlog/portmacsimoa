import { formatarData, somarDias, type DataLocal } from '../dominio/tempo.js';

export interface Feriado {
  readonly data: DataLocal;
  readonly nome: string;
  readonly esfera: 'NACIONAL' | 'ESTADUAL' | 'MUNICIPAL' | 'CATEGORIA';
  /**
   * Marca o que ainda não foi confirmado contra o calendário oficial do OGMO.
   *
   * Nada aqui é fonte canônica. Quando o calendário do #10 chegar, ele
   * substitui esta lista inteira — e a distinção entre confirmado e provisório
   * é o que impede que um palpite nosso vire dado de cotação.
   */
  readonly provisorio: boolean;
}

/** Domingo de Páscoa pelo algoritmo de Meeus/Butcher (calendário gregoriano). */
export function domingoDePascoa(ano: number): DataLocal {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { ano, mes, dia };
}

/**
 * Feriados nacionais de data fixa, mais os móveis derivados da Páscoa.
 *
 * **Provisório por inteiro.** Faltam os estaduais do ES, os municipais de
 * Vitória e os da categoria portuária — e é justamente o feriado municipal que
 * ninguém lembra que estoura uma cotação. Isto existe para o motor ter o que
 * consumir enquanto o #10 não fecha, não para ser a verdade.
 */
export function feriadosProvisorios(ano: number): readonly Feriado[] {
  const pascoa = domingoDePascoa(ano);
  const fixos: readonly [number, number, string][] = [
    [1, 1, 'Confraternização Universal'],
    [4, 21, 'Tiradentes'],
    [5, 1, 'Dia do Trabalho'],
    [9, 7, 'Independência'],
    [10, 12, 'Nossa Senhora Aparecida'],
    [11, 2, 'Finados'],
    [11, 15, 'Proclamação da República'],
    [11, 20, 'Consciência Negra'],
    [12, 25, 'Natal'],
  ];

  const moveis: readonly [DataLocal, string][] = [
    [somarDias(pascoa, -48), 'Carnaval (segunda)'],
    [somarDias(pascoa, -47), 'Carnaval (terça)'],
    [somarDias(pascoa, -2), 'Sexta-feira da Paixão'],
    [somarDias(pascoa, 60), 'Corpus Christi'],
  ];

  return [
    ...fixos.map(([mes, dia, nome]) => ({
      data: { ano, mes, dia },
      nome,
      esfera: 'NACIONAL' as const,
      provisorio: true,
    })),
    ...moveis.map(([data, nome]) => ({
      data,
      nome,
      esfera: 'NACIONAL' as const,
      provisorio: true,
    })),
  ];
}

export function chaveDeFeriado(d: DataLocal): string {
  return formatarData(d);
}
