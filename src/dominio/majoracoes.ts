import type { FonteDoCatalogo } from './tipos.js';
import { diaDaSemana, type DataLocal } from './tempo.js';

export type FaixaDeJornada = 'DIA' | 'NOITE';
export type TipoDeDia = 'NORMAL' | 'SABADO' | 'DOMINGO' | 'FERIADO';

export interface MajoracaoDoPeriodo {
  readonly fonte: FonteDoCatalogo;
  readonly faixa: FaixaDeJornada;
  readonly tipoDeDia: TipoDeDia;
  /** Percentual de aumento sobre o preço normal, conforme a tabela documental. */
  readonly adicionalPercentual: number;
  /** Fator aplicado ao preço normal: 1 + adicionalPercentual / 100. */
  readonly fator: number;
  readonly descricao: string;
}

export interface EntradaDeMajoracao {
  readonly data: DataLocal;
  readonly periodo: string;
  readonly fonte: FonteDoCatalogo;
  readonly feriado?: boolean;
}

interface TabelaDeMajoracao {
  readonly normalDia: number;
  readonly normalNoite: number;
  readonly sabadoDia: number;
  readonly sabadoNoite: number;
  readonly domingoDia: number;
  readonly domingoNoite: number;
  readonly feriadoDia: number;
  readonly feriadoNoite: number;
}

const tabelaBase: TabelaDeMajoracao = {
  normalDia: 0,
  normalNoite: 0,
  sabadoDia: 0,
  sabadoNoite: 87.5,
  domingoDia: 87.5,
  domingoNoite: 134.375,
  feriadoDia: 100,
  feriadoNoite: 150,
};

/** As planilhas provisórias ACT e CCT indicam adicional noturno de 25% em dia útil. */
export const tabelasDeMajoracao: Readonly<Record<FonteDoCatalogo, TabelaDeMajoracao>> = {
  ACT: { ...tabelaBase, normalNoite: 25 },
  CCT: { ...tabelaBase, normalNoite: 25 },
};

const PERIODOS_DIURNOS = new Set(['07-13', '13-19']);
const PERIODOS_NOTURNOS = new Set(['19-01', '01-07']);
const DESCRICOES_DOS_PERIODOS: Readonly<Record<string, string>> = {
  '01-07': '01h às 7h',
  '07-13': '07h às 13h',
  '13-19': '13h às 19h',
  '19-01': '19h à 1h',
};

export function obterMajoracaoDoPeriodo(entrada: EntradaDeMajoracao): MajoracaoDoPeriodo {
  const faixa = PERIODOS_DIURNOS.has(entrada.periodo)
    ? 'DIA'
    : PERIODOS_NOTURNOS.has(entrada.periodo) ? 'NOITE' : undefined;
  if (!faixa) throw new Error(`Período de majoração desconhecido: ${entrada.periodo}`);

  const semana = diaDaSemana(entrada.data);
  const tipoDeDia: TipoDeDia = entrada.feriado
    ? 'FERIADO'
    : semana === 'SABADO' ? 'SABADO' : semana === 'DOMINGO' ? 'DOMINGO' : 'NORMAL';
  const tabela = tabelasDeMajoracao[entrada.fonte];
  const chave = `${tipoDeDia.toLowerCase()}${faixa === 'DIA' ? 'Dia' : 'Noite'}` as keyof TabelaDeMajoracao;
  const adicionalPercentual = tabela[chave];
  const faixaDescricao = DESCRICOES_DOS_PERIODOS[entrada.periodo]!;
  const diaDescricao = tipoDeDia === 'SABADO'
    ? 'sábado'
    : tipoDeDia === 'DOMINGO'
      ? 'domingo'
      : tipoDeDia === 'FERIADO' ? 'feriado' : 'dia normal';

  return {
    fonte: entrada.fonte,
    faixa,
    tipoDeDia,
    adicionalPercentual,
    fator: 1 + adicionalPercentual / 100,
    descricao: `${diaDescricao} · ${faixaDescricao} · ${descricaoDoAdicional(adicionalPercentual)}`,
  };
}

function descricaoDoAdicional(percentual: number): string {
  if (percentual === 0) return 'preço normal';
  return `+${formatarPercentual(percentual)} de aumento`;
}

function formatarPercentual(percentual: number): string {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(percentual)}%`;
}
