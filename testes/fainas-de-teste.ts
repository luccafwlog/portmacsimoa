import type { ComposicaoDoTerno } from '../src/dominio/tipos.js';
import type { RegistroDeFaina } from '../src/catalogo/portmac.js';

/**
 * Fainas falsas para exercitar o motor.
 *
 * O catálogo da aplicação está vazio à espera da transcrição correta da ACT,
 * e mesmo depois dela os testes do motor não devem depender de um número
 * documental que pode mudar: uma correção de tabela não é uma regressão de
 * cálculo. Os valores abaixo existem só para tornar a conta verificável.
 */
const ENCARGOS_E_CONTRIBUICOES = 1.152877;

const COMPOSICAO_CARGA_GERAL: readonly ComposicaoDoTerno[] = [
  { categoria: 'Conferentes', funcoes: ['Conferente-Chefe', 'Conferente de Lingada'], homens: 3, cotas: 4.15 },
  { categoria: 'Estivadores', funcoes: ['Contramestre de Porão', 'Estivador de Porão'], homens: 8, cotas: 9.1 },
];

const COMPOSICAO_PEACAO: readonly ComposicaoDoTerno[] = [
  { categoria: 'Estivadores', funcoes: ['Estivador de Peação'], homens: 4, cotas: 4 },
];

/** Faina de teste em regime de produção, cobrada por tonelada. */
export const fainaDeProducao: RegistroDeFaina = {
  codigo: 'TESTE_PRODUCAO',
  codigoDaTabela: 'T.1',
  grupoDaTabela: 'Teste · Carga Geral',
  descricao: 'Faina de teste em regime de produção',
  tipoDeCarga: 'Carga geral de teste',
  unidade: 'TON',
  fonte: 'ACT',
  status: 'PROVISORIA',
  vigencia: 'teste',
  referencia: 'Catálogo falso de teste · T.1',
  regraAct: {
    taxaBase: 3.01,
    regime: 'PRODUCAO',
    unidade: 'TON',
    encargosContribuicaoAdicional: ENCARGOS_E_CONTRIBUICOES,
    composicao: COMPOSICAO_CARGA_GERAL,
  },
};

/** Faina de teste em salário-dia, cobrada por equipe e multiplicada por terno. */
export const fainaDeSalarioDia: RegistroDeFaina = {
  codigo: 'TESTE_SALARIO_DIA',
  codigoDaTabela: 'T.2',
  grupoDaTabela: 'Teste · Peação',
  descricao: 'Faina de teste em salário-dia',
  tipoDeCarga: 'Peação de teste',
  unidade: 'EQUIPE',
  fonte: 'ACT',
  status: 'PROVISORIA',
  vigencia: 'teste',
  referencia: 'Catálogo falso de teste · T.2',
  regraAct: {
    taxaBase: 515.2,
    regime: 'SALARIO_DIA',
    unidade: 'EQUIPE',
    encargosContribuicaoAdicional: ENCARGOS_E_CONTRIBUICOES,
    composicao: COMPOSICAO_PEACAO,
  },
};

export const COTAS_DA_CARGA_GERAL = COMPOSICAO_CARGA_GERAL
  .reduce((soma, item) => soma + item.cotas, 0);
export const COTAS_DA_PEACAO = COMPOSICAO_PEACAO
  .reduce((soma, item) => soma + item.cotas, 0);
export const ENCARGOS_DE_TESTE = ENCARGOS_E_CONTRIBUICOES;
