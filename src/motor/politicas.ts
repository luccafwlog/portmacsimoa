/**
 * Políticas de cálculo — as decisões que a spec ainda não fechou.
 *
 * Cada campo aqui é uma pergunta aberta num ticket do mapa. O motor lê a
 * política em vez de embutir a resposta, por três motivos:
 *
 * 1. Quando o diretor responder, muda-se um default e os testes dizem o que
 *    o número fez — em vez de caçar a regra espalhada pelo código.
 * 2. O resultado da simulação carrega a lista de premissas que usou, então
 *    nenhuma escolha nossa passa por dado do cliente (#15, item 5).
 * 3. Dá para rodar a mesma simulação sob duas políticas e medir a diferença,
 *    que é o argumento mais persuasivo numa conversa de grilling.
 *
 * O default de cada campo é a leitura mais defensável dos documentos hoje —
 * não é a resposta.
 */

export interface PoliticasDeCalculo {
  /**
   * Fração de período (#8, item 5 · #3, item 3).
   *
   * `CEIL`: todo período iniciado é requisitado por inteiro — e, como cada
   * período requisitado carrega o piso de salário-dia, isso pesa muito em navio
   * pequeno. `EXATO` deixa a fração proporcional, útil só para comparação.
   */
  readonly arredondamentoDePeriodos: 'CEIL' | 'EXATO';

  /**
   * Como a produção se distribui entre os períodos (#8, item 4 e 6).
   *
   * `SATURADO`: cada período produz o máximo da produtividade e o último fica
   * com o resto — o período de sobra costuma cair no regime de piso, que é
   * exatamente o efeito que o comercial precisa enxergar.
   * `UNIFORME`: divide igualmente, escondendo esse efeito.
   */
  readonly distribuicaoDaProducao: 'SATURADO' | 'UNIFORME';

  /**
   * O adicional de período (noturno, domingo, feriado) incide também sobre o
   * piso de salário-dia, ou só sobre a remuneração por produção?
   *
   * Default `true`: o ACT trata o adicional como percentual sobre a remuneração
   * do período, e o piso é a remuneração quando a produção não o alcança.
   * Não está escrito em nenhum lugar que o piso escape do adicional — mas
   * também não está escrito que se aplica. Pergunta para o diretor.
   */
  readonly adicionalIncideSobreOPiso: boolean;

  /**
   * Homens extras — guincheiro, operador de empilhadeira (#16, item 3).
   *
   * O ACT os chama de requisição facultativa. Se na prática eles quase sempre
   * são requisitados, o default `false` subestima a cotação de forma
   * sistemática, que é o pior modo de falha desta ferramenta.
   */
  readonly incluirHomensExtras: boolean;

  /**
   * Classe do período noturno, que atravessa a meia-noite (#10, item 4).
   *
   * O período 19h–7h começa num dia e termina no seguinte. `DIA_DE_INICIO`
   * classifica pelo dia em que a jornada começou — a leitura natural de
   * "sábado noturno" no ACT. Mas o sábado noturno termina num domingo, e nada
   * nos documentos diz qual dos dois manda.
   */
  readonly classeDoPeriodoNoturno: 'DIA_DE_INICIO' | 'DIA_DE_TERMINO';

  /**
   * Cargas múltiplas no mesmo navio (#17, item 2).
   *
   * `SEQUENCIAL`: os ternos terminam uma carga antes de começar a próxima.
   * É a única leitura que dá uma linha do tempo bem definida sem inventar
   * regra de alocação de ternos entre frentes.
   */
  readonly sequenciamentoDeCargas: 'SEQUENCIAL';

  /**
   * Taxa de administração do OGMO, como fração sobre o custo de mão de obra
   * (#11, item 1).
   *
   * Não aparece no ACT nem na CCT. Default 0 — e o resultado avisa que está
   * assumindo zero, porque se existir e for percentual sobre o MMO, é um
   * multiplicador direto sobre todo o custo.
   */
  readonly taxaDeAdministracaoOgmo: number;

  /**
   * Fundo indenizatório de 1% sobre o MMO (ACT, Cláusula Décima Quinta, §1º).
   *
   * É desembolso explícito da PORTMAC e aparentemente está **fora** do fator
   * 2,152842, que cobre encargos e contribuição social. Default 0,01, com
   * premissa registrada — só uma fatura real do OGMO fecha isso (#11, item 2).
   */
  readonly fundoIndenizatorio: number;

  /**
   * Qual data seleciona a versão do catálogo (#12, item 2).
   *
   * `DATA_DA_OPERACAO`: o navio atraca em fevereiro, vale a tabela de
   * fevereiro — mesmo cotando em dezembro. É o que o comercial precisa.
   */
  readonly dataQueDeterminaVigencia: 'DATA_DA_OPERACAO' | 'DATA_DA_SIMULACAO';
}

export const POLITICAS_PADRAO: PoliticasDeCalculo = {
  arredondamentoDePeriodos: 'CEIL',
  distribuicaoDaProducao: 'SATURADO',
  adicionalIncideSobreOPiso: true,
  incluirHomensExtras: false,
  classeDoPeriodoNoturno: 'DIA_DE_INICIO',
  sequenciamentoDeCargas: 'SEQUENCIAL',
  taxaDeAdministracaoOgmo: 0,
  fundoIndenizatorio: 0.01,
  dataQueDeterminaVigencia: 'DATA_DA_OPERACAO',
};

export function comPoliticas(
  ajustes: Partial<PoliticasDeCalculo>,
): PoliticasDeCalculo {
  return { ...POLITICAS_PADRAO, ...ajustes };
}

/**
 * Uma premissa que o motor assumiu por falta de decisão ou de dado.
 *
 * O resultado da simulação carrega todas as que usou. A regra é dura de
 * propósito: se o motor escolheu alguma coisa, isso aparece na tela.
 */
export interface Premissa {
  readonly codigo: string;
  readonly descricao: string;
  /** Número da issue que fecha esta premissa. */
  readonly issue: number;
}
