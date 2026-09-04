import type { ComposicaoDoTerno, RegraDeCategoria } from '../dominio/tipos.js';
import type { RegistroDeFaina } from './portmac.js';

/**
 * Catálogo da ACT 2026/2028 — PORTMAC × SETEMEES e Sindicato dos Conferentes.
 *
 * Fonte única: o acordo assinado em 02/06/2026, transcrito do Anexo I (taxas e
 * salários) e do Anexo II (composição das equipes de referência). A extração
 * completa, com a conferência valor a valor, está em
 * `docs/fontes/ACT-2026-2028-extracao.xlsx`; as regras e as pendências, em
 * `docs/act-2026-2028.md`.
 *
 * Todos os valores usam a coluna "Total c/E.S", que o Anexo Conferentes, 11
 * declara já incluir encargos e contribuição social. As colunas Base e F.Social
 * do documento servem para conferência e não são somadas.
 *
 * O acordo cobre estas seis famílias de carga e nenhuma outra: a cláusula 13ª
 * manda usar a CCT para o que não estiver aqui, e a CCT saiu do sistema.
 */

const VIGENCIA = '2026/2028';
const REFERENCIA = 'ACT 2026/2028 · assinada em 02/06/2026 · Anexos I e II';

// ─── Composições do Anexo II ────────────────────────────────────────────────

/** Granito, produtos siderúrgicos e tubos/trilhos partilham a mesma estiva. */
const ESTIVA_CARGA_GERAL: readonly ComposicaoDoTerno[] = [
  { categoria: 'Contramestre de porão', funcoes: ['Contramestre'], homens: 1, cotas: 1.5 },
  { categoria: 'Estivador de porão', funcoes: ['Porão'], homens: 5, cotas: 5.0 },
  { categoria: 'Portaló', funcoes: ['Portaló'], homens: 1, cotas: 1.0 },
];

const ESTIVA_LOLO: readonly ComposicaoDoTerno[] = [
  { categoria: 'Contramestre de porão', funcoes: ['Contramestre'], homens: 1, cotas: 1.5 },
  { categoria: 'Estivador de porão', funcoes: ['Porão'], homens: 8, cotas: 8.0 },
  { categoria: 'Portaló', funcoes: ['Portaló'], homens: 1, cotas: 1.0 },
];

const ESTIVA_PEACAO: readonly ComposicaoDoTerno[] = [
  { categoria: 'Contramestre de porão', funcoes: ['Contramestre'], homens: 1, cotas: 1.5 },
  { categoria: 'Estivador de porão', funcoes: ['Estivador de peação'], homens: 4, cotas: 4.0 },
];

/** Granéis: as cinco composições do Anexo II diferem só nos estivadores de porão. */
function estivaDeGraneis(estivadores: number): readonly ComposicaoDoTerno[] {
  return [
    { categoria: 'Contramestre de porão', funcoes: ['Contramestre'], homens: 1, cotas: 1.5 },
    { categoria: 'Estivador de porão', funcoes: ['Porão'], homens: estivadores, cotas: estivadores },
    { categoria: 'Sinaleiro', funcoes: ['Sinaleiro'], homens: 1, cotas: 1.0 },
  ];
}

/**
 * Conferentes de granito e siderúrgicos: chefe e ajudante são requisitados por
 * navio, o de lingada em cada terno (Anexo Conferentes, 3-A e 3-B).
 */
const CONFERENTES_CARGA_GERAL: readonly ComposicaoDoTerno[] = [
  { categoria: 'Conferente-chefe', funcoes: ['Chefe'], homens: 1, cotas: 2.0, escopo: 'POR_NAVIO' },
  { categoria: 'Conferente-ajudante', funcoes: ['Ajudante'], homens: 1, cotas: 1.15, escopo: 'POR_NAVIO' },
  { categoria: 'Conferente de lingada', funcoes: ['Lingada'], homens: 1, cotas: 1.0 },
];

/** Tubos e trilhos não têm ajudante e usam cotas próprias (Anexo Conferentes, 3-C e 5-F). */
const CONFERENTES_TUBOS: readonly ComposicaoDoTerno[] = [
  { categoria: 'Conferente-chefe', funcoes: ['Chefe'], homens: 1, cotas: 2.5, escopo: 'POR_NAVIO' },
  { categoria: 'Conferente de lingada', funcoes: ['Lingada'], homens: 1, cotas: 1.25 },
];

