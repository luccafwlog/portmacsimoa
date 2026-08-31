import { apenasData, somarMinutos, type DataLocal } from '../dominio/tempo.js';
import type {
  CargaSimulada,
  Categoria,
  ClasseDeDia,
  CustoOpcional,
  EntradaDeSimulacao,
  Instrumento,
  Turno,
  UnidadeDeMedida,
} from '../dominio/tipos.js';
import type { Catalogo } from '../catalogo/portas.js';
import type { CalendarioOgmo } from '../calendario/portas.js';
import { dimensionarEquipe } from './equipe.js';
import { POLITICAS_PADRAO, type Premissa, type PoliticasDeCalculo } from './politicas.js';
import { HORAS_POR_PERIODO, projetarPeriodos } from './periodos.js';
import { custoDaCategoriaNoPeriodo, type Regime } from './remuneracao.js';
import type {
  CustoDeCategoria,
  Indicador,
  ResumoDeCategoria,
  PeriodoDoResultado,
  ResultadoDeSimulacao,
  TrechoDaOperacao,
} from './resultado.js';

export class EntradaInvalida extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'EntradaInvalida';
  }
}

export class CatalogoIncompleto extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'CatalogoIncompleto';
  }
}

const ROTULO_POR_UNIDADE: Record<UnidadeDeMedida, string> = {
  TON: 'R$/ton',
  UND: 'R$/und',
  VOLUME: 'R$/volume',
};

/** Acumula premissas sem repetir a mesma duas vezes. */
class Premissas {
  private readonly porCodigo = new Map<string, Premissa>();

  registrar(codigo: string, descricao: string, issue: number): void {
    if (!this.porCodigo.has(codigo)) {
      this.porCodigo.set(codigo, { codigo, descricao, issue });
    }
  }

  lista(): readonly Premissa[] {
    return [...this.porCodigo.values()];
  }
}

