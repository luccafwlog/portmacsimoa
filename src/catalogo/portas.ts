import type {
  ContextoDeCustoDoPeriodo,
  CustoDoPeriodo,
  FainaCatalogada,
} from '../dominio/tipos.js';

/** Dependência do cálculo em relação ao catálogo documental do OGMO. */
export interface CatalogoOgmo {
  listarFainas(): readonly FainaCatalogada[];
  obterFaina(codigo: string): FainaCatalogada | undefined;
  calcularCustoDoPeriodo(contexto: ContextoDeCustoDoPeriodo): CustoDoPeriodo;
}
