import type {
  ContextoDeCustoDoPeriodo,
  CustoDoPeriodo,
  FainaCatalogada,
} from '../dominio/tipos.js';
import type { CatalogoOgmo } from './portas.js';

export interface RegraDeCustoPorTonelada {
  /** Taxa total da estiva por tonelada e por cota, sem homens extras. */
  readonly taxaEstivaPorTonelada: number;
  /** Soma das cotas da equipe básica de estiva por terno. */
  readonly cotasEstivaPorTerno: number;
  /** Taxa total da equipe de conferentes por tonelada. */
  readonly taxaConferentesPorTonelada: number;
}

export interface RegistroDeFaina extends FainaCatalogada {
  readonly regra: RegraDeCustoPorTonelada;
}

/**
 * Registros transcritos da primeira fatia conferida da ACT 2026/2028.
 *
 * Os valores incluem encargos e contribuição social conforme a tabela da ACT.
 * Homens extras, peação, granéis, contêineres por unidade e adicionais por
 * jornada ficam fora desta primeira fatia até que suas regras sejam validadas.
 */
export const fainasActIniciais: readonly RegistroDeFaina[] = [
  {
    codigo: 'GRANITO',
    descricao: 'Granito',
    tipoDeCarga: 'Granito',
    unidade: 'TON',
    fonte: 'ACT',
    vigencia: '2026/2028',
    referencia: 'Anexo I e Anexo II · faina 5.1',
    regra: {
      taxaEstivaPorTonelada: 0.99,
      cotasEstivaPorTerno: 7.5,
      taxaConferentesPorTonelada: 3.01,
    },
  },
  {
    codigo: 'PRODUTO_SIDERURGICO',
    descricao: 'Produto siderúrgico',
    tipoDeCarga: 'Produto siderúrgico, exceto tubos e trilhos',
    unidade: 'TON',
    fonte: 'ACT',
    vigencia: '2026/2028',
    referencia: 'Anexo I e Anexo II · faina 5.9',
    regra: {
      taxaEstivaPorTonelada: 0.98,
      cotasEstivaPorTerno: 7.5,
      taxaConferentesPorTonelada: 4,
    },
  },
  {
    codigo: 'TUBOS_E_TRILHOS',
    descricao: 'Tubos e trilhos',
    tipoDeCarga: 'Tubos e trilhos',
    unidade: 'TON',
    fonte: 'ACT',
    vigencia: '2026/2028',
    referencia: 'Anexo I e Anexo II · faina 5.9',
    regra: {
      taxaEstivaPorTonelada: 0.98,
      cotasEstivaPorTerno: 7.5,
      taxaConferentesPorTonelada: 4,
    },
  },
];

/** A CCT será adicionada somente para fainas não cobertas pela ACT. */
export const fainasCctIniciais: readonly RegistroDeFaina[] = [];

export class CatalogoPortmac implements CatalogoOgmo {
  constructor(
    private readonly fainasAct: readonly RegistroDeFaina[],
    private readonly fainasCct: readonly RegistroDeFaina[] = [],
  ) {}

  listarFainas(): readonly FainaCatalogada[] {
    return this.listarRegistros();
  }

  listarRegistros(): readonly RegistroDeFaina[] {
    const fainas = new Map<string, RegistroDeFaina>();
    for (const faina of [...this.fainasAct, ...this.fainasCct]) {
      // ACT sempre vence quando os dois instrumentos possuem o mesmo código.
      if (!fainas.has(faina.codigo) || faina.fonte === 'ACT') {
        fainas.set(faina.codigo, faina);
      }
    }
    return [...fainas.values()];
  }

  obterFaina(codigo: string): FainaCatalogada | undefined {
    return this.obterRegistro(codigo);
  }

  calcularCustoDoPeriodo(contexto: ContextoDeCustoDoPeriodo): CustoDoPeriodo {
    const faina = this.obterRegistro(contexto.faina.codigo);
    if (!faina) {
      throw new Error(`Faina ${contexto.faina.codigo} não está no catálogo.`);
    }

    const custoEstiva =
      contexto.producaoToneladas *
      faina.regra.taxaEstivaPorTonelada *
      faina.regra.cotasEstivaPorTerno;
    const custoConferentes =
      contexto.producaoToneladas * faina.regra.taxaConferentesPorTonelada;
    const total = custoEstiva + custoConferentes;

    return {
      total,
      memoria: [
        {
          descricao: `Estiva · ${faina.regra.taxaEstivaPorTonelada.toFixed(2)} × ${faina.regra.cotasEstivaPorTerno.toString().replace('.', ',')} cotas/terno`,
          valor: custoEstiva,
        },
        {
          descricao: `Conferentes · ${faina.regra.taxaConferentesPorTonelada.toFixed(2)} por tonelada`,
          valor: custoConferentes,
        },
        {
          descricao: `Fonte: ${faina.fonte} · ${faina.referencia}`,
          valor: total,
        },
      ],
    };
  }

  private obterRegistro(codigo: string): RegistroDeFaina | undefined {
    return this.fainasAct.find((faina) => faina.codigo === codigo)
      ?? this.fainasCct.find((faina) => faina.codigo === codigo);
  }
}

export const catalogoPortmac = new CatalogoPortmac(
  fainasActIniciais,
  fainasCctIniciais,
);
