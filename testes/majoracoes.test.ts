import { describe, expect, it } from 'vitest';
import { data } from '../src/dominio/tempo.js';
import { obterMajoracaoDoPeriodo } from '../src/dominio/majoracoes.js';
import { majoracaoDoPeriodoProjetado } from '../src/motor/simulador.js';
import { calendarioOperacional } from '../src/calendario/operacional.js';
import { CatalogoPortmac } from '../src/catalogo/portmac.js';
import { COTAS_DA_CARGA_GERAL, ENCARGOS_DE_TESTE, fainaDeProducao } from './fainas-de-teste.js';
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
    expect(obterMajoracaoDoPeriodo({ data: data(2026, 9, 5), periodo: '19-01', fonte: 'ACT' }).fator)
      .toBe(1.875);
    expect(obterMajoracaoDoPeriodo({ data: data(2026, 9, 6), periodo: '07-13', fonte: 'ACT' }).fator)
      .toBe(1.875);
  });

  it('aplica o adicional noturno de 25% da ACT em dia útil', () => {
    expect(obterMajoracaoDoPeriodo({ data: data(2026, 9, 8), periodo: '19-01', fonte: 'ACT' }).fator)
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
      fonte: 'ACT',
    });

    expect(resultado.fator).toBe(2.5);
    expect(resultado.descricao).toContain('feriado · 19h à 1h');
  });

  it('leva a majoração de cada período para o custo e para a memória', () => {
    const resultado = simular(
      {
        faina: fainaDeProducao.codigo,
        inicio: { data: data(2026, 9, 7), periodo: '19-01' },
        volumeToneladas: 20,
        produtividadeToneladasPorPeriodo: 10,
        totalDeTernos: 2,
      },
      new CatalogoPortmac([fainaDeProducao]),
      calendarioOperacional,
    );

    expect(resultado.periodos[0]?.custo.majoracao?.adicionalPercentual).toBe(150);
    expect(resultado.periodos[1]?.custo.majoracao?.adicionalPercentual).toBe(25);
    expect(resultado.periodos[0]?.custo.total).toBeGreaterThan(resultado.periodos[1]?.custo.total ?? 0);
    expect(resultado.periodos[0]?.custo.memoria[2]?.descricao).toContain('feriado');
  });

  it('soma as categorias do terno em um período sem adicional', () => {
    const resultado = simular(
      {
        faina: fainaDeProducao.codigo,
        inicio: { data: data(2026, 9, 8), periodo: '07-13' },
        volumeToneladas: 100,
        produtividadeToneladasPorPeriodo: 100,
        totalDeTernos: 1,
      },
      new CatalogoPortmac([fainaDeProducao]),
      calendarioOperacional,
    );

    const esperado = 100 * 3.01 * COTAS_DA_CARGA_GERAL * (1 + ENCARGOS_DE_TESTE);
    expect(resultado.periodos[0]?.custo.total).toBeCloseTo(esperado, 6);
    expect(resultado.periodos[0]?.custo.memoria).toHaveLength(3);
    expect(resultado.periodos[0]?.custo.memoria[2]?.descricao).toContain('Fonte: ACT');
  });
});

describe('majoração de um período projetado', () => {
  const periodo = (dia: number, identificador: string) => ({
    indice: 0,
    data: data(2026, 4, dia),
    identificador,
  });

  it('reconhece a faixa noturna de um dia útil', () => {
    // 17/04/2026 é uma sexta-feira.
    const majoracao = majoracaoDoPeriodoProjetado(periodo(17, '19-01'), 'ACT');
    expect(majoracao?.tipoDeDia).toBe('NORMAL');
    expect(majoracao?.faixa).toBe('NOITE');
    expect(majoracao?.adicionalPercentual).toBe(25);
  });

  it('reconhece o domingo pela data', () => {
    // 19/04/2026 é um domingo.
    const majoracao = majoracaoDoPeriodoProjetado(periodo(19, '07-13'), 'ACT');
    expect(majoracao?.tipoDeDia).toBe('DOMINGO');
    expect(majoracao?.adicionalPercentual).toBe(87.5);
  });

  it('reconhece o feriado municipal do calendário de Vila Velha', () => {
    // 28/04 é Nossa Senhora da Penha.
    const majoracao = majoracaoDoPeriodoProjetado(periodo(28, '07-13'), 'ACT');
    expect(majoracao?.tipoDeDia).toBe('FERIADO');
    expect(majoracao?.adicionalPercentual).toBe(100);
  });

  it('não devolve majoração para uma faixa fora da tabela', () => {
    expect(majoracaoDoPeriodoProjetado(periodo(17, 'MANUTENCAO'), 'ACT')).toBeUndefined();
  });

  it('responde igual ao que o simulador aplica no mesmo período', () => {
    // A interface desenha o rascunho com esta função e o motor calcula com ela:
    // divergir aqui faria o gráfico ao vivo mentir sobre o custo.
    const projetado = majoracaoDoPeriodoProjetado(periodo(19, '19-01'), 'ACT');
    const direto = obterMajoracaoDoPeriodo({ data: data(2026, 4, 19), periodo: '19-01', fonte: 'ACT' });
    expect(projetado).toEqual(direto);
  });
});
