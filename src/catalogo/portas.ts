import type {
  ContextoDeCustoDoPeriodo,
  CustoDoPeriodo,
  FainaCatalogada,
} from '../dominio/tipos.js';

/**
 * Dependência do cálculo em relação aos valores e regras do OGMO.
 *
 * A implementação oficial ainda será fornecida quando o catálogo for
 * conferido. O motor conhece somente esta porta; ele não contém tarifas,
 * pisos, adicionais ou composição de equipe.
 */
export interface CatalogoOgmo {
  obterFaina(codigo: string): FainaCatalogada | undefined;
  calcularCustoDoPeriodo(contexto: ContextoDeCustoDoPeriodo): CustoDoPeriodo;
}
