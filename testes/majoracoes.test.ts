import { describe, expect, it } from 'vitest';
import { data } from '../src/dominio/tempo.js';
import { obterMajoracaoDoPeriodo } from '../src/dominio/majoracoes.js';
import { calendarioOperacional } from '../src/calendario/operacional.js';
import { CatalogoPortmac } from '../src/catalogo/portmac.js';
import { fainasActProvisorias } from '../src/catalogo/act-provisorio.js';
import { fainasCctProvisorias } from '../src/catalogo/cct-provisorio.js';
import { simular } from '../src/motor/simulador.js';
import { ehFeriadoNacional, ehFeriadoVilaVelha } from '../src/calendario/feriados.js';

describe('majorações por período', () => {
  it('reconhece 7 de setembro como feriado nacional sem cadastro manual', () => {
    expect(ehFeriadoNacional(data(2026, 9, 7))).toBe(true);
    expect(ehFeriadoNacional(data(2026, 9, 8))).toBe(false);
  });

  it('aplica em 2026 os feriados municipais de Vila Velha da referência de 2025', () => {
    expect(ehFeriadoVilaVelha(data(2026, 4, 28))).toBe(true);
    expect(ehFeriadoVilaVelha(data(2026, 5, 23))).toBe(true);
    expect(ehFeriadoVilaVelha(data(2026, 6, 19))).toBe(true);
    expect(ehFeriadoVilaVelha(data(2026, 6, 20))).toBe(false);
  });

  it('mantém a remuneração normal durante o sábado diurno', () => {
    const resultado = obterMajoracaoDoPeriodo({
      data: data(2026, 9, 5),
      periodo: '07-13',
      fonte: 'ACT',
    });

    expect(resultado.fator).toBe(1);
    expect(resultado.adicionalPercentual).toBe(0);
    expect(resultado.descricao).toContain('sábado · 07h às 13h · preço normal');
  });

  it('aplica 87,5% no sábado noturno e no domingo diurno', () => {
    expect(obterMajoracaoDoPeriodo({ data: data(2026, 9, 5), periodo: '19-01', fonte: 'CCT' }).fator)
      .toBe(1.875);
    expect(obterMajoracaoDoPeriodo({ data: data(2026, 9, 6), periodo: '07-13', fonte: 'CCT' }).fator)
      .toBe(1.875);
  });

  it('aplica o adicional noturno provisório de 25% da CCT em dia útil', () => {
    expect(obterMajoracaoDoPeriodo({ data: data(2026, 9, 8), periodo: '19-01', fonte: 'CCT' }).fator)
      .toBe(1.25);
  });

  it('aplica 134,375% no domingo noturno', () => {
    const resultado = obterMajoracaoDoPeriodo({
      data: data(2026, 9, 6),
      periodo: '19-01',
      fonte: 'ACT',
    });

    expect(resultado.fator).toBe(2.34375);
    expect(resultado.adicionalPercentual).toBe(134.375);
  });

  it('aplica 100% de dia e 150% à noite no feriado', () => {
    expect(obterMajoracaoDoPeriodo({ data: data(2026, 9, 7), periodo: '07-13', feriado: true, fonte: 'ACT' }).fator)
      .toBe(2);
    expect(obterMajoracaoDoPeriodo({ data: data(2026, 9, 7), periodo: '19-01', feriado: true, fonte: 'ACT' }).fator)
      .toBe(2.5);
  });

  it('descreve o intervalo real do período 01-07', () => {
    const resultado = obterMajoracaoDoPeriodo({
      data: data(2026, 9, 7),
      periodo: '01-07',
      feriado: true,
      fonte: 'ACT',
    });

    expect(resultado.descricao).toContain('01h às 7h');
  });

  it('usa somente o adicional de feriado quando o feriado cai no domingo', () => {
    const resultado = obterMajoracaoDoPeriodo({
      data: data(2026, 9, 6),
      periodo: '19-01',
      feriado: true,
      fonte: 'CCT',
    });

    expect(resultado.fator).toBe(2.5);
    expect(resultado.descricao).toContain('feriado · 19h à 1h');
  });

  it('leva a majoração de cada período para o custo e para a memória', () => {
    const resultado = simular(
      {
        faina: fainasActProvisorias[0]!.codigo,
        inicio: { data: data(2026, 9, 7), periodo: '19-01' },
        volumeToneladas: 20,
        produtividadeToneladasPorPeriodo: 10,
        totalDeTernos: 2,
      },
      new CatalogoPortmac(fainasActProvisorias),
      calendarioOperacional,
    );

    expect(resultado.periodos[0]?.custo.majoracao?.adicionalPercentual).toBe(150);
    expect(resultado.periodos[1]?.custo.majoracao?.adicionalPercentual).toBe(25);
    expect(resultado.periodos[0]?.custo.total).toBeGreaterThan(resultado.periodos[1]?.custo.total ?? 0);
    expect(resultado.periodos[0]?.custo.memoria[2]?.descricao).toContain('feriado');
  });

  it('calcula a CCT provisória com as cinco categorias do terno', () => {
    const faina = fainasCctProvisorias.find((item) => item.codigoDaTabela === '1.1');
    expect(faina?.status).toBe('PROVISORIA');
    expect(faina?.regraCctProvisoria?.composicao).toHaveLength(5);

    const resultado = simular(
      {
        faina: faina!.codigo,
        inicio: { data: data(2026, 9, 8), periodo: '07-13' },
        volumeToneladas: 100,
        produtividadeToneladasPorPeriodo: 100,
        totalDeTernos: 1,
      },
      new CatalogoPortmac([], fainasCctProvisorias),
      calendarioOperacional,
    );

    const esperado = 100 * 1.0265 * (1 + 1.152877);
    expect(resultado.periodos[0]?.custo.total).toBeCloseTo(esperado, 6);
    expect(resultado.periodos[0]?.custo.memoria).toHaveLength(2);
    expect(resultado.periodos[0]?.custo.memoria[0]?.descricao).toContain('tarifa unitária');
    expect(resultado.periodos[0]?.custo.memoria[1]?.descricao).toContain('CCT provisória');
  });
});
