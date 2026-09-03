import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  formatarValorEixo,
  money,
  normalizarBusca,
  number,
  quaseIgual,
} from '../src/ui/formato.js';
import { gerarGraficoCustoPeriodos, gerarGraficoSensibilidade } from '../src/ui/graficos.js';
import { volumeDistribuidoPorPeriodos } from '../src/ui/editor-periodos.js';
import { isOrcamentoSalvo } from '../src/ui/orcamentos.js';
import { DESCRITORES_DE_UNIDADE } from '../src/dominio/unidade.js';
import { data } from '../src/dominio/tempo.js';
import { simular } from '../src/motor/simulador.js';
import { catalogoPortmac } from '../src/catalogo/portmac.js';
import { calendarioOperacional } from '../src/calendario/operacional.js';
import { fainasActProvisorias } from '../src/catalogo/act-provisorio.js';
import { obterAnaliseDeSensibilidade } from '../src/motor/sensibilidade.js';

describe('utilitários de formato e UI', () => {
  it('escapa caracteres especiais de HTML', () => {
    expect(escapeHtml('<script>"alert(\'xss\')&</script>'))
      .toBe('&lt;script&gt;&quot;alert(&#39;xss&#39;)&amp;&lt;/script&gt;');
  });

  it('formata números e moedas em pt-BR', () => {
    expect(number(1234.5)).toBe('1.234,5');
    const valorFormatado = money(100);
    expect(valorFormatado).toContain('100,00');
  });

  it('normaliza buscas removendo acentos e convertendo para minúsculas', () => {
    expect(normalizarBusca('Contêiner de Açúcar')).toBe('conteiner de acucar');
    expect(normalizarBusca(undefined)).toBe('');
  });

  it('formata valores de eixo de gráficos', () => {
    expect(formatarValorEixo(500)).toContain('500');
    expect(formatarValorEixo(2500)).toContain('2,5 mil');
  });

  it('compara números com tolerância', () => {
    expect(quaseIgual(1.00001, 1.00002)).toBe(true);
    expect(quaseIgual(1.0, 1.1)).toBe(false);
  });

  it('valida tipo de OrcamentoSalvo', () => {
    expect(isOrcamentoSalvo(null)).toBe(false);
    expect(isOrcamentoSalvo({})).toBe(false);
    expect(isOrcamentoSalvo({ id: '1', cliente: 'C', criadoEm: '2026-09-03', resultado: {} })).toBe(true);
  });

  it('calcula o volume distribuído por períodos', () => {
    const total = volumeDistribuidoPorPeriodos([10, 10, 10], [1, 2, 1], 40);
    expect(total).toBe(40);
  });
});

describe('geração pura de gráficos SVG', () => {
  it('gera SVG para gráfico de custo por período', () => {
    const resultado = simular(
      {
        faina: fainasActProvisorias[0]!.codigo,
        inicio: { data: data(2026, 9, 7), periodo: '07-13' },
        volumeToneladas: 60,
        produtividadeToneladasPorPeriodo: 20,
        ternosPorPeriodoPadrao: 1,
        totalDeTernos: 3,
      },
      catalogoPortmac,
      calendarioOperacional,
    );

    const { svgHtml, summaryText, ariaLabel } = gerarGraficoCustoPeriodos(resultado);
    expect(svgHtml).toContain('<svg class="period-cost-chart-svg"');
    expect(svgHtml).toContain('rect class="chart-bar');
    expect(summaryText).toContain('3 períodos');
    expect(ariaLabel).toContain('Gráfico de custo por período');
  });

  it('gera SVG para gráfico de sensibilidade à produtividade', () => {
    const resultado = simular(
      {
        faina: fainasActProvisorias[0]!.codigo,
        inicio: { data: data(2026, 9, 7), periodo: '07-13' },
        volumeToneladas: 100,
        produtividadeToneladasPorPeriodo: 50,
        ternosPorPeriodoPadrao: 1,
        totalDeTernos: 2,
      },
      catalogoPortmac,
      calendarioOperacional,
    );

    const analise = obterAnaliseDeSensibilidade(resultado, catalogoPortmac, calendarioOperacional);
    const grafico = gerarGraficoSensibilidade(
      analise,
      50,
      resultado.custoPorTonelada,
      1,
      DESCRITORES_DE_UNIDADE.TON,
    );

    expect(grafico).toBeDefined();
    expect(grafico?.svgHtml).toContain('<svg class="period-cost-chart-svg sensitivity-chart-svg"');
    expect(grafico?.svgHtml).toContain('sensitivity-point');
    expect(grafico?.tabelaHtml).toContain('<table class="sensitivity-table">');
    expect(grafico?.summaryText).toContain('Ótimo calculado:');
  });
});
