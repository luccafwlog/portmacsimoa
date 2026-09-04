import type { MajoracaoDoPeriodo } from './majoracoes.js';
import type { DataLocal } from './tempo.js';

export type UnidadeDeMedida = 'TON' | 'VOLUME' | 'UNIDADE' | 'CONTAINER' | 'EQUIPE' | 'INDEFINIDA';

export type StatusDaFaina = 'VALIDADA' | 'PROVISORIA' | 'PENDENTE_DE_VALIDACAO';

export type FonteDoCatalogo = 'ACT';

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

/**
 * Como a taxa do Anexo I remunera a equipe.
 *
 * `POR_COTA` — a taxa é de um homem e multiplica a soma das cotas da equipe.
 * `POR_EQUIPE` — a taxa já é o valor arrecadado pela equipe inteira.
 *
 * A observação literal do Anexo I é "Conferente = Taxa equipe / Demais = Taxa
 * homem", e o Anexo III, VII confirma para a estiva: "o salário-dia e o
 * salário-produção são por homem da equipe, referente a 1 (uma) cota".
 */
export type BaseDaTaxa = 'POR_COTA' | 'POR_EQUIPE';

/**
 * Se a função é requisitada uma vez por terno ou uma vez para o navio.
 *
 * O Anexo Conferentes é explícito: "01 conferente chefe, por navio" contra
 * "01 conferente lingada, para cada terno em operação". Cobrar o chefe em cada
 * terno superfatura toda operação com mais de um terno.
 */
export type EscopoDaFuncao = 'POR_TERNO' | 'POR_NAVIO';

export interface ComposicaoDoTerno {
  readonly categoria: string;
  readonly funcoes: readonly string[];
  readonly homens: number;
  readonly cotas: number;
  /** Ausente equivale a `POR_TERNO`: é o caso de toda a estiva. */
  readonly escopo?: EscopoDaFuncao;
}

/**
 * A regra de uma das duas categorias que compõem o custo de um período.
 *
 * O custo de um período é sempre estiva + conferentes: o Anexo I traz as duas
 * em tabelas separadas, com bases de taxa diferentes.
 */
export interface RegraDeCategoria {
  /**
   * Coluna "Total c/E.S" da taxa no Anexo I, por unidade movimentada.
   *
   * Ausente quando a faina não tem produção — a peação é remuneração fixa e
   * paga só o salário-dia.
   */
  readonly taxa?: number;
  readonly baseDaTaxa: BaseDaTaxa;
  /**
   * Coluna "Salário Dia · Total c/E.S" do Anexo I: o piso de um período.
   *
   * Cláusula 5ª, § 2º: quando a remuneração por produção não alcança o
   * salário-dia, ele é o mínimo do período requisitado. O piso é em REAIS por
   * cota — não existe piso de tonelagem nesta ACT. Como as cotas multiplicam os
   * dois lados, o custo de um terno é `cotas × max(taxa × produção, salário-dia)`
   * e a produção que iguala os dois é `salário-dia ÷ taxa`.
   */
  readonly salarioDiaPorCota: number;
  readonly composicao: readonly ComposicaoDoTerno[];
}

export interface RegraDaFaina {
  readonly unidade: UnidadeDeMedida;
  readonly estiva: RegraDeCategoria;
  /** Ausente quando a faina não requisita conferentes, como a peação. */
  readonly conferentes?: RegraDeCategoria;
}

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
  /** Código único no catálogo; inclui o grupo da tabela quando houver. */
  readonly codigoDaTabela?: string;
  /** Grupo/tabela de origem no documento da ACT. */
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
