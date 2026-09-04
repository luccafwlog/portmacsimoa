import type {
  ComposicaoDoTerno,
  ContextoDeCustoDoPeriodo,
  CustoDoPeriodo,
  FainaCatalogada,
  LinhaDeMemoria,
  RegraDaFaina,
  RegraDeCategoria,
} from '../dominio/tipos.js';
import type { CatalogoOgmo } from './portas.js';
import { descricaoDoAdicional, obterMajoracaoDoPeriodo } from '../dominio/majoracoes.js';
import { formatarMoeda, formatarNumero } from '../dominio/formato.js';
import { fainasAct } from './act.js';

export interface RegistroDeFaina extends FainaCatalogada {
  readonly regra?: RegraDaFaina;
}

export { fainasAct } from './act.js';

/** Cotas de uma categoria em um período com a quantidade de ternos informada. */
export function cotasDaCategoria(regra: RegraDeCategoria, ternos: number): number {
  return regra.composicao.reduce(
    (soma, item) => soma + item.cotas * (item.escopo === 'POR_NAVIO' ? 1 : ternos),
    0,
  );
}

/**
 * Produção por terno que iguala a remuneração por produção ao salário-dia.
 *
 * É o joelho real da curva de custo unitário: abaixo dele o período paga o piso
 * e o custo por unidade cai como 1/produtividade; acima, paga a produção e fica
 * plano. Sem taxa (peação) não existe virada — sempre se paga o salário-dia.
 */
export function producaoQueIgualaOPiso(regra: RegraDeCategoria): number | undefined {
  if (regra.taxa === undefined || regra.taxa <= 0) return undefined;
  return regra.salarioDiaPorCota / regra.taxa;
}

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
    if (faina.status === 'PENDENTE_DE_VALIDACAO' || !faina.regra) {
      throw new Error(`A faina ${faina.descricao} ainda está pendente de validação.`);
    }

    const majoracao = contexto.majoracao ?? obterMajoracaoDoPeriodo({
      data: contexto.periodo.data,
      periodo: contexto.periodo.identificador,
      fonte: faina.fonte,
    });

    const estiva = custoDaEstiva(faina.regra.estiva, contexto.producaoToneladas, contexto.ternos);
    const conferentes = faina.regra.conferentes
      ? custoDosConferentes(faina.regra.conferentes, contexto.producaoToneladas, contexto.ternos)
      : undefined;

    const memoria: LinhaDeMemoria[] = [
      { descricao: linhaDaEstiva(estiva, majoracao.adicionalPercentual, contexto.ternos), valor: estiva.valor * majoracao.fator },
    ];
    if (conferentes) {
      memoria.push({
        descricao: linhaDosConferentes(conferentes, majoracao.adicionalPercentual),
        valor: conferentes.valor * majoracao.fator,
      });
    }
    const total = memoria.reduce((soma, linha) => soma + linha.valor, 0);
    memoria.push({
      descricao: `Fonte: ${faina.referencia} · ${majoracao.descricao}`,
      valor: total,
    });

    return { total, majoracao, memoria };
  }

  private obterRegistro(codigo: string): RegistroDeFaina | undefined {
    return this.fainas.get(codigo);
  }
}

interface CustoDeCategoria {
  readonly valor: number;
  readonly cotas: number;
  readonly pisoAplicado: boolean;
  readonly regra: RegraDeCategoria;
}

/**
 * Estiva: a taxa é de um homem e a equipe inteira é requisitada em cada terno.
 *
 * O piso é comparado terno a terno, não sobre a produção agregada: dois ternos
 * que movimentam metade cada um podem pagar o salário-dia enquanto um terno
 * sozinho, com a mesma tonelagem, pagaria a produção.
 */
function custoDaEstiva(regra: RegraDeCategoria, producao: number, ternos: number): CustoDeCategoria {
  const cotasPorTerno = cotasDaCategoria(regra, 1);
  const producaoPorTerno = ternos > 0 ? producao / ternos : 0;
  const porProducao = (regra.taxa ?? 0) * producaoPorTerno;
  const pisoAplicado = regra.taxa === undefined || porProducao < regra.salarioDiaPorCota;
  const porCota = Math.max(porProducao, regra.salarioDiaPorCota);
  return {
    valor: ternos * cotasPorTerno * porCota,
    cotas: cotasPorTerno * ternos,
    pisoAplicado,
    regra,
  };
}

/**
 * Conferentes: a taxa já é o valor arrecadado pela equipe, sobre a produção do
 * período inteiro — o Anexo Conferentes diz "independentemente da quantidade de
 * ternos". O que cresce com os ternos é só a parte da equipe requisitada por
 * terno (lingada, planista), e ela entra no piso.
 */
function custoDosConferentes(regra: RegraDeCategoria, producao: number, ternos: number): CustoDeCategoria {
  const cotas = cotasDaCategoria(regra, ternos);
  const fator = regra.baseDaTaxa === 'POR_COTA' ? cotas : 1;
  const porProducao = (regra.taxa ?? 0) * producao * fator;
  const piso = cotas * regra.salarioDiaPorCota;
  const pisoAplicado = regra.taxa === undefined || porProducao < piso;
  return { valor: Math.max(porProducao, piso), cotas, pisoAplicado, regra };
}

function linhaDaEstiva(custo: CustoDeCategoria, adicional: number, ternos: number): string {
  const base = custo.pisoAplicado
    ? `salário-dia ${formatarMoeda(custo.regra.salarioDiaPorCota)} por cota`
    : `${formatarMoeda(custo.regra.taxa ?? 0)} por unidade e por cota`;
  return `Estiva · ${formatarNumero(custo.cotas)} cotas em ${ternos} terno(s) · ${base} · ${descricaoDoAdicional(adicional)}`;
}

function linhaDosConferentes(custo: CustoDeCategoria, adicional: number): string {
  const base = custo.pisoAplicado
    ? `salário-dia ${formatarMoeda(custo.regra.salarioDiaPorCota)} × ${formatarNumero(custo.cotas)} cotas`
    : custo.regra.baseDaTaxa === 'POR_EQUIPE'
      ? `${formatarMoeda(custo.regra.taxa ?? 0)} por unidade para a equipe`
      : `${formatarMoeda(custo.regra.taxa ?? 0)} por unidade e por cota · ${formatarNumero(custo.cotas)} cotas`;
  return `Conferentes · ${base} · ${descricaoDoAdicional(adicional)}`;
}

/** Homens da equipe de referência, para exibição no catálogo. */
export function homensDaCategoria(composicao: readonly ComposicaoDoTerno[]): number {
  return composicao.reduce((soma, item) => soma + item.homens, 0);
}

export const catalogoPortmac = new CatalogoPortmac(fainasAct);
