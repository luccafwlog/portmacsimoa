import type { CalendarioOgmo } from '../calendario/portas.js';
import type { CatalogoOgmo } from '../catalogo/portas.js';
import type {
  CustoOpcionalCalculado,
  EntradaDeSimulacao,
  LinhaDeMemoria,
  ResultadoDeSimulacao,
} from '../dominio/tipos.js';

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
  if (faina.unidade !== 'TON') {
    throw new CatalogoIncompleto(
      `A faina ${entrada.faina} não está cadastrada em toneladas.`,
    );
  }

  const quantidadeDePeriodos = Math.ceil(
    entrada.volumeToneladas / entrada.produtividadeToneladasPorPeriodo,
  );
  const distribuicaoDeTernos = entrada.ternosPorPeriodo
    ? validarDistribuicao(entrada.ternosPorPeriodo, quantidadeDePeriodos, entrada.totalDeTernos)
    : distribuirTernos(entrada.totalDeTernos, quantidadeDePeriodos);
  const periodos = calendario.projetar(entrada.inicio, quantidadeDePeriodos);
  if (periodos.length !== quantidadeDePeriodos) {
    throw new CatalogoIncompleto(
      `O calendário retornou ${periodos.length} períodos, mas eram necessários ${quantidadeDePeriodos}.`,
    );
  }

  let restante = entrada.volumeToneladas;
  const calculados = periodos.map((periodo, indice) => {
    const producaoToneladas = Math.min(
      entrada.produtividadeToneladasPorPeriodo,
      restante,
    );
    restante -= producaoToneladas;
    const custo = catalogo.calcularCustoDoPeriodo({
      faina,
      periodo,
      producaoToneladas,
      ternos: distribuicaoDeTernos[indice]!,
    });
    return {
      periodo,
      producaoToneladas,
      ternos: distribuicaoDeTernos[indice]!,
      custo,
    };
  });

  const custoDeMaoDeObra = calculados.reduce((total, periodo) => total + periodo.custo.total, 0);
  const custosOpcionais: CustoOpcionalCalculado[] = (entrada.custosOpcionais ?? []).map((custo) => ({
    ...custo,
    custoPorTonelada: custo.custoTotal / entrada.volumeToneladas,
  }));
  const custoOpcionalTotal = custosOpcionais.reduce((total, custo) => total + custo.custoTotal, 0);
  const custoTotal = custoDeMaoDeObra + custoOpcionalTotal;
  const memoria: LinhaDeMemoria[] = [
    { descricao: 'Volume total (toneladas)', valor: entrada.volumeToneladas },
    { descricao: 'Produtividade (toneladas por período)', valor: entrada.produtividadeToneladasPorPeriodo },
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

function validarEntrada(entrada: EntradaDeSimulacao): void {
  if (!entrada.faina.trim()) throw new EntradaInvalida('A faina é obrigatória.');
  if (entrada.volumeToneladas <= 0) {
    throw new EntradaInvalida('O volume deve ser maior que zero.');
  }
  if (entrada.produtividadeToneladasPorPeriodo <= 0) {
    throw new EntradaInvalida('A produtividade deve ser maior que zero.');
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
  if (distribuicao.some((ternos) => !Number.isInteger(ternos) || ternos < 0)) {
    throw new EntradaInvalida('Cada distribuição de ternos deve ser um inteiro não negativo.');
  }
  if (distribuicao.reduce((soma, ternos) => soma + ternos, 0) !== total) {
    throw new EntradaInvalida('A redistribuição deve preservar o total de ternos.');
  }
  return distribuicao;
}
