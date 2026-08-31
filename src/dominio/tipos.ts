import type { DataLocal } from './tempo.js';

export type UnidadeDeMedida = 'TON';

export type TipoDeCustoOpcional =
  | 'MATERIAL_DE_PEACAO'
  | 'MADEIRA'
  | 'LOCACAO_DE_MAQUINA'
  | 'MATERIAL_DE_ICAMENTO';

export interface CustoOpcional {
  readonly tipo: TipoDeCustoOpcional;
  readonly custoTotal: number;
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
  readonly totalDeTernos: number;
  /** Custos totais informados pelo usuário, opcionais à mão de obra. */
  readonly custosOpcionais?: readonly CustoOpcional[];
  /** Opcional: cenário manual que preserva o total de ternos informado. */
  readonly ternosPorPeriodo?: readonly number[];
}

export interface FainaCatalogada {
  readonly codigo: string;
  readonly descricao: string;
  readonly unidade: UnidadeDeMedida;
}

export interface PeriodoOgmo {
  readonly indice: number;
  readonly data: DataLocal;
  readonly identificador: string;
  readonly multiplicador: number;
}

export interface ContextoDeCustoDoPeriodo {
  readonly faina: FainaCatalogada;
  readonly periodo: PeriodoOgmo;
  readonly producaoToneladas: number;
  readonly ternos: number;
}

export interface LinhaDeMemoria {
  readonly descricao: string;
  readonly valor: number;
}

export interface CustoDoPeriodo {
  readonly total: number;
  readonly memoria: readonly LinhaDeMemoria[];
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
