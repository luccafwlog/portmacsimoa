import type { ComposicaoDeEquipe, PosicaoDeEquipe } from '../dominio/tipos.js';
import type { PoliticasDeCalculo } from './politicas.js';

/** Uma posição já dimensionada para a quantidade de ternos da operação. */
export interface PosicaoDimensionada {
  readonly posicao: PosicaoDeEquipe;
  /** Quantos trabalhadores esta posição coloca na operação inteira. */
  readonly efetivo: number;
}

/**
 * Dimensiona a equipe para N ternos.
 *
 * O ponto do #16 em uma linha: **um terno a mais não multiplica a equipe
 * inteira**. Conferente chefe e ajudante são por navio e não se mexem; o
 * conferente de lingada e a equipe de estiva escalam por terno.
 */
export function dimensionarEquipe(
  composicao: ComposicaoDeEquipe,
  ternos: number,
  politicas: PoliticasDeCalculo,
): readonly PosicaoDimensionada[] {
  return composicao.posicoes
    .filter((p) => politicas.incluirHomensExtras || p.facultativa !== true)
    .map((posicao) => ({
      posicao,
      efetivo:
        posicao.escala === 'POR_TERNO'
          ? posicao.quantidade * ternos
          : posicao.quantidade,
    }));
}

export function totalDeTrabalhadores(
  posicoes: readonly PosicaoDimensionada[],
): number {
  return posicoes.reduce((soma, p) => soma + p.efetivo, 0);
}

/** Soma das cotas de toda a equipe — o denominador do rateio na taxa-equipe. */
export function totalDeCotas(posicoes: readonly PosicaoDimensionada[]): number {
  return posicoes.reduce((soma, p) => soma + p.efetivo * p.posicao.cota, 0);
}
