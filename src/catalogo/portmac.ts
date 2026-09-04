import type {
  ContextoDeCustoDoPeriodo,
  CustoDoPeriodo,
  FainaCatalogada,
  RegraDeComposicaoDaFaina,
} from '../dominio/tipos.js';
import type { CatalogoOgmo } from './portas.js';
import { descricaoDoAdicional, obterMajoracaoDoPeriodo } from '../dominio/majoracoes.js';
import { formatarNumero, formatarPercentual } from '../dominio/formato.js';
import { fainasAct } from './act.js';

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
  readonly regraAct?: RegraDeComposicaoDaFaina;
}

export { fainasAct } from './act.js';

export class CatalogoPortmac implements CatalogoOgmo {
  /** Um código, um registro: listagem e consulta leem sempre o mesmo mapa. */
  private readonly fainas: ReadonlyMap<string, RegistroDeFaina>;

  constructor(fainas: readonly RegistroDeFaina[]) {
    this.fainas = new Map(fainas.map((faina) => [faina.codigo, faina]));
  }

  listarFainas(): readonly FainaCatalogada[] {
    return this.listarRegistros();
  }

  listarRegistros(): readonly RegistroDeFaina[] {
    return [...this.fainas.values()];
  }

  obterFaina(codigo: string): FainaCatalogada | undefined {
    return this.obterRegistro(codigo);
  }

  calcularCustoDoPeriodo(contexto: ContextoDeCustoDoPeriodo): CustoDoPeriodo {
    const faina = this.obterRegistro(contexto.faina.codigo);
    if (!faina) {
      throw new Error(`Faina ${contexto.faina.codigo} não está no catálogo.`);
    }
    if (faina.regraAct) {
      return calcularCustoPorComposicao(contexto, faina, faina.regraAct);
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
          descricao: `Estiva · ${formatarNumero(faina.regra.taxaEstivaPorTonelada)} × ${formatarNumero(faina.regra.cotasEstivaPorTerno)} cotas/terno · ${descricaoDoAdicional(majoracao.adicionalPercentual)}`,
          valor: custoEstiva,
        },
        {
          descricao: `Conferentes · ${formatarNumero(faina.regra.taxaConferentesPorTonelada)} por tonelada · ${descricaoDoAdicional(majoracao.adicionalPercentual)}`,
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
    return this.fainas.get(codigo);
  }
}

function calcularCustoPorComposicao(
  contexto: ContextoDeCustoDoPeriodo,
  faina: RegistroDeFaina,
  regra: RegraDeComposicaoDaFaina,
): CustoDoPeriodo {
  const majoracao = contexto.majoracao ?? obterMajoracaoDoPeriodo({
    data: contexto.periodo.data,
    periodo: contexto.periodo.identificador,
    fonte: faina.fonte,
  });
  const pisoDoPeriodo = regra.producaoMinimaPorTernoPorPeriodo === undefined
    ? 0
    : regra.producaoMinimaPorTernoPorPeriodo * contexto.ternos;
  // No regime de produção a tabela pode garantir um piso à equipe: cobra-se o
  // que for maior entre a produção realizada e esse piso.
  const quantidadeBase = regra.regime === 'PRODUCAO'
    ? Math.max(contexto.producaoToneladas, pisoDoPeriodo)
    : 1;
  const pisoAplicado = regra.regime === 'PRODUCAO' && pisoDoPeriodo > contexto.producaoToneladas;
  const fatorEncargos = 1 + regra.encargosContribuicaoAdicional;
  const memoria = regra.composicao.map((item) => {
    const custoBase = item.cotas * regra.taxaBase * quantidadeBase;
    const multiplicaPorTernos = regra.regime === 'SALARIO_DIA' ? contexto.ternos : 1;
    const custoTotal = custoBase * fatorEncargos * majoracao.fator * multiplicaPorTernos;
    const unidade = regra.regime === 'PRODUCAO'
      ? pisoAplicado ? 'produção mínima garantida' : 'produção do período'
      : 'salário-dia';
    return {
      descricao: `${item.categoria} · ${item.homens} homens · ${formatarNumero(item.cotas)} cotas agregadas × ${formatarNumero(regra.taxaBase, 4)} · ${unidade} · ${descricaoDoAdicional(majoracao.adicionalPercentual)}${regra.regime === 'SALARIO_DIA' ? ` · ${contexto.ternos} terno(s)` : ' · produção agregada dos ternos'}`,
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
        descricao: `Fonte: ${faina.fonte} · ${faina.codigoDaTabela ?? faina.codigo} · cotas da equipe · encargos/contribuições +${formatarPercentual(regra.encargosContribuicaoAdicional * 100)} · ${majoracao.descricao}`,
        valor: total,
      },
    ],
  };
}

export const catalogoPortmac = new CatalogoPortmac(fainasAct);
