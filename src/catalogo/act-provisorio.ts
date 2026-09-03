import type {
  ComposicaoCctProvisoria,
  RegimeRemuneratorio,
  UnidadeDeMedida,
} from '../dominio/tipos.js';
import type { RegistroDeFaina } from './portmac.js';

interface DefinicaoActProvisoria {
  readonly codigo: string;
  readonly descricao: string;
  readonly grupo: string;
  readonly unidade: UnidadeDeMedida;
  readonly regime: RegimeRemuneratorio;
  readonly taxaBase: number;
  readonly observacao: string;
  readonly composicao: readonly ComposicaoCctProvisoria[];
}

const ENCARGOS_E_CONTRIBUICOES = 1.152877;

const COMPOSICAO_LOLO: readonly ComposicaoCctProvisoria[] = [
  { categoria: 'Conferentes', funcoes: ['Conferente-Chefe', 'Conferente-Ajudante', 'Conferente Planista', 'Conferente de Lingada'], homens: 4, cotas: 5.3 },
  { categoria: 'Estivadores', funcoes: ['Contramestre de Porão', 'Estivador de Porão', 'Guincheiro / Sinaleiro'], homens: 9, cotas: 10.1 },
];

const COMPOSICAO_CARGA_GERAL: readonly ComposicaoCctProvisoria[] = [
  { categoria: 'Conferentes', funcoes: ['Conferente-Chefe', 'Conferente-Ajudante', 'Conferente de Lingada'], homens: 3, cotas: 4.15 },
  { categoria: 'Estivadores', funcoes: ['Contramestre de Porão', 'Estivador de Porão', 'Guincheiro / Sinaleiro'], homens: 8, cotas: 9.1 },
];

const COMPOSICAO_GRANEIS: readonly ComposicaoCctProvisoria[] = [
  { categoria: 'Conferentes', funcoes: ['Conferente-Chefe', 'Conferente de Lingada'], homens: 2, cotas: 3.65 },
  { categoria: 'Estivadores', funcoes: ['Contramestre de Porão', 'Estivador de Porão / Operador', 'Guincheiro / Sinaleiro'], homens: 5, cotas: 7.5 },
];

const COMPOSICAO_PEACAO: readonly ComposicaoCctProvisoria[] = [
  { categoria: 'Estivadores', funcoes: ['Estivador de Peação'], homens: 4, cotas: 4 },
];

const DEFINICOES: readonly DefinicaoActProvisoria[] = [
  { codigo: '7.5.1', descricao: 'Movimentação de Contêiner Vazio em Navio Lo-Lo Misto', grupo: 'Contêiner', unidade: 'UNIDADE', regime: 'PRODUCAO', taxaBase: 34.46, observacao: 'Divisão do valor arrecadado pela equipe por cotas', composicao: COMPOSICAO_LOLO },
  { codigo: '7.5.2', descricao: 'Movimentação de Contêiner Cheio em Navio Lo-Lo Misto', grupo: 'Contêiner', unidade: 'UNIDADE', regime: 'PRODUCAO', taxaBase: 36.94, observacao: 'Divisão do valor arrecadado pela equipe por cotas', composicao: COMPOSICAO_LOLO },
  { codigo: '3.1', descricao: 'Blocos de Granito / Mármore', grupo: 'Carga Geral', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 3.01, observacao: 'Equipe com taxa fixa global de R$ 3,01/t para conferência', composicao: COMPOSICAO_CARGA_GERAL },
  { codigo: '3.2', descricao: 'Produtos Siderúrgicos Diversos', grupo: 'Siderurgia', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 4, observacao: 'Taxa fixa global de R$ 4,00/t para conferência', composicao: COMPOSICAO_CARGA_GERAL },
  { codigo: '3.3', descricao: 'Tubos e Trilhos Siderúrgicos', grupo: 'Siderurgia', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 4, observacao: 'Cota de Chefe 2,5 e Lingada 1,25', composicao: COMPOSICAO_CARGA_GERAL },
  { codigo: '1.0', descricao: 'Granéis Minerais/Agrícolas com Grab e Pá Carregadeira', grupo: 'Granéis', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.223, observacao: 'Taxa base R$ 0,223/t para Estiva e Conferentes', composicao: COMPOSICAO_GRANEIS },
  { codigo: '14.1.0', descricao: 'Peação e Despeação de Máquinas e Equipamentos', grupo: 'Peação', unidade: 'EQUIPE', regime: 'SALARIO_DIA', taxaBase: 515.2, observacao: 'Fixada por equipe em R$ 515,20 (Salário-Dia)', composicao: COMPOSICAO_PEACAO },
  { codigo: '1.1', descricao: 'Operação de Granéis sem Produção Mínima', grupo: 'Granéis', unidade: 'TON', regime: 'SALARIO_DIA', taxaBase: 142.587, observacao: 'Salário-Dia mínimo de R$ 142,587 (base)', composicao: COMPOSICAO_GRANEIS },
];

function codigoInterno(codigo: string): string {
  return `ACT_PROVISORIA_${codigo.replace(/\./g, '_')}`;
}

export const fainasActProvisorias: readonly RegistroDeFaina[] = DEFINICOES.map((definicao) => {
  const regra = {
    taxaBase: definicao.taxaBase,
    baseDeCalculo: 'COTAS_DA_EQUIPE' as const,
    regime: definicao.regime,
    unidade: definicao.unidade,
    encargosContribuicaoAdicional: ENCARGOS_E_CONTRIBUICOES,
    composicao: definicao.composicao,
  };
  return {
    codigo: codigoInterno(definicao.codigo),
    codigoDaTabela: definicao.codigo,
    grupoDaTabela: `ACT PROVISÓRIA · ${definicao.grupo}`,
    descricao: definicao.descricao,
    tipoDeCarga: definicao.descricao,
    unidade: definicao.unidade,
    fonte: 'ACT',
    status: 'PROVISORIA',
    vigencia: '2026/2028',
    referencia: `Mapeamento provisório · Analise_ACT_PORTMAC_Calculadora_Terno_Portuario.xlsx · ${definicao.codigo} · ${definicao.observacao}`,
    regra,
    regraActProvisoria: regra,
  };
});
