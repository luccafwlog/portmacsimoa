import { data } from '../dominio/tempo.js';
import type {
  ComposicaoDeEquipe,
  Cobertura,
  Faina,
  Remuneracao,
  ValorTabelado,
  Vigencia,
} from '../dominio/tipos.js';
import type { DadosDeCatalogo } from './portas.js';

/**
 * Catálogo semente — o pedaço do ACT 2026/2028 que já foi lido e conferido.
 *
 * Não é o catálogo da PORTMAC. É o mínimo para o motor rodar de ponta a ponta
 * e para os testes ancorarem em números que vieram do documento, não da nossa
 * cabeça. O catálogo de verdade entra pelo #2, e a CCT inteira — que é larga,
 * fainas 1.1 a 19.x — não está aqui.
 */

/** ANEXO I do ACT, rodapé: `Fator: 2,152842`. */
export const FATOR_ENCARGOS = 2.152842;

/** Cláusula Sétima: contribuição social de 23% sobre o MMO. */
export const CONTRIBUICAO_SOCIAL = 0.23;

/**
 * Deriva a coluna `Total c/E.S` a partir da `Base`, arredondando ao centavo.
 *
 * Serve para conferir a tabela, não para substituí-la: quando o valor
 * publicado divergir do derivado, o publicado é que vale, e a divergência é
 * um achado a registrar.
 */
export function totalComEncargos(base: number): number {
  return Math.round(base * FATOR_ENCARGOS * 100) / 100;
}

export function valor(base: number, total?: number): ValorTabelado {
  return { base, totalComEncargos: total ?? totalComEncargos(base) };
}

/** ACT assinado em 02/06/2026, vigência até 30/06/2028. */
export const VIGENCIA_ACT: Vigencia = {
  de: data(2026, 6, 1),
  ate: data(2028, 6, 30),
};

const FAINAS: readonly Faina[] = [
  { codigo: '5.1', descricao: 'Granito', unidade: 'TON' },
  { codigo: '5.9', descricao: 'Produto Siderúrgico', unidade: 'TON' },
  { codigo: '5.9-TT', descricao: 'Tubos e Trilhos', unidade: 'TON' },
  { codigo: '7.5-VAZIO', descricao: 'LO-LO Contêiner Vazio', unidade: 'UND' },
  { codigo: '7.5-CHEIO', descricao: 'LO-LO Contêiner Cheio', unidade: 'UND' },
  { codigo: '7.5-MAQ', descricao: 'LO-LO Máquinas e Equipamentos', unidade: 'TON' },
];

/**
 * A matriz esparsa do #9: as exceções ACT sobre o default CCT.
 *
 * Arrumadores, vigias e suporte não aparecem aqui e nunca vão aparecer — o
 * ACT não representa essas categorias, então para elas não existe nem a
 * hipótese de exceção.
 */
const COBERTURAS: readonly Cobertura[] = [
  '5.1',
  '5.9',
  '5.9-TT',
  '7.5-VAZIO',
  '7.5-CHEIO',
  '7.5-MAQ',
].flatMap((faina) =>
  (['ESTIVADORES', 'CONFERENTES'] as const).map((categoria) => ({
    faina,
    categoria,
    instrumento: 'ACT' as const,
    vigencia: VIGENCIA_ACT,
  })),
);

/**
 * ANEXO II do ACT — equipe referência da estiva. Tudo escala por terno.
 *
 * O ANEXO III é explícito: "A equipe básica para cada terno em operação será
 * constante das Tabelas de Composição de Equipe".
 */
