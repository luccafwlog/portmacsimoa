import { describe, expect, it } from 'vitest';
import {
  formatarMoeda,
  formatarNumero,
  formatarPercentual,
  pluralizar,
  rotuloDaUnidade,
} from '../src/dominio/formato.js';

/** O `Intl` separa `R$` do valor com espaço inquebrável; a comparação normaliza. */
function semEspacoEstreito(valor: string): string {
  return valor.replace(/[\u00a0\u202f]/g, ' ');
}

describe('formatação', () => {
  it('escreve moeda no padrão brasileiro', () => {
    expect(semEspacoEstreito(formatarMoeda(1439774.5))).toBe('R$ 1.439.774,50');
    expect(semEspacoEstreito(formatarMoeda(0))).toBe('R$ 0,00');
  });

  it('devolve um travessão quando o valor não é um número', () => {
    expect(formatarMoeda(Number.NaN)).toBe('—');
    expect(formatarNumero(Number.POSITIVE_INFINITY)).toBe('—');
  });

  it('mantém as três casas do adicional das tabelas ACT/CCT', () => {
    expect(formatarPercentual(134.375)).toBe('134,375%');
    expect(formatarPercentual(87.5)).toBe('87,5%');
  });

  it('concorda o substantivo com a quantidade', () => {
    expect(pluralizar(1, 'período', 'períodos')).toBe('1 período');
    expect(pluralizar(18, 'período', 'períodos')).toBe('18 períodos');
  });
});

describe('rótulo da unidade', () => {
  it('nomeia cada unidade do catálogo', () => {
    expect(rotuloDaUnidade('TON').abreviacao).toBe('ton');
    expect(rotuloDaUnidade('TON').grandeza).toBe('Volume do navio');
    expect(rotuloDaUnidade('CONTAINER').plural).toBe('contêineres');
    expect(rotuloDaUnidade('EQUIPE').singular).toBe('equipe');
  });

  it('cai em um rótulo neutro quando a unidade é desconhecida ou ausente', () => {
    expect(rotuloDaUnidade(undefined).singular).toBe('unidade');
    expect(rotuloDaUnidade('INDEFINIDA').abreviacao).toBe('un');
  });
});