const CONFERENTES_LOLO: readonly ComposicaoDoTerno[] = [
  { categoria: 'Conferente-chefe', funcoes: ['Chefe'], homens: 1, cotas: 2.0, escopo: 'POR_NAVIO' },
  { categoria: 'Conferente-ajudante', funcoes: ['Ajudante'], homens: 1, cotas: 1.15, escopo: 'POR_NAVIO' },
  { categoria: 'Conferente planista', funcoes: ['Planista'], homens: 1, cotas: 1.15, escopo: 'POR_NAVIO' },
  { categoria: 'Conferente de lingada', funcoes: ['Lingada'], homens: 1, cotas: 1.0 },
];

const CONFERENTES_GRANEIS: readonly ComposicaoDoTerno[] = [
  { categoria: 'Conferente-chefe', funcoes: ['Chefe'], homens: 1, cotas: 2.5, escopo: 'POR_NAVIO' },
  { categoria: 'Conferente', funcoes: ['Conferente de terno'], homens: 1, cotas: 1.15 },
];

// ─── Anexo I ────────────────────────────────────────────────────────────────

const SALARIO_DIA_GRANITO = 410.14;
const SALARIO_DIA_SIDERURGICO = 360.69;
const SALARIO_DIA_SIDERURGICO_CONFERENTE = 360.68;
const SALARIO_DIA_LOLO_ESTIVA = 471.37;
const SALARIO_DIA_LOLO_CONFERENTE = 424.18;
const SALARIO_DIA_PEACAO = 515.20;
const SALARIO_DIA_GRANEIS = 306.97;
const TAXA_GRANEIS = 0.48;

function faina(
  codigo: string,
  codigoDaTabela: string,
  grupo: string,
  descricao: string,
  tipoDeCarga: string,
  unidade: RegistroDeFaina['unidade'],
  estiva: RegraDeCategoria,
  conferentes: RegraDeCategoria | undefined,
  observacao: string,
): RegistroDeFaina {
  return {
    codigo,
    codigoDaTabela,
    grupoDaTabela: grupo,
    descricao,
    tipoDeCarga,
    unidade,
    fonte: 'ACT',
    status: 'VALIDADA',
    vigencia: VIGENCIA,
    referencia: `${REFERENCIA} · ${observacao}`,
    regra: { unidade, estiva, ...(conferentes ? { conferentes } : {}) },
  };
}

