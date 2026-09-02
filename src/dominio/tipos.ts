import type { MajoracaoDoPeriodo } from './majoracoes.js';
import type { DataLocal } from './tempo.js';

export type UnidadeDeMedida = 'TON' | 'VOLUME' | 'UNIDADE' | 'CONTAINER' | 'EQUIPE' | 'INDEFINIDA';

export type StatusDaFaina = 'VALIDADA' | 'PROVISORIA' | 'PENDENTE_DE_VALIDACAO';

export type FonteDoCatalogo = 'ACT' | 'CCT';

export type TipoDeCustoOpcional =
  | 'MATERIAL_DE_PEACAO'
  | 'MADEIRA'
  | 'LOCACAO_DE_MAQUINA'
  | 'MATERIAL_DE_ICAMENTO'
  | 'OUTRO';

export interface CustoOpcional {
  readonly tipo: TipoDeCustoOpcional;
  /** Obrigatória quando o tipo for OUTRO. */
  readonly descricao?: string;
  readonly custoTotal: number;
}

export type RegimeRemuneratorio = 'PRODUCAO' | 'SALARIO_DIA';
export type BaseDeCalculoProvisoria = 'COTAS_DA_EQUIPE' | 'TARIFA_UNITARIA';

export interface ComposicaoCctProvisoria {
  readonly categoria: string;
  readonly funcoes: readonly string[];
  readonly homens: number;
  readonly cotas: number;
}

export interface RegraDeComposicaoProvisoria {
  readonly taxaBase: number;
  readonly baseDeCalculo: BaseDeCalculoProvisoria;
  readonly regime: RegimeRemuneratorio;
  readonly unidade: UnidadeDeMedida;
  /** Valor usado pela planilha como adicional de encargos/contribuições. */
  readonly encargosContribuicaoAdicional: number;
  /**
   * Produção mínima faturável por terno em um período, quando a tabela
   * ACT/CCT garante um piso à equipe.
   *
   * Com um piso, a quantidade cobrada é `max(produção, mínimo × ternos)`: abaixo
   * do piso paga-se o piso, acima dele paga-se a produção. É o que cria o joelho
   * da curva de custo por produtividade — abaixo do ponto de virada o custo
   * unitário cai como 1/produtividade, acima dele fica plano.
   *
   * PENDENTE DE LEVANTAMENTO: nenhuma faina do catálogo declara este valor
   * ainda. Enquanto estiver ausente, o cálculo não aplica piso algum e a curva
   * de referência não tem joelho. Só a ACT 1.1 menciona o assunto, e para dizer
   * que é uma operação *sem* produção mínima.
   */
  readonly producaoMinimaPorTernoPorPeriodo?: number;
  readonly composicao: readonly ComposicaoCctProvisoria[];
}

export type RegraCctProvisoria = RegraDeComposicaoProvisoria;
export type RegraActProvisoria = RegraDeComposicaoProvisoria;

export interface InicioDaOperacao {
  readonly data: DataLocal;
  /** Identificador do período conforme o calendário do OGMO. */
  readonly periodo: string;
}

export interface EntradaDeSimulacao {
  /** Identificação opcional da cotação; não participa do cálculo. */
  readonly cliente?: string;
  readonly faina: string;
  readonly inicio: InicioDaOperacao;
  readonly volumeToneladas: number;
  readonly produtividadeToneladasPorPeriodo: number;
  /** Quantidade padrão de ternos em cada período; o total é derivado. */
  readonly ternosPorPeriodoPadrao?: number;
  readonly totalDeTernos: number;
  /** Opcional: produtividade por terno customizada de cada período projetado. */
  readonly produtividadesPorPeriodo?: readonly number[];
  /** Custos totais informados pelo usuário, opcionais à mão de obra. */
  readonly custosOpcionais?: readonly CustoOpcional[];
  /** Opcional: cenário manual que preserva o total de ternos informado. */
  readonly ternosPorPeriodo?: readonly number[];
}

export interface FainaCatalogada {
  readonly codigo: string;
  /** Código único no catálogo; na CCT inclui o grupo da tabela. */
  readonly codigoDaTabela?: string;
  /** Grupo/tabela de origem quando a fonte é a CCT. */
  readonly grupoDaTabela?: string;
  readonly descricao: string;
  readonly tipoDeCarga: string;
  readonly unidade: UnidadeDeMedida;
  readonly fonte: FonteDoCatalogo;
  /** Registros pendentes ficam visíveis no catálogo, mas não entram na simulação. */
  readonly status?: StatusDaFaina;
  readonly vigencia: string;
  readonly referencia: string;
}

export interface PeriodoOgmo {
  readonly indice: number;
  readonly data: DataLocal;
  readonly identificador: string;
}

export interface ContextoDeCustoDoPeriodo {
  readonly faina: FainaCatalogada;
  readonly periodo: PeriodoOgmo;
  readonly producaoToneladas: number;
  readonly ternos: number;
  readonly majoracao?: MajoracaoDoPeriodo;
}

/**
 * Como o valor de uma linha de memória deve ser lido.
 *
 * Sem esta marca a camada de apresentação precisa adivinhar pela posição da
 * linha — foi assim que o total de ternos passou a ser exibido como `R$ 36,00`.
 */
export type FormatoDeMemoria = 'MOEDA' | 'QUANTIDADE';

export interface LinhaDeMemoria {
  readonly descricao: string;
  readonly valor: number;
  /** Ausente equivale a `MOEDA`: a maioria das linhas é dinheiro. */
  readonly formato?: FormatoDeMemoria;
}

export interface CustoDoPeriodo {
  readonly total: number;
  readonly memoria: readonly LinhaDeMemoria[];
  readonly majoracao?: MajoracaoDoPeriodo;
}

export interface CustoOpcionalCalculado extends CustoOpcional {
  readonly custoPorTonelada: number;
}

export interface PeriodoCalculado {
  readonly periodo: PeriodoOgmo;
  readonly producaoToneladas: number;
  readonly ternos: number;
  readonly custo: CustoDoPeriodo;
}

export interface ResultadoDeSimulacao {
  readonly entrada: EntradaDeSimulacao;
  readonly quantidadeDePeriodos: number;
  readonly distribuicaoDeTernos: readonly number[];
  readonly periodos: readonly PeriodoCalculado[];
  readonly custoDeMaoDeObra: number;
  readonly custosOpcionais: readonly CustoOpcionalCalculado[];
  readonly custoOpcionalTotal: number;
  readonly custoTotal: number;
  readonly custoPorTonelada: number;
  readonly memoria: readonly LinhaDeMemoria[];
}
