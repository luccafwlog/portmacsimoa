import { compararDatas, diaDaSemana, type DataLocal } from '../dominio/tempo.js';
import type { ClasseDeDia } from '../dominio/tipos.js';
import { chaveDeFeriado, feriadosProvisorios, type Feriado } from './feriados.js';
import type { CalendarioOgmo } from './portas.js';

export interface HorizonteDoCalendario {
  readonly de: DataLocal;
  readonly ate: DataLocal;
}

/**
 * Calendário construído a partir de uma lista de feriados e de um horizonte.
 *
 * Quando o calendário oficial do OGMO chegar (#10), ele entra como outra lista
 * de feriados — ou, se trouxer mais do que feriados, como outra implementação
 * da porta. O motor não fica sabendo.
 */
export class CalendarioPorFeriados implements CalendarioOgmo {
  private readonly porData: Map<string, Feriado>;

  constructor(
    feriados: readonly Feriado[],
    private readonly horizonte: HorizonteDoCalendario,
  ) {
    this.porData = new Map(feriados.map((f) => [chaveDeFeriado(f.data), f]));
  }

  classeDoDia(d: DataLocal): ClasseDeDia {
    // Feriado ganha de domingo: o ACT §2º manda aplicar só o adicional de
    // feriado quando os dois coincidem, sem acumular.
    if (this.porData.has(chaveDeFeriado(d))) return 'FERIADO';
    const dia = diaDaSemana(d);
    if (dia === 'DOMINGO') return 'DOMINGO';
    if (dia === 'SABADO') return 'SABADO';
    return 'COMUM';
  }

  cobre(d: DataLocal): boolean {
    return (
      compararDatas(d, this.horizonte.de) >= 0 &&
      compararDatas(d, this.horizonte.ate) <= 0
    );
  }

  feriadoEm(d: DataLocal): Feriado | undefined {
    return this.porData.get(chaveDeFeriado(d));
  }

  /** True se alguma classificação usada até aqui veio de feriado não confirmado. */
  temFeriadosProvisorios(): boolean {
    for (const f of this.porData.values()) if (f.provisorio) return true;
    return false;
  }
}

/**
 * Calendário provisório cobrindo os anos pedidos.
 *
 * Existe para destravar o desenvolvimento do motor. Uma simulação que o use
 * carrega a premissa correspondente no resultado.
 */
export function calendarioProvisorio(
  anoInicial: number,
  anoFinal: number,
): CalendarioPorFeriados {
  const feriados: Feriado[] = [];
  for (let ano = anoInicial; ano <= anoFinal; ano++) {
    feriados.push(...feriadosProvisorios(ano));
  }
  return new CalendarioPorFeriados(feriados, {
    de: { ano: anoInicial, mes: 1, dia: 1 },
    ate: { ano: anoFinal, mes: 12, dia: 31 },
  });
}