export function simular(
  entrada: EntradaDeSimulacao,
  catalogo: Catalogo,
  calendario: CalendarioOgmo,
  politicas: PoliticasDeCalculo = POLITICAS_PADRAO,
): ResultadoDeSimulacao {
  validar(entrada);

  const premissas = new Premissas();
  const dataDeReferencia = resolverDataDeReferencia(entrada, politicas, premissas);

  // 1. Quantos períodos cada carga consome, e a linha do tempo inteira.
  const planos = entrada.cargas.map((carga) =>
    planejarCarga(carga, entrada.ternos, catalogo, dataDeReferencia, politicas),
  );
  const totalDePeriodos = planos.reduce((s, p) => s + p.periodos, 0);
  const linhaDoTempo = projetarPeriodos(
    entrada.inicio,
    totalDePeriodos,
    calendario,
    politicas,
  );

  // 2. Custo período a período. O piso só se avalia aqui — é o que impede
  //    tratar a operação como uma regra de três sobre a média.
  const periodos: PeriodoDoResultado[] = [];
  let cursor = 0;
  const trechos: TrechoDaOperacao[] = [];

  for (const plano of planos) {
    let custoDoTrecho = 0;
    for (let i = 0; i < plano.periodos; i++) {
      const janela = linhaDoTempo[cursor + i];
      if (janela === undefined) break;
      const producao = plano.producoes[i] ?? 0;
      const fracao = plano.fracoes[i] ?? 1;
      const periodo = custoDoPeriodo(
        plano,
        janela,
        producao,
        fracao,
        entrada.ternos,
        catalogo,
        dataDeReferencia,
        politicas,
        premissas,
      );
      periodos.push(periodo);
      custoDoTrecho += periodo.custo;
    }
    cursor += plano.periodos;
    trechos.push({
      faina: plano.carga.faina,
      unidade: plano.unidade,
      quantidade: plano.carga.quantidade,
      periodos: plano.periodos,
      custoMaoDeObra: custoDoTrecho,
    });
  }

  const custoMaoDeObra = periodos.reduce((s, p) => s + p.custo, 0);

  // Sob CEIL toda fração é 1 e isto é a contagem de períodos. Sob EXATO a
  // duração precisa sair das frações, senão a linha do tempo contradiz o
  // `fracaoRequisitada` que o próprio resultado publica — e os custos por
  // período seriam cobrados por uma jornada que não foi requisitada.
  const duracaoEmPeriodos = periodos.reduce((s, p) => s + p.fracaoRequisitada, 0);

  // 3. Componentes que incidem sobre o montante de mão de obra.
  const custoDeAdministracaoOgmo = custoMaoDeObra * politicas.taxaDeAdministracaoOgmo;
  const custoDoFundoIndenizatorio = custoMaoDeObra * politicas.fundoIndenizatorio;
  if (politicas.taxaDeAdministracaoOgmo === 0) {
    premissas.registrar(
      'TAXA_OGMO_ZERO',
      'Taxa de administração do OGMO assumida como zero — ela não aparece no ACT nem na CCT e só uma fatura real confirma se existe.',
      11,
    );
  }
  if (politicas.fundoIndenizatorio > 0) {
    premissas.registrar(
      'FUNDO_INDENIZATORIO',
      `Fundo indenizatório de ${(politicas.fundoIndenizatorio * 100).toFixed(2)}% sobre o MMO aplicado por fora do fator 2,152842 (ACT, Cláusula Décima Quinta, §1º) — a confirmar em fatura.`,
      11,
    );
  }

  const custosOpcionais = somarCustosOpcionais(
    entrada.custosOpcionais ?? [],
    planos,
    duracaoEmPeriodos,
  );
  if ((entrada.custosOpcionais ?? []).length === 0) {
    premissas.registrar(
      'SEM_CUSTOS_OPCIONAIS',
      'Nenhum custo opcional informado (peação, madeira, locação de máquina, içamento) — o resultado é só mão de obra.',
      5,
    );
  }

  const custoTotal =
    custoMaoDeObra +
    custoDeAdministracaoOgmo +
    custoDoFundoIndenizatorio +
    custosOpcionais;

  // 4. Indicadores. Cada unidade de medida rende o seu.
  const indicadores = montarIndicadores(trechos, custoTotal, custoMaoDeObra);
  const indicadorPrincipal = indicadores.length === 1 ? indicadores[0]! : null;
  if (indicadorPrincipal === null && indicadores.length > 1) {
    premissas.registrar(
      'NAVIO_MISTO',
      'O navio mistura unidades de medida diferentes; não existe um R$/ton único e o número-título passa a ser o custo total.',
      17,
    );
  }

  registrarPremissasDeCalendario(calendario, premissas);
  registrarPremissasDePolitica(politicas, premissas);

  const ultimo = linhaDoTempo[linhaDoTempo.length - 1];
  const ultimaFracao = periodos[periodos.length - 1]?.fracaoRequisitada ?? 1;

  return {
    entrada,
    politicas,
    dataDeReferenciaDoCatalogo: dataDeReferencia,
    inicio: linhaDoTempo[0]?.inicio ?? entrada.inicio,
    terminoPrevisto: ultimo
      ? somarMinutos(ultimo.inicio, ultimaFracao * HORAS_POR_PERIODO * 60)
      : entrada.inicio,
    duracaoEmPeriodos,
    custoMaoDeObra,
    custoDeAdministracaoOgmo,
    custoDoFundoIndenizatorio,
    custosOpcionais,
    custoTotal,
    indicadorPrincipal,
    indicadores,
    periodos,
    trechos,
    porCategoria: agruparPorCategoria(periodos),
    porInstrumento: agruparPorInstrumento(periodos),
    porClasseDeDia: agruparPorClasseDeDia(periodos),
    regimeDominante: regimeDominante(periodos),
    premissas: premissas.lista(),
  };
}

function validar(entrada: EntradaDeSimulacao): void {
  if (entrada.ternos < 1 || !Number.isInteger(entrada.ternos)) {
    throw new EntradaInvalida('A quantidade de ternos deve ser um inteiro ≥ 1.');
  }
  if (entrada.cargas.length === 0) {
    throw new EntradaInvalida('A simulação precisa de ao menos uma carga.');
  }
  for (const carga of entrada.cargas) {
    if (carga.quantidade <= 0) {
      throw new EntradaInvalida(`Quantidade inválida na faina ${carga.faina}.`);
    }
    if (carga.produtividadePorTernoPorPeriodo <= 0) {
      throw new EntradaInvalida(
        `Produtividade inválida na faina ${carga.faina}: sem produtividade a operação nunca termina.`,
      );
    }
  }
}

function resolverDataDeReferencia(
  entrada: EntradaDeSimulacao,
  politicas: PoliticasDeCalculo,
  premissas: Premissas,
): DataLocal {
  if (entrada.dataDeReferenciaDoCatalogo !== undefined) {
    return entrada.dataDeReferenciaDoCatalogo;
  }
  if (politicas.dataQueDeterminaVigencia === 'DATA_DA_SIMULACAO') {
    premissas.registrar(
      'VIGENCIA_SEM_DATA_DE_SIMULACAO',
      'A política pede a data da simulação para escolher o catálogo, mas ela não foi informada; usou-se a data de início da operação.',
      12,
    );
  }
  return apenasData(entrada.inicio);
}

