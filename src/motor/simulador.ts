import type { CalendarioOgmo } from '../calendario/portas.js';
import type { CatalogoOgmo } from '../catalogo/portas.js';
import type {
  CustoOpcionalCalculado,
  EntradaDeSimulacao,
  LinhaDeMemoria,
  ResultadoDeSimulacao,
} from '../dominio/tipos.js';
import { obterMajoracaoDoPeriodo } from '../dominio/majoracoes.js';
import { ehFeriadoVilaVelha } from '../calendario/feriados.js';

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

export function simular(
  entrada: EntradaDeSimulacao,
  catalogo: CatalogoOgmo,
  calendario: CalendarioOgmo,
): ResultadoDeSimulacao {
  validarEntrada(entrada);

  const faina = catalogo.obterFaina(entrada.faina);
  if (faina === undefined) {
    throw new CatalogoIncompleto(`Faina ${entrada.faina} não está no catálogo.`);
  }
  if (faina.status === 'PENDENTE_DE_VALIDACAO') {
    throw new CatalogoIncompleto(
      `A faina ${faina.descricao} está cadastrada, mas ainda não está validada para cálculo.`,
    );
  }
  const ternosPadrao = entrada.ternosPorPeriodoPadrao;
  const capacidadePorPeriodo = ternosPadrao === undefined
    ? entrada.produtividadeToneladasPorPeriodo
    : entrada.produtividadeToneladasPorPeriodo * ternosPadrao;
  const quantidadeDePeriodos = Math.ceil(
    entrada.volumeToneladas / capacidadePorPeriodo,
  );
  if (entrada.ternosPorPeriodoPadrao !== undefined) {
    if (!Number.isInteger(entrada.ternosPorPeriodoPadrao) || entrada.ternosPorPeriodoPadrao < 1 || entrada.ternosPorPeriodoPadrao > 4) {
      throw new EntradaInvalida('Os ternos por período devem ser um inteiro entre 1 e 4.');
    }
    if (entrada.totalDeTernos !== entrada.ternosPorPeriodoPadrao * quantidadeDePeriodos) {
      throw new EntradaInvalida('O total de ternos deve ser igual aos períodos multiplicados pelos ternos por período.');
    }
  }
  if (entrada.totalDeTernos > quantidadeDePeriodos * 4) {
    throw new EntradaInvalida(
      'O total de ternos excede o máximo de 4 ternos por período.',
    );
  }
  const distribuicaoDeTernos = entrada.ternosPorPeriodo
    ? validarDistribuicao(entrada.ternosPorPeriodo, quantidadeDePeriodos, entrada.totalDeTernos)
    : distribuirTernos(entrada.totalDeTernos, quantidadeDePeriodos);
  const produtividadesPorPeriodo = entrada.produtividadesPorPeriodo
    ? validarProdutividades(entrada.produtividadesPorPeriodo, quantidadeDePeriodos, entrada.volumeToneladas, distribuicaoDeTernos, ternosPadrao !== undefined)
    : Array.from({ length: quantidadeDePeriodos }, () => entrada.produtividadeToneladasPorPeriodo);
  const periodos = calendario.projetar(entrada.inicio, quantidadeDePeriodos);
  if (periodos.length !== quantidadeDePeriodos) {
    throw new CatalogoIncompleto(
      `O calendário retornou ${periodos.length} períodos, mas eram necessários ${quantidadeDePeriodos}.`,
    );
  }

  let restante = entrada.volumeToneladas;
  const calculados = periodos.map((periodo, indice) => {
    const producaoToneladas = Math.min(
      produtividadesPorPeriodo[indice]! * (ternosPadrao === undefined ? 1 : distribuicaoDeTernos[indice]!),
      restante,
    );
    restante -= producaoToneladas;
    const feriado = ehFeriadoVilaVelha(periodo.data);
    const majoracao = ['01-07', '07-13', '13-19', '19-01'].includes(periodo.identificador)
      ? obterMajoracaoDoPeriodo({
        data: periodo.data,
        periodo: periodo.identificador,
        fonte: faina.fonte,
        ...(feriado ? { feriado: true } : {}),
      })
      : undefined;
    const custo = catalogo.calcularCustoDoPeriodo({
      faina,
      periodo,
      producaoToneladas,
      ternos: distribuicaoDeTernos[indice]!,
      ...(majoracao ? { majoracao } : {}),
    });
    return {
      periodo,
      producaoToneladas,
      ternos: distribuicaoDeTernos[indice]!,
      custo,
    };
  });
  if (restante > 0.0001) {
    throw new EntradaInvalida('A produtividade distribuída não cobre todo o volume da operação.');
  }

  const custoDeMaoDeObra = calculados.reduce((total, periodo) => total + periodo.custo.total, 0);
  const custosOpcionais: CustoOpcionalCalculado[] = (entrada.custosOpcionais ?? []).map((custo) => ({
    ...custo,
    custoPorTonelada: custo.custoTotal / entrada.volumeToneladas,
  }));
  const custoOpcionalTotal = custosOpcionais.reduce((total, custo) => total + custo.custoTotal, 0);
  const custoTotal = custoDeMaoDeObra + custoOpcionalTotal;
  const unidadeOperacional = nomeDaUnidade(faina.unidade);
  const memoria: LinhaDeMemoria[] = [
    { descricao: `Quantidade total (${unidadeOperacional})`, valor: entrada.volumeToneladas },
    { descricao: `Produtividade (${unidadeOperacional} por terno por período)`, valor: entrada.produtividadeToneladasPorPeriodo },
    { descricao: `Capacidade nominal (${unidadeOperacional} por período)`, valor: capacidadePorPeriodo },
    { descricao: 'Quantidade de períodos', valor: quantidadeDePeriodos },
    { descricao: 'Total de ternos', valor: entrada.totalDeTernos },
    { descricao: 'Mão de obra', valor: custoDeMaoDeObra },
    { descricao: 'Custos opcionais', valor: custoOpcionalTotal },
    { descricao: 'Custo total', valor: custoTotal },
  ];

  return {
    entrada,
    quantidadeDePeriodos,
    distribuicaoDeTernos,
    periodos: calculados,
    custoDeMaoDeObra,
    custosOpcionais,
    custoOpcionalTotal,
    custoTotal,
    custoPorTonelada: custoTotal / entrada.volumeToneladas,
    memoria,
  };
}

