import type { DataLocal, InstanteLocal } from '../dominio/tempo.js';
import type {
  Categoria,
  ClasseDeDia,
  EntradaDeSimulacao,
  Instrumento,
  Turno,
  UnidadeDeMedida,
} from '../dominio/tipos.js';
import type { Regime } from './remuneracao.js';
import type { Premissa, PoliticasDeCalculo } from './politicas.js';

/** O custo de uma categoria **num período**. */
export interface CustoDeCategoria {
  readonly categoria: Categoria;
  readonly instrumento: Instrumento;
  readonly custo: number;
  readonly trabalhadores: number;
  readonly trabalhadoresNoPiso: number;
  readonly regime: Regime;
}

/**
 * O custo de uma categoria **na operação inteira**.
 *
 * A contagem aqui é em *homens-período*, não em trabalhadores: uma equipe de 14
 * ao longo de 14 períodos são 196 homens-período, e dizer "14 no piso" ao lado
 * de "14 trabalhadores" faria parecer que a operação inteira caiu no piso
 * quando foi só o período de sobra. O nome do campo carrega a unidade porque
 * essa confusão custa uma cotação.
 */
export interface ResumoDeCategoria {
  readonly categoria: Categoria;
  readonly instrumento: Instrumento;
  readonly custo: number;
  /** Efetivo da categoria em cada período. */
  readonly trabalhadores: number;
  readonly homensPeriodo: number;
  readonly homensPeriodoNoPiso: number;
  readonly regime: Regime | 'MISTO';
}

export interface PeriodoDoResultado {
  readonly indice: number;
  readonly inicio: InstanteLocal;
  readonly fim: InstanteLocal;
  readonly turno: Turno;
  readonly classeDeDia: ClasseDeDia;
  readonly multiplicador: number;
  /** 1 em período cheio; fração menor quando a política de arredondamento é EXATO. */
  readonly fracaoRequisitada: number;
  readonly faina: string;
  readonly producao: number;
  readonly custo: number;
  readonly porCategoria: readonly CustoDeCategoria[];
}

export interface Indicador {
  /** `R$/ton`, `R$/und`, `R$/volume`. */
  readonly rotulo: string;
  readonly unidade: UnidadeDeMedida;
  readonly valor: number;
  readonly quantidade: number;
  readonly custoAtribuido: number;
}

export interface TrechoDaOperacao {
  readonly faina: string;
  readonly unidade: UnidadeDeMedida;
  readonly quantidade: number;
  readonly periodos: number;
  readonly custoMaoDeObra: number;
}

export interface ResultadoDeSimulacao {
  readonly entrada: EntradaDeSimulacao;
  readonly politicas: PoliticasDeCalculo;
  readonly dataDeReferenciaDoCatalogo: DataLocal;

  readonly inicio: InstanteLocal;
  readonly terminoPrevisto: InstanteLocal;
  readonly duracaoEmPeriodos: number;

  readonly custoMaoDeObra: number;
  readonly custoDeAdministracaoOgmo: number;
  readonly custoDoFundoIndenizatorio: number;
  readonly custosOpcionais: number;
  readonly custoTotal: number;

  /**
   * O número-título, quando existe um só.
   *
   * `null` num navio misto: somar toneladas com contêineres não produz uma
   * unidade defensável, e inventar um peso médio por contêiner seria uma
   * premissa nossa entrando como dado do cliente (#17). Nesse caso o custo
   * total é o título e os indicadores por unidade ficam como recorte.
   */
  readonly indicadorPrincipal: Indicador | null;
  readonly indicadores: readonly Indicador[];

  readonly periodos: readonly PeriodoDoResultado[];
  readonly trechos: readonly TrechoDaOperacao[];
  readonly porCategoria: readonly ResumoDeCategoria[];
  readonly porInstrumento: readonly { instrumento: Instrumento; custo: number }[];
  readonly porClasseDeDia: readonly {
    classe: ClasseDeDia;
    turno: Turno;
    periodos: number;
    custo: number;
  }[];

  readonly regimeDominante: Regime | 'MISTO';
  readonly premissas: readonly Premissa[];
}