interface PlanoDeCarga {
  readonly carga: CargaSimulada;
  readonly unidade: UnidadeDeMedida;
  readonly periodos: number;
  readonly producoes: readonly number[];
  readonly fracoes: readonly number[];
  readonly categorias: readonly Categoria[];
}

function planejarCarga(
  carga: CargaSimulada,
  ternos: number,
  catalogo: Catalogo,
  em: DataLocal,
  politicas: PoliticasDeCalculo,
): PlanoDeCarga {
  const faina = catalogo.faina(carga.faina, em);
  if (faina === undefined) {
    throw new CatalogoIncompleto(
      `Faina ${carga.faina} não está no catálogo vigente em ${em.ano}-${em.mes}-${em.dia}.`,
    );
  }

  const capacidadePorPeriodo = carga.produtividadePorTernoPorPeriodo * ternos;
  const exato = carga.quantidade / capacidadePorPeriodo;
  const periodos = Math.max(1, Math.ceil(exato));

  const producoes: number[] = [];
  const fracoes: number[] = [];
  let restante = carga.quantidade;
  for (let i = 0; i < periodos; i++) {
    const producao =
      politicas.distribuicaoDaProducao === 'UNIFORME'
        ? carga.quantidade / periodos
        : Math.min(capacidadePorPeriodo, restante);
    producoes.push(producao);
    restante -= producao;
    // Sob CEIL todo período iniciado é requisitado inteiro — e cada período
    // requisitado carrega o piso, mesmo sem produção.
    const ehUltimo = i === periodos - 1;
    fracoes.push(
      politicas.arredondamentoDePeriodos === 'EXATO' && ehUltimo
        ? exato - (periodos - 1)
        : 1,
    );
  }

  const categorias = catalogo.categoriasDaFaina(carga.faina, em);
  if (categorias.length === 0) {
    throw new CatalogoIncompleto(
      `Nenhuma composição de equipe cadastrada para a faina ${carga.faina}.`,
    );
  }

  return { carga, unidade: faina.unidade, periodos, producoes, fracoes, categorias };
}

function custoDoPeriodo(
  plano: PlanoDeCarga,
  janela: {
    indice: number;
    inicio: PeriodoDoResultado['inicio'];
    fim: PeriodoDoResultado['fim'];
    turno: Turno;
    classeDeDia: ClasseDeDia;
    multiplicador: number;
  },
  producao: number,
  fracao: number,
  ternos: number,
  catalogo: Catalogo,
  em: DataLocal,
  politicas: PoliticasDeCalculo,
  premissas: Premissas,
): PeriodoDoResultado {
  const porCategoria: CustoDeCategoria[] = [];
  let custo = 0;

  for (const categoria of plano.categorias) {
    const instrumento = catalogo.instrumentoAplicavel(plano.carga.faina, categoria, em);
    const composicao = catalogo.composicaoDeEquipe(
      instrumento,
      plano.carga.faina,
      categoria,
      em,
    );
    const remuneracao = catalogo.remuneracao(
      instrumento,
      plano.carga.faina,
      categoria,
      em,
    );
    if (composicao === undefined || remuneracao === undefined) {
      throw new CatalogoIncompleto(
        `Falta ${composicao === undefined ? 'composição de equipe' : 'remuneração'} de ${categoria} para a faina ${plano.carga.faina} sob ${instrumento}.`,
      );
    }

    for (const fonte of [composicao, remuneracao]) {
      const pendencia = fonte.pendenteDeConferencia;
      if (pendencia !== undefined) {
        premissas.registrar(
          `CATALOGO_PENDENTE:${plano.carga.faina}:${categoria}:${pendencia.campo}`,
          `${categoria} / faina ${plano.carga.faina}: ${pendencia.motivo}`,
          2,
        );
      }
    }

    const posicoes = dimensionarEquipe(composicao, ternos, politicas);
    const parcial = custoDaCategoriaNoPeriodo(
      remuneracao,
      posicoes,
      {
        producaoDoPeriodo: producao,
        producaoPorTerno: producao / ternos,
        quantidadeTotalDaCarga: plano.carga.quantidade,
        multiplicador: janela.multiplicador,
        fracaoRequisitada: fracao,
      },
      politicas,
    );

    const custoDaCategoria = parcial.custo;
    custo += custoDaCategoria;
    porCategoria.push({
      categoria,
      instrumento,
      custo: custoDaCategoria,
      trabalhadores: parcial.trabalhadores,
      trabalhadoresNoPiso: parcial.trabalhadoresNoPiso,
      regime: parcial.regimeDominante,
    });
  }

  return {
    indice: janela.indice,
    inicio: janela.inicio,
    fim: janela.fim,
    turno: janela.turno,
    classeDeDia: janela.classeDeDia,
    multiplicador: janela.multiplicador,
    fracaoRequisitada: fracao,
    faina: plano.carga.faina,
    producao,
    custo,
    porCategoria,
  };
}

