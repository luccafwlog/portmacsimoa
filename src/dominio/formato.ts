/**
 * Apresentação de números, moeda e unidades.
 *
 * O simulador escreve valores em três lugares — tela, impressão e memória de
 * cálculo — e antes desta camada cada um deles reinventava o formato. Um único
 * módulo garante que a mesma grandeza apareça sempre igual e que a unidade da
 * faina seja escrita do mesmo jeito no formulário, no resultado e no catálogo.
 */

export interface RotuloDeUnidade {
  readonly singular: string;
  readonly plural: string;
  /** Forma curta usada em rótulos de campo, eixos e razões (`R$ / ton`). */
  readonly abreviacao: string;
  /** Nome da grandeza informada pelo usuário no formulário. */
  readonly grandeza: string;
}

const ROTULOS: Readonly<Record<string, RotuloDeUnidade>> = {
  TON: { singular: 'tonelada', plural: 'toneladas', abreviacao: 'ton', grandeza: 'Volume do navio' },
  VOLUME: { singular: 'volume', plural: 'volumes', abreviacao: 'vol', grandeza: 'Volumes do navio' },
  UNIDADE: { singular: 'unidade', plural: 'unidades', abreviacao: 'un', grandeza: 'Unidades do navio' },
  CONTAINER: { singular: 'contêiner', plural: 'contêineres', abreviacao: 'cntr', grandeza: 'Contêineres do navio' },
  // A abreviação é invariável: acompanha o número sem concordar com ele
  // ("3 eq.", "3 ton"), ao contrário do singular e do plural.
  EQUIPE: { singular: 'equipe', plural: 'equipes', abreviacao: 'eq.', grandeza: 'Equipes da operação' },
};

const PADRAO: RotuloDeUnidade = {
  singular: 'unidade',
  plural: 'unidades',
  abreviacao: 'un',
  grandeza: 'Quantidade do navio',
};

export function rotuloDaUnidade(unidade?: string): RotuloDeUnidade {
  return (unidade && ROTULOS[unidade]) || PADRAO;
}

export function formatarMoeda(valor: number): string {
  if (!Number.isFinite(valor)) return '—';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatarNumero(valor: number, casasDecimais = 2): string {
  if (!Number.isFinite(valor)) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casasDecimais }).format(valor);
}

/**
 * Como `formatarNumero`, mas com casas decimais fixas.
 *
 * Eixos e colunas de valores ficam desalinhados quando o zero final some:
 * `R$ 4,3` ao lado de `R$ 3,98` faz a escala parecer irregular.
 */
export function formatarNumeroFixo(valor: number, casasDecimais: number): string {
  if (!Number.isFinite(valor)) return '—';
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: casasDecimais,
    maximumFractionDigits: casasDecimais,
  });
}

/** `87,5%` — o adicional da tabela da ACT chega a três casas. */
export function formatarPercentual(valor: number, casasDecimais = 3): string {
  return `${formatarNumero(valor, casasDecimais)}%`;
}

/** Concorda o substantivo com a quantidade: `1 período`, `4 períodos`. */
export function pluralizar(quantidade: number, singular: string, plural: string): string {
  return `${formatarNumero(quantidade)} ${quantidade === 1 ? singular : plural}`;
}