export const fainasAct: readonly RegistroDeFaina[] = [
  faina(
    'ACT_5_1_GRANITO', '5.1', 'Carga geral',
    'Blocos de granito e mármore', 'Granito / mármore', 'TON',
    { taxa: 0.99, baseDaTaxa: 'POR_COTA', salarioDiaPorCota: SALARIO_DIA_GRANITO, composicao: ESTIVA_CARGA_GERAL },
    { taxa: 3.01, baseDaTaxa: 'POR_EQUIPE', salarioDiaPorCota: SALARIO_DIA_GRANITO, composicao: CONFERENTES_CARGA_GERAL },
    'estiva R$ 0,99/t por cota; conferentes R$ 3,01/t para a equipe',
  ),
  faina(
    'ACT_5_9_SIDERURGICO', '5.9', 'Siderurgia',
    'Produtos siderúrgicos (exceto tubos e trilhos)', 'Produtos siderúrgicos', 'TON',
    { taxa: 0.98, baseDaTaxa: 'POR_COTA', salarioDiaPorCota: SALARIO_DIA_SIDERURGICO, composicao: ESTIVA_CARGA_GERAL },
    { taxa: 4.00, baseDaTaxa: 'POR_EQUIPE', salarioDiaPorCota: SALARIO_DIA_SIDERURGICO_CONFERENTE, composicao: CONFERENTES_CARGA_GERAL },
    'estiva R$ 0,98/t por cota; conferentes R$ 4,00/t para a equipe',
  ),
  faina(
    'ACT_5_9_TUBOS_TRILHOS', '5.9', 'Siderurgia',
    'Tubos e trilhos', 'Tubos e trilhos siderúrgicos', 'TON',
    { taxa: 0.98, baseDaTaxa: 'POR_COTA', salarioDiaPorCota: SALARIO_DIA_SIDERURGICO, composicao: ESTIVA_CARGA_GERAL },
    { taxa: 4.00, baseDaTaxa: 'POR_EQUIPE', salarioDiaPorCota: SALARIO_DIA_SIDERURGICO_CONFERENTE, composicao: CONFERENTES_TUBOS },
    'conferentes com cotas próprias: chefe 2,5 e lingada 1,25',
  ),
  faina(
    'ACT_7_5_CONTEINER_VAZIO', '7.5', 'Contêiner',
    'LO-LO misto · contêiner vazio', 'Contêiner vazio', 'UNIDADE',
    { taxa: 8.37, baseDaTaxa: 'POR_COTA', salarioDiaPorCota: SALARIO_DIA_LOLO_ESTIVA, composicao: ESTIVA_LOLO },
    { taxa: 34.46, baseDaTaxa: 'POR_EQUIPE', salarioDiaPorCota: SALARIO_DIA_LOLO_CONFERENTE, composicao: CONFERENTES_LOLO },
    'estiva R$ 8,37/un por cota; conferentes R$ 34,46/un para a equipe',
  ),
  faina(
    'ACT_7_5_CONTEINER_CHEIO', '7.5', 'Contêiner',
    'LO-LO misto · contêiner cheio', 'Contêiner cheio', 'UNIDADE',
    { taxa: 8.89, baseDaTaxa: 'POR_COTA', salarioDiaPorCota: SALARIO_DIA_LOLO_ESTIVA, composicao: ESTIVA_LOLO },
    { taxa: 36.94, baseDaTaxa: 'POR_EQUIPE', salarioDiaPorCota: SALARIO_DIA_LOLO_CONFERENTE, composicao: CONFERENTES_LOLO },
    'estiva R$ 8,89/un por cota; conferentes R$ 36,94/un para a equipe',
  ),
  faina(
    'ACT_7_5_MAQUINAS', '7.5', 'Contêiner',
    'LO-LO misto · máquinas e equipamentos', 'Máquinas e equipamentos', 'TON',
    { taxa: 2.05, baseDaTaxa: 'POR_COTA', salarioDiaPorCota: SALARIO_DIA_LOLO_ESTIVA, composicao: ESTIVA_LOLO },
    { taxa: 1.94, baseDaTaxa: 'POR_EQUIPE', salarioDiaPorCota: SALARIO_DIA_LOLO_CONFERENTE, composicao: CONFERENTES_LOLO },
    'Anexo III, VI: no LO-LO misto o contêiner é por unidade e as demais cargas por tonelada',
  ),
  faina(
    'ACT_19_3_PEACAO', '19.3', 'Peação',
    'Peação e despeação de máquinas e equipamentos', 'Peação / despeação', 'EQUIPE',
    { baseDaTaxa: 'POR_COTA', salarioDiaPorCota: SALARIO_DIA_PEACAO, composicao: ESTIVA_PEACAO },
    undefined,
    'remuneração fixa em porões sem carga mista: só salário-dia, sem produção',
  ),
  ...[
    { n: 1, estivadores: 1, servico: 'descarga com grabs e funil' },
    { n: 2, estivadores: 1, servico: 'descarga com grabs, funil e auxílio de pá carregadeira' },
    { n: 3, estivadores: 3, servico: 'com limpeza do convés' },
    { n: 4, estivadores: 5, servico: 'com limpeza do convés e piso do porão' },
    { n: 5, estivadores: 9, servico: 'com limpeza do convés, piso do porão, cavernas e amuras' },
  ].map(({ n, estivadores, servico }) => faina(
    `ACT_GRANEIS_${n}`, `Granéis ${n}`, 'Granéis',
    `Granéis ${n} · ${servico}`, 'Granéis sólidos', 'TON',
    { taxa: TAXA_GRANEIS, baseDaTaxa: 'POR_COTA', salarioDiaPorCota: SALARIO_DIA_GRANEIS, composicao: estivaDeGraneis(estivadores) },
    { taxa: TAXA_GRANEIS, baseDaTaxa: 'POR_COTA', salarioDiaPorCota: SALARIO_DIA_GRANEIS, composicao: CONFERENTES_GRANEIS },
    `Anexo II Granéis item ${n}: ${estivadores} estivador(es) de porão · taxa única de R$ 0,48/t para as cinco composições`,
  )),
];