/**
 * Custos opcionais (#5).
 *
 * `POR_PERIODO` cobre locação de máquina, que é custo de tempo e por isso só
 * pode ser somado depois de a duração estar calculada — daí a ordem.
 *
 * `POR_UNIDADE_DE_CARGA` exige saber *de qual carga*. Num navio que mistura
 * toneladas e contêineres, somar as duas quantidades para multiplicar por um
 * preço unitário devolve um número sem dimensão — e grande. Ou o custo aponta
 * a faina, ou o navio inteiro está numa unidade só; qualquer outro caso é
 * recusado em vez de virar cotação.
 */
function somarCustosOpcionais(
  custos: readonly CustoOpcional[],
  planos: readonly PlanoDeCarga[],
  periodos: number,
): number {
  let total = 0;
  for (const custo of custos) {
    switch (custo.tipo) {
      case 'VALOR_TOTAL':
        total += custo.valor;
        break;
      case 'POR_UNIDADE_DE_CARGA':
        total += custo.valor * quantidadeAlvo(custo, planos);
        break;
      case 'POR_PERIODO':
        total += custo.valor * periodos;
        break;
    }
  }
  return total;
}

function quantidadeAlvo(
  custo: CustoOpcional,
  planos: readonly PlanoDeCarga[],
): number {
  if (custo.faina !== undefined) {
    const plano = planos.find((p) => p.carga.faina === custo.faina);
    if (plano === undefined) {
      throw new EntradaInvalida(
        `O custo opcional "${custo.descricao}" aponta a faina ${custo.faina}, que não está nesta simulação.`,
      );
    }
    return plano.carga.quantidade;
  }

  const unidades = new Set(planos.map((p) => p.unidade));
  if (unidades.size > 1) {
    throw new EntradaInvalida(
      `O custo opcional "${custo.descricao}" é por unidade de carga, mas o navio mistura ${[...unidades].join(' e ')}. Informe a faina a que ele se refere.`,
    );
  }
  return planos.reduce((s, p) => s + p.carga.quantidade, 0);
}

function montarIndicadores(
  trechos: readonly TrechoDaOperacao[],
  custoTotal: number,
  custoMaoDeObra: number,
): readonly Indicador[] {
  const porUnidade = new Map<UnidadeDeMedida, { quantidade: number; custo: number }>();
  for (const trecho of trechos) {
    const atual = porUnidade.get(trecho.unidade) ?? { quantidade: 0, custo: 0 };
    porUnidade.set(trecho.unidade, {
      quantidade: atual.quantidade + trecho.quantidade,
      custo: atual.custo + trecho.custoMaoDeObra,
    });
  }

  // Os componentes que incidem sobre o total (fundo, taxa, opcionais) são
  // rateados na proporção do custo de mão de obra de cada unidade.
  const sobra = custoTotal - custoMaoDeObra;
  const indicadores: Indicador[] = [];
  for (const [unidade, { quantidade, custo }] of porUnidade) {
    const participacao = custoMaoDeObra === 0 ? 0 : custo / custoMaoDeObra;
    const custoAtribuido = custo + sobra * participacao;
    indicadores.push({
      rotulo: ROTULO_POR_UNIDADE[unidade],
      unidade,
      valor: quantidade === 0 ? 0 : custoAtribuido / quantidade,
      quantidade,
      custoAtribuido,
    });
  }
  return indicadores;
}

function agruparPorCategoria(
  periodos: readonly PeriodoDoResultado[],
): readonly ResumoDeCategoria[] {
  const mapa = new Map<string, ResumoDeCategoria>();
  for (const periodo of periodos) {
    for (const linha of periodo.porCategoria) {
      const chave = `${linha.categoria}|${linha.instrumento}`;
      const atual = mapa.get(chave);
      mapa.set(chave, {
        categoria: linha.categoria,
        instrumento: linha.instrumento,
        custo: (atual?.custo ?? 0) + linha.custo,
        trabalhadores: linha.trabalhadores,
        homensPeriodo: (atual?.homensPeriodo ?? 0) + linha.trabalhadores,
        homensPeriodoNoPiso:
          (atual?.homensPeriodoNoPiso ?? 0) + linha.trabalhadoresNoPiso,
        regime: 'PRODUCAO',
      });
    }
  }
  return [...mapa.values()].map((r) => ({ ...r, regime: regimePorFracao(r) }));
}