function nomeDaUnidade(unidade: string): string {
  switch (unidade) {
    case 'UNIDADE': return 'unidades';
    case 'CONTAINER': return 'contêineres';
    case 'EQUIPE': return 'equipes';
    case 'VOLUME': return 'volumes';
    default: return 'toneladas';
  }
}

function validarEntrada(entrada: EntradaDeSimulacao): void {
  if (!entrada.faina.trim()) throw new EntradaInvalida('A faina é obrigatória.');
  if (entrada.volumeToneladas <= 0) {
    throw new EntradaInvalida('O volume deve ser maior que zero.');
  }
  if (entrada.produtividadeToneladasPorPeriodo <= 0) {
    throw new EntradaInvalida('A produtividade deve ser maior que zero.');
  }
  if (entrada.ternosPorPeriodoPadrao !== undefined && (!Number.isInteger(entrada.ternosPorPeriodoPadrao) || entrada.ternosPorPeriodoPadrao < 1 || entrada.ternosPorPeriodoPadrao > 4)) {
    throw new EntradaInvalida('Os ternos por período devem ser um inteiro entre 1 e 4.');
  }
  if (!Number.isInteger(entrada.totalDeTernos) || entrada.totalDeTernos < 1) {
    throw new EntradaInvalida('O total de ternos deve ser um inteiro maior que zero.');
  }
  if ((entrada.custosOpcionais ?? []).some((custo) => !Number.isFinite(custo.custoTotal) || custo.custoTotal < 0)) {
    throw new EntradaInvalida('Cada custo opcional deve ser um valor maior ou igual a zero.');
  }
  if ((entrada.custosOpcionais ?? []).some((custo) => custo.tipo === 'OUTRO' && !custo.descricao?.trim())) {
    throw new EntradaInvalida('Descreva o custo opcional personalizado.');
  }
}

function distribuirTernos(total: number, periodos: number): readonly number[] {
  const base = Math.floor(total / periodos);
  const sobras = total % periodos;
  return Array.from({ length: periodos }, (_, indice) =>
    base + (indice >= periodos - sobras ? 1 : 0),
  );
}

function validarDistribuicao(
  distribuicao: readonly number[],
  periodos: number,
  total: number,
): readonly number[] {
  if (distribuicao.length !== periodos) {
    throw new EntradaInvalida('A distribuição precisa ter um valor por período.');
  }
  if (distribuicao.some((ternos) => !Number.isInteger(ternos) || ternos < 0 || ternos > 4)) {
    throw new EntradaInvalida('Cada distribuição de ternos deve ser um inteiro entre 0 e 4.');
  }
  if (distribuicao.reduce((soma, ternos) => soma + ternos, 0) !== total) {
    throw new EntradaInvalida('A redistribuição deve preservar o total de ternos.');
  }
  return distribuicao;
}

function validarProdutividades(
  produtividades: readonly number[],
  periodos: number,
  volume: number,
  ternosPorPeriodo: readonly number[],
  produtividadePorTerno: boolean,
): readonly number[] {
  if (produtividades.length !== periodos) {
    throw new EntradaInvalida('A produtividade precisa ter um valor por período.');
  }
  if (produtividades.some((produtividade) => !Number.isFinite(produtividade) || produtividade <= 0)) {
    throw new EntradaInvalida('Cada produtividade por período deve ser maior que zero.');
  }
  const capacidade = produtividades.reduce((soma, produtividade, indice) =>
    soma + produtividade * (produtividadePorTerno ? ternosPorPeriodo[indice]! : 1), 0);
  if (produtividadePorTerno ? capacidade + 0.0001 < volume : Math.abs(capacidade - volume) > 0.0001) {
    throw new EntradaInvalida(produtividadePorTerno
      ? 'A capacidade das produtividades por terno deve cobrir todo o volume da operação.'
      : 'A soma das produtividades por período deve ser exatamente igual ao volume da operação.');
  }
  return produtividades;
}
