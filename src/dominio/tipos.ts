import type { DataLocal, InstanteLocal } from './tempo.js';

/** As cinco categorias de mão de obra avulsa que a PORTMAC requisita. */
export type Categoria =
  | 'CONFERENTES'
  | 'ESTIVADORES'
  | 'ARRUMADORES'
  | 'SUPORTE'
  | 'VIGIAS';

export const CATEGORIAS: readonly Categoria[] = [
  'CONFERENTES',
  'ESTIVADORES',
  'ARRUMADORES',
  'SUPORTE',
  'VIGIAS',
];

/**
 * Instrumento coletivo que rege um par `(faina, categoria)`.
 *
 * A regra fechou no #9: o ACT alcança apenas estiva e conferência, e apenas
 * numa lista curta de fainas. Todo o resto é CCT, por cláusula expressa — o
 * default não é uma escolha nossa, é o que a norma manda.
 */
export type Instrumento = 'ACT' | 'CCT';

/** A base em que a faina é medida e remunerada (#17). */
export type UnidadeDeMedida = 'TON' | 'UND' | 'VOLUME';

/**
 * OBS do ANEXO I do ACT: `Conferente = Taxa equipe · Demais = Taxa homem`.
 *
 * Na taxa-homem cada trabalhador ganha `cota × taxa × produção`, e o custo da
 * PORTMAC cresce com a equipe. Na taxa-equipe existe um bolo `taxa × produção`
 * rateado pelas cotas, e o custo não depende da quantidade de ternos.
 */
export type UnidadeDaTaxa = 'POR_HOMEM' | 'POR_EQUIPE';

/**
 * O que um terno a mais multiplica (#16).
 *
 * Conferente chefe e ajudante são `POR_NAVIO`; conferente de lingada e a equipe
 * de estiva inteira são `POR_TERNO`. Sem esta distinção o custo erra em qualquer
 * navio com mais de um terno.
 */
export type Escala = 'POR_NAVIO' | 'POR_TERNO';

export type ClasseDeDia = 'COMUM' | 'SABADO' | 'DOMINGO' | 'FERIADO';

export type Turno = 'DIURNO' | 'NOTURNO';

/** Janela de validade de uma linha de catálogo. `ate: null` = vigente por prazo indeterminado. */
export interface Vigencia {
  readonly de: DataLocal;
  readonly ate: DataLocal | null;
}

/**
 * Um valor da tabela de remuneração, nas três colunas em que ele aparece.
 *
 * `totalComEncargos` é o que a PORTMAC paga e é o único que entra na conta
 * (#11). `base` fica guardada como memória de cálculo: é o que permite
 * reconferir o fator 2,152842 contra o documento quando alguém duvidar do
 * número.
 */
export interface ValorTabelado {
  readonly base: number;
  readonly totalComEncargos: number;
}

/**
 * Uma taxa, que pode ser linear ou escalonada por faixas de quantidade.
 *
 * As fainas de veículos (14.1.x) e de máquinas (14.3.x) têm degraus — até 150
 * unidades, de 151 a 300, e assim por diante (#17). Modelar isso desde já custa
 * pouco e evita reescrever o catálogo quando essas fainas forem cadastradas.
 */
export type TabelaDeTaxa =
  | { readonly tipo: 'LINEAR'; readonly valor: ValorTabelado }
  | { readonly tipo: 'FAIXAS'; readonly faixas: readonly FaixaDeTaxa[] };

export interface FaixaDeTaxa {
  /** Limite superior da faixa, inclusive. `null` = daqui para cima. */
  readonly ate: number | null;
  readonly valor: ValorTabelado;
}

export interface Faina {
  readonly codigo: string;
  readonly descricao: string;
  readonly unidade: UnidadeDeMedida;
  /**
   * A identidade da faina também é datada.
   *
   * A CCT sucessora pode renumerar fainas ou mudar a unidade em que uma carga
   * é medida. Sem vigência aqui, uma simulação antiga passaria a ser lida com a
   * unidade nova — e mudar de `TON` para `UND` troca o significado do
   * número-título inteiro.
   */
  readonly vigencia: Vigencia;
}