function equipeDeEstiva(faina: string, homensDePorao: number): ComposicaoDeEquipe {
  return {
    instrumento: 'ACT',
    faina,
    categoria: 'ESTIVADORES',
    vigencia: VIGENCIA_ACT,
    posicoes: [
      { funcao: 'Contramestre', quantidade: 1, cota: 1.5, escala: 'POR_TERNO' },
      { funcao: 'Porão', quantidade: homensDePorao, cota: 1.0, escala: 'POR_TERNO' },
      { funcao: 'Portaló', quantidade: 1, cota: 1.0, escala: 'POR_TERNO' },
      {
        funcao: 'Guincheiro (homem extra)',
        quantidade: 2,
        cota: 1.3,
        escala: 'POR_TERNO',
        facultativa: true,
      },
      {
        funcao: 'Operador de empilhadeira (homem extra)',
        quantidade: 1,
        cota: 1.3,
        escala: 'POR_TERNO',
        facultativa: true,
      },
    ],
  };
}

/**
 * ANEXO III do ACT — conferência: "01 conferente chefe, por navio; 01
 * conferente ajudante, por navio; 01 conferente lingada, para cada terno em
 * operação".
 *
 * É a composição que quebra o modelo `custo × ternos × períodos` (#16).
 */
function equipeDeConferencia(faina: string): ComposicaoDeEquipe {
  return {
    instrumento: 'ACT',
    faina,
    categoria: 'CONFERENTES',
    vigencia: VIGENCIA_ACT,
    posicoes: [
      { funcao: 'Conferente chefe', quantidade: 1, cota: 2.0, escala: 'POR_NAVIO' },
      { funcao: 'Conferente ajudante', quantidade: 1, cota: 1.3, escala: 'POR_NAVIO' },
      { funcao: 'Conferente de lingada', quantidade: 1, cota: 1.0, escala: 'POR_TERNO' },
    ],
  };
}

/**
 * Salário-dia dos conferentes — **ainda não lido no documento**.
 *
 * O valor abaixo repete o da estiva só para o motor ter o que consumir. Toda
 * simulação que o tocar carrega a pendência no resultado. Fecha com o #2.
 */
const SALARIO_DIA_CONFERENTE_PENDENTE = valor(190.51, 410.14);

const COMPOSICOES: readonly ComposicaoDeEquipe[] = [
  equipeDeEstiva('5.1', 5),
  equipeDeEstiva('5.9', 5),
  equipeDeEstiva('5.9-TT', 5),
  // LO-LO misto usa a mesma estrutura com 8 homens de porão.
  equipeDeEstiva('7.5-VAZIO', 8),
  equipeDeEstiva('7.5-CHEIO', 8),
  equipeDeEstiva('7.5-MAQ', 8),
  equipeDeConferencia('5.1'),
  equipeDeConferencia('7.5-CHEIO'),
  equipeDeConferencia('7.5-VAZIO'),
];

const REMUNERACOES: readonly Remuneracao[] = [
  // Estiva, granito: taxa homem 0,46 → 0,99 · salário-dia 190,51 → 410,14.
  {
    instrumento: 'ACT',
    faina: '5.1',
    categoria: 'ESTIVADORES',
    unidadeDaTaxa: 'POR_HOMEM',
    taxa: { tipo: 'LINEAR', valor: valor(0.46, 0.99) },
    salarioDia: valor(190.51, 410.14),
    vigencia: VIGENCIA_ACT,
  },
  // Conferência, granito: taxa equipe 1,399 → 3,01 por tonelada movimentada,
  // "independentemente da quantidade de ternos".
  {
    instrumento: 'ACT',
    faina: '5.1',
    categoria: 'CONFERENTES',
    unidadeDaTaxa: 'POR_EQUIPE',
    taxa: { tipo: 'LINEAR', valor: valor(1.399, 3.01) },
    salarioDia: SALARIO_DIA_CONFERENTE_PENDENTE,
    vigencia: VIGENCIA_ACT,
    pendenteDeConferencia: {
      campo: 'salarioDia',
      motivo:
        'O salário-dia dos conferentes ainda não foi lido no ANEXO I; o valor em uso é o da estiva, como marcador.',
    },
  },
];

export const CATALOGO_SEMENTE: DadosDeCatalogo = {
  fainas: FAINAS,
  coberturas: COBERTURAS,
  composicoes: COMPOSICOES,
  remuneracoes: REMUNERACOES,
};
