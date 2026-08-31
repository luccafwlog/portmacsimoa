import type { DataLocal } from '../dominio/tempo.js';
import type {
  Categoria,
  ComposicaoDeEquipe,
  Faina,
  Instrumento,
  Remuneracao,
} from '../dominio/tipos.js';
import type { Catalogo, DadosDeCatalogo } from './portas.js';
import { maisEspecifica, vigenteEm } from './vigencia.js';

/**
 * Catálogo em memória, alimentado por dados literais.
 *
 * É a implementação que o dossiê (#2) vai preencher à medida que as tabelas
 * forem digitadas. Como os PDFs são escaneados e sem camada de texto, a carga
 * será digitação revisada, não importação — então vale que os dados sejam
 * apenas literais TypeScript, conferíveis linha a linha contra o documento.
 */
export class CatalogoEmMemoria implements Catalogo {
  constructor(private readonly dados: DadosDeCatalogo) {}

  faina(codigo: string, em: DataLocal): Faina | undefined {
    return maisEspecifica(
      this.dados.fainas.filter((f) => f.codigo === codigo),
      em,
    );
  }

  instrumentoAplicavel(
    faina: string,
    categoria: Categoria,
    em: DataLocal,
  ): Instrumento {
    const excecao = maisEspecifica(
      this.dados.coberturas.filter(
        (c) => c.faina === faina && c.categoria === categoria,
      ),
      em,
    );
    // Ausência de exceção não é ausência de resposta: a norma manda cair na CCT.
    return excecao?.instrumento ?? 'CCT';
  }

  composicaoDeEquipe(
    instrumento: Instrumento,
    faina: string,
    categoria: Categoria,
    em: DataLocal,
  ): ComposicaoDeEquipe | undefined {
    return maisEspecifica(
      this.dados.composicoes.filter(
        (c) =>
          c.instrumento === instrumento &&
          c.faina === faina &&
          c.categoria === categoria,
      ),
      em,
    );
  }

  remuneracao(
    instrumento: Instrumento,
    faina: string,
    categoria: Categoria,
    em: DataLocal,
  ): Remuneracao | undefined {
    return maisEspecifica(
      this.dados.remuneracoes.filter(
        (r) =>
          r.instrumento === instrumento &&
          r.faina === faina &&
          r.categoria === categoria,
      ),
      em,
    );
  }

  categoriasDaFaina(faina: string, em: DataLocal): readonly Categoria[] {
    const vistas = new Set<Categoria>();
    for (const c of this.dados.composicoes) {
      if (c.faina === faina && vigenteEm(c.vigencia, em)) vistas.add(c.categoria);
    }
    return [...vistas];
  }
}
