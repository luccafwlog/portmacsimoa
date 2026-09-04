import type { RegistroDeFaina } from '../src/catalogo/portmac.js';

/**
 * Fainas falsas para exercitar o motor.
 *
 * Números redondos e inventados, escolhidos só para a conta ser verificável de
 * cabeça: uma correção de tabela na ACT não deve quebrar o teste do motor. As
 * fainas reais vivem em `src/catalogo/act.ts` e são conferidas pelos testes de
 * catálogo, não por estes.
 */

/** Estiva por cota, 10 cotas por terno, piso de R$ 1.000 por cota. */
export const fainaDeProducao: RegistroDeFaina = {
  codigo: 'TESTE_PRODUCAO',
  codigoDaTabela: 'T.1',
  grupoDaTabela: 'Teste',
  descricao: 'Faina de teste em regime de produção',
  tipoDeCarga: 'Carga de teste',
  unidade: 'TON',
  fonte: 'ACT',
  status: 'VALIDADA',
  vigencia: 'teste',
  referencia: 'Catálogo falso de teste · T.1',
  regra: {
    unidade: 'TON',
    estiva: {
      taxa: 2,
      baseDaTaxa: 'POR_COTA',
      salarioDiaPorCota: 1000,
      composicao: [
        { categoria: 'Contramestre', funcoes: ['Contramestre'], homens: 1, cotas: 2 },
        { categoria: 'Porão', funcoes: ['Porão'], homens: 8, cotas: 8 },
      ],
    },
  },
};

/** Faina sem taxa: paga sempre o salário-dia, como a peação da ACT. */
export const fainaDeSalarioDia: RegistroDeFaina = {
  codigo: 'TESTE_SALARIO_DIA',
  codigoDaTabela: 'T.2',
  grupoDaTabela: 'Teste',
  descricao: 'Faina de teste em salário-dia fixo',
  tipoDeCarga: 'Peação de teste',
  unidade: 'EQUIPE',
  fonte: 'ACT',
  status: 'VALIDADA',
  vigencia: 'teste',
  referencia: 'Catálogo falso de teste · T.2',
  regra: {
    unidade: 'EQUIPE',
    estiva: {
      baseDaTaxa: 'POR_COTA',
      salarioDiaPorCota: 500,
      composicao: [{ categoria: 'Peação', funcoes: ['Estivador de peação'], homens: 4, cotas: 5 }],
    },
  },
};

/** Estiva + conferentes, com chefe por navio: exercita os dois escopos. */
export const fainaComConferentes: RegistroDeFaina = {
  ...fainaDeProducao,
  codigo: 'TESTE_CONFERENTES',
  codigoDaTabela: 'T.3',
  descricao: 'Faina de teste com conferentes',
  referencia: 'Catálogo falso de teste · T.3',
  regra: {
    unidade: 'TON',
    estiva: fainaDeProducao.regra!.estiva,
    conferentes: {
      taxa: 5,
      baseDaTaxa: 'POR_EQUIPE',
      salarioDiaPorCota: 100,
      composicao: [
        { categoria: 'Chefe', funcoes: ['Chefe'], homens: 1, cotas: 2, escopo: 'POR_NAVIO' },
        { categoria: 'Lingada', funcoes: ['Lingada'], homens: 1, cotas: 1 },
      ],
    },
  },
};

export const COTAS_DA_ESTIVA_DE_TESTE = 10;
export const TAXA_DA_ESTIVA_DE_TESTE = 2;
export const PISO_DA_ESTIVA_DE_TESTE = 1000;