export interface PosicaoDeEquipe {
  readonly funcao: string;
  readonly quantidade: number;
  readonly cota: number;
  readonly escala: Escala;
  /**
   * Homem extra — guincheiro, operador de empilhadeira. O ACT os chama de
   * "requisição facultativa", fora da equipe referência (#16, item 3).
   */
  readonly facultativa?: boolean;
}

export interface ComposicaoDeEquipe {
  readonly instrumento: Instrumento;
  readonly faina: string;
  readonly categoria: Categoria;
  readonly posicoes: readonly PosicaoDeEquipe[];
  readonly vigencia: Vigencia;
  readonly pendenteDeConferencia?: PendenciaDeCatalogo;
}

export interface Remuneracao {
  readonly instrumento: Instrumento;
  readonly faina: string;
  readonly categoria: Categoria;
  readonly unidadeDaTaxa: UnidadeDaTaxa;
  readonly taxa: TabelaDeTaxa;
  /** Piso por trabalhador e por período requisitado (ACT, Cláusula Quinta, §2º). */
  readonly salarioDia: ValorTabelado;
  readonly vigencia: Vigencia;
  readonly pendenteDeConferencia?: PendenciaDeCatalogo;
}

/**
 * Marca uma linha de catálogo cujo valor ainda não foi conferido no documento.
 *
 * Enquanto o dossiê (#2) não fecha, algumas linhas precisam existir para o
 * motor rodar sem que o número que elas produzem possa ser confundido com
 * cotação. Toda simulação que toca uma linha marcada carrega a pendência no
 * resultado — é a diferença entre um simulador incompleto e um simulador que
 * mente.
 */
export interface PendenciaDeCatalogo {
  readonly campo: string;
  readonly motivo: string;
}

/**
 * Uma linha da matriz esparsa de cobertura: as exceções ACT sobre o default CCT.
 *
 * São ~8 linhas, não uma tabela cheia (#9).
 */
export interface Cobertura {
  readonly faina: string;
  readonly categoria: Categoria;
  readonly instrumento: Instrumento;
  readonly vigencia: Vigencia;
}

/** Custos de material e locação, rateados pelo volume do navio (#5). */
export interface CustoOpcional {
  readonly descricao: string;
  readonly tipo: 'VALOR_TOTAL' | 'POR_UNIDADE_DE_CARGA' | 'POR_PERIODO';
  readonly valor: number;
  /**
   * A qual carga o custo se prende, quando o tipo é `POR_UNIDADE_DE_CARGA`.
   *
   * Num navio misto, somar toneladas com contêineres para multiplicar por um
   * preço unitário produz um número sem dimensão. Ou o custo diz de qual faina
   * é, ou o navio inteiro precisa estar numa unidade só.
   */
  readonly faina?: string;
}

export interface CargaSimulada {
  /** Código da faina no catálogo. */
  readonly faina: string;
  /** Na unidade da faina: toneladas, unidades ou volumes. */
  readonly quantidade: number;
  /**
   * Produção de **um terno** em **um período**, na unidade da faina.
   *
   * O piso só se avalia período a período, então a produtividade precisa ser
   * por terno e por período — uma média do navio não permite dizer em que
   * regime cada período caiu (#8, item 2 — a confirmar com o diretor).
   */
  readonly produtividadePorTernoPorPeriodo: number;
}

export interface EntradaDeSimulacao {
  readonly navio?: string;
  readonly cargas: readonly CargaSimulada[];
  readonly ternos: number;
  readonly inicio: InstanteLocal;
  readonly custosOpcionais?: readonly CustoOpcional[];
  /**
   * Data que seleciona a versão do catálogo. Ausente = a data de início da
   * operação. Qual das duas manda é decisão do #12.
   */
  readonly dataDeReferenciaDoCatalogo?: DataLocal;
}
