import type {
  ContextoDeCustoDoPeriodo,
  CustoDoPeriodo,
  FainaCatalogada,
  RegraDeComposicaoProvisoria,
} from '../dominio/tipos.js';
import type { CatalogoOgmo } from './portas.js';
import { obterMajoracaoDoPeriodo } from '../dominio/majoracoes.js';
import { fainasActProvisorias } from './act-provisorio.js';

export interface RegraDeCustoPorTonelada {
  /** Taxa total da estiva por tonelada e por cota, sem homens extras. */
  readonly taxaEstivaPorTonelada: number;
  /** Soma das cotas da equipe básica de estiva por terno. */
  readonly cotasEstivaPorTerno: number;
  /** Taxa total da equipe de conferentes por tonelada. */
  readonly taxaConferentesPorTonelada: number;
}

export interface RegistroDeFaina extends FainaCatalogada {
  readonly regra?: RegraDeCustoPorTonelada;
  readonly regraCctProvisoria?: RegraDeComposicaoProvisoria;
  readonly regraActProvisoria?: RegraDeComposicaoProvisoria;
}

/** A CCT ativa no simulador é o mapeamento provisório exclusivo da planilha. */
export { fainasCctIniciais } from './cct.js';
import { fainasCctIniciais } from './cct.js';

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
    const regraProvisoria = faina.regraActProvisoria ?? faina.regraCctProvisoria;
    if (regraProvisoria) {
      return calcularCustoComposicaoProvisoria(contexto, faina, regraProvisoria);
    }
    if (faina.status === 'PENDENTE_DE_VALIDACAO' || !faina.regra) {
      throw new Error(`A faina ${faina.descricao} ainda está pendente de validação.`);
    }

    const majoracao = contexto.majoracao ?? obterMajoracaoDoPeriodo({
      data: contexto.periodo.data,
      periodo: contexto.periodo.identificador,
      fonte: faina.fonte,
    });
    const custoEstivaBase =
      contexto.producaoToneladas *
      faina.regra.taxaEstivaPorTonelada *
      faina.regra.cotasEstivaPorTerno;
    const custoConferentesBase =
      contexto.producaoToneladas * faina.regra.taxaConferentesPorTonelada;
    const custoEstiva = custoEstivaBase * majoracao.fator;
    const custoConferentes = custoConferentesBase * majoracao.fator;
    const total = custoEstiva + custoConferentes;

    return {
      total,
      majoracao,
      memoria: [
        {
          descricao: `Estiva · ${faina.regra.taxaEstivaPorTonelada.toFixed(2)} × ${faina.regra.cotasEstivaPorTerno.toString().replace('.', ',')} cotas/terno · ${descricaoDoAdicional(majoracao.adicionalPercentual)}`,
          valor: custoEstiva,
        },
        {
          descricao: `Conferentes · ${faina.regra.taxaConferentesPorTonelada.toFixed(2)} por tonelada · ${descricaoDoAdicional(majoracao.adicionalPercentual)}`,
          valor: custoConferentes,
        },
        {
          descricao: `Fonte: ${faina.fonte} · ${faina.referencia} · ${majoracao.descricao}`,
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

function calcularCustoComposicaoProvisoria(
  contexto: ContextoDeCustoDoPeriodo,
  faina: RegistroDeFaina,
  regra: RegraDeComposicaoProvisoria,
): CustoDoPeriodo {
  const majoracao = contexto.majoracao ?? obterMajoracaoDoPeriodo({
    data: contexto.periodo.data,
    periodo: contexto.periodo.identificador,
    fonte: faina.fonte,
  });
  const quantidadeBase = regra.regime === 'PRODUCAO'
    ? contexto.producaoToneladas
    : 1;
  const fatorEncargos = 1 + regra.encargosContribuicaoAdicional;
  const itens = regra.baseDeCalculo === 'TARIFA_UNITARIA'
    ? [{ categoria: 'Tarifa CCT', homens: 0, cotas: 0, funcoes: [] as readonly string[] }]
    : regra.composicao;
  const memoria = itens.map((item) => {
    const fatorDaEquipe = regra.baseDeCalculo === 'TARIFA_UNITARIA' ? 1 : item.cotas;
    const custoBase = fatorDaEquipe * regra.taxaBase * quantidadeBase;
    const custoTotal = custoBase * fatorEncargos * majoracao.fator * contexto.ternos;
    const unidade = regra.regime === 'PRODUCAO' ? 'produção do período' : 'salário-dia';
    return {
      descricao: `${item.categoria} · ${item.homens} homens · ${regra.baseDeCalculo === 'TARIFA_UNITARIA' ? 'tarifa unitária' : `${item.cotas} cotas agregadas`} × ${regra.taxaBase.toFixed(4)} · ${unidade} · ${descricaoDoAdicional(majoracao.adicionalPercentual)} · ${contexto.ternos} terno(s)`,
      valor: custoTotal,
    };
  });
  const total = memoria.reduce((soma, item) => soma + item.valor, 0);

  return {
    total,
    majoracao,
    memoria: [
      ...memoria,
      {
        descricao: `Fonte: ${faina.fonte} provisória · ${faina.codigoDaTabela ?? faina.codigo} · ${regra.baseDeCalculo === 'TARIFA_UNITARIA' ? 'tarifa unitária; composição não multiplicada por cotas' : 'cotas da equipe'} · encargos/contribuições +${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(regra.encargosContribuicaoAdicional * 100)}% · ${majoracao.descricao}`,
        valor: total,
      },
    ],
  };
}

function descricaoDoAdicional(percentual: number): string {
  if (percentual === 0) return 'preço normal';
  return `+${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(percentual)}% de aumento`;
}

export const catalogoPortmac = new CatalogoPortmac(
  fainasActProvisorias,
  fainasCctIniciais,
);
