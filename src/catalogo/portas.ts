import type { DataLocal } from '../dominio/tempo.js';
import type {
  Categoria,
  ComposicaoDeEquipe,
  Cobertura,
  Faina,
  Instrumento,
  Remuneracao,
} from '../dominio/tipos.js';

/**
 * O catálogo, visto pelo motor de cálculo.
 *
 * Toda consulta é datada: uma linha de catálogo vale de uma data a outra, e a
 * simulação precisa continuar reproduzível depois que os acordos forem
 * renovados (#12). Não existe leitura "do catálogo atual" — só do catálogo
 * numa data.
 *
 * O motor depende desta interface e de mais nada. Trocar o mapa em memória por
 * um banco é implementar isto de novo; o cálculo não muda uma linha.
 */
export interface Catalogo {
  faina(codigo: string, em: DataLocal): Faina | undefined;

  /**
   * Qual instrumento rege este par, na data.
   *
   * O default é CCT — e não por conveniência nossa: a Cláusula Décima Terceira
   * do ACT e o item 3-E do ANEXO III mandam que tudo que o acordo não alcança
   * seja regido pela convenção (#9).
   */
  instrumentoAplicavel(
    faina: string,
    categoria: Categoria,
    em: DataLocal,
  ): Instrumento;

  composicaoDeEquipe(
    instrumento: Instrumento,
    faina: string,
    categoria: Categoria,
    em: DataLocal,
  ): ComposicaoDeEquipe | undefined;

  remuneracao(
    instrumento: Instrumento,
    faina: string,
    categoria: Categoria,
    em: DataLocal,
  ): Remuneracao | undefined;

  /** As categorias que esta faina requisita, na data. */
  categoriasDaFaina(faina: string, em: DataLocal): readonly Categoria[];
}

export interface DadosDeCatalogo {
  readonly fainas: readonly Faina[];
  readonly coberturas: readonly Cobertura[];
  readonly composicoes: readonly ComposicaoDeEquipe[];
  readonly remuneracoes: readonly Remuneracao[];
}