function regimePorFracao(r: ResumoDeCategoria): Regime | 'MISTO' {
  if (r.homensPeriodo === 0) return 'PRODUCAO';
  const fracao = r.homensPeriodoNoPiso / r.homensPeriodo;
  if (fracao >= 0.8) return 'PISO';
  if (fracao <= 0.2) return 'PRODUCAO';
  return 'MISTO';
}

function agruparPorInstrumento(
  periodos: readonly PeriodoDoResultado[],
): readonly { instrumento: Instrumento; custo: number }[] {
  const mapa = new Map<Instrumento, number>();
  for (const periodo of periodos) {
    for (const linha of periodo.porCategoria) {
      mapa.set(linha.instrumento, (mapa.get(linha.instrumento) ?? 0) + linha.custo);
    }
  }
  return [...mapa].map(([instrumento, custo]) => ({ instrumento, custo }));
}

/**
 * A abertura por classe de dia é o recorte acionável (#15, item 4): é o único
 * que sugere uma ação — mover a atracação.
 */
function agruparPorClasseDeDia(
  periodos: readonly PeriodoDoResultado[],
): readonly { classe: ClasseDeDia; turno: Turno; periodos: number; custo: number }[] {
  const mapa = new Map<
    string,
    { classe: ClasseDeDia; turno: Turno; periodos: number; custo: number }
  >();
  for (const periodo of periodos) {
    const chave = `${periodo.classeDeDia}|${periodo.turno}`;
    const atual = mapa.get(chave);
    if (atual === undefined) {
      mapa.set(chave, {
        classe: periodo.classeDeDia,
        turno: periodo.turno,
        periodos: 1,
        custo: periodo.custo,
      });
    } else {
      atual.periodos += 1;
      atual.custo += periodo.custo;
    }
  }
  return [...mapa.values()];
}

/**
 * Qual regime está mandando — a informação mais acionável do simulador.
 *
 * Navio produtivo: manda a produção e o R$/ton é aproximadamente a taxa.
 * Navio lento ou pequeno: manda o piso e o R$/ton dispara.
 */
function regimeDominante(
  periodos: readonly PeriodoDoResultado[],
): Regime | 'MISTO' {
  let piso = 0;
  let producao = 0;
  for (const periodo of periodos) {
    for (const linha of periodo.porCategoria) {
      if (linha.regime === 'PISO') piso += linha.custo;
      else producao += linha.custo;
    }
  }
  const total = piso + producao;
  if (total === 0) return 'PRODUCAO';
  if (piso / total >= 0.8) return 'PISO';
  if (producao / total >= 0.8) return 'PRODUCAO';
  return 'MISTO';
}

function registrarPremissasDeCalendario(
  calendario: CalendarioOgmo,
  premissas: Premissas,
): void {
  const provisorio = (calendario as { temFeriadosProvisorios?: () => boolean })
    .temFeriadosProvisorios;
  if (typeof provisorio === 'function' && provisorio.call(calendario)) {
    premissas.registrar(
      'CALENDARIO_PROVISORIO',
      'O calendário em uso é provisório: só feriados nacionais, sem os estaduais do ES, os municipais de Vitória nem os da categoria portuária.',
      10,
    );
  }
}

function registrarPremissasDePolitica(
  politicas: PoliticasDeCalculo,
  premissas: Premissas,
): void {
  if (politicas.arredondamentoDePeriodos === 'CEIL') {
    premissas.registrar(
      'PERIODO_INTEIRO',
      'Todo período iniciado foi requisitado por inteiro, e carrega o piso de salário-dia mesmo sem produção.',
      8,
    );
  }
  if (!politicas.incluirHomensExtras) {
    premissas.registrar(
      'SEM_HOMENS_EXTRAS',
      'Homens extras (guincheiro, operador de empilhadeira) não foram requisitados — o ACT os trata como facultativos.',
      16,
    );
  }
  if (politicas.adicionalIncideSobreOPiso) {
    premissas.registrar(
      'ADICIONAL_SOBRE_PISO',
      'O adicional de período (noturno, domingo, feriado) foi aplicado também sobre o piso de salário-dia.',
      8,
    );
  }
  if (politicas.classeDoPeriodoNoturno === 'DIA_DE_INICIO') {
    premissas.registrar(
      'NOTURNO_PELO_DIA_DE_INICIO',
      'O período 19h–7h foi classificado pelo dia em que a jornada começa, não pelo dia em que termina.',
      10,
    );
  }
}
