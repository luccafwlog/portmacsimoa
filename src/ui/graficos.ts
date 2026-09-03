import type { ResultadoDeSimulacao } from '../dominio/tipos.js';
import type { AnaliseDeSensibilidade } from '../motor/sensibilidade.js';
import type { UnidadeInfo } from '../dominio/unidade.js';
import { formatarDataPtBr } from '../dominio/tempo.js';
import { escapeHtml, formatarValorEixo, money, number } from './formato.js';

export interface GraficoResultado {
  readonly svgHtml: string;
  readonly summaryText: string;
  readonly ariaLabel: string;
}

export interface SensibilidadeResultado extends GraficoResultado {
  readonly tabelaHtml: string;
}

export function gerarGraficoCustoPeriodos(resultado: ResultadoDeSimulacao): GraficoResultado {
  const custos = resultado.periodos.map((periodo) => periodo.custo.total);
  const maiorCusto = Math.max(...custos, 0);
  const media = custos.length ? custos.reduce((total, custo) => total + custo, 0) / custos.length : 0;
  const summaryText = `${resultado.periodos.length} períodos · média ${money(media)}`;
  const ariaLabel = `Gráfico de custo por período. Maior custo: ${money(maiorCusto)}. Média: ${money(media)}.`;

  const width = 860;
  const height = 340;
  const left = 120;
  const right = 24;
  const top = 24;
  const bottom = 72;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const ticks = 4;
  const step = maiorCusto / ticks;
  const barSlot = resultado.periodos.length ? plotWidth / resultado.periodos.length : plotWidth;
  const barWidth = Math.max(6, Math.min(34, barSlot * 0.58));
  const y = (value: number) => top + plotHeight - (maiorCusto > 0 ? value / maiorCusto : 0) * plotHeight;

  const grid = Array.from({ length: ticks + 1 }, (_, indice) => {
    const value = step * indice;
    const lineY = y(value);
    return `<line class="chart-grid-line" x1="${left}" y1="${lineY.toFixed(2)}" x2="${width - right}" y2="${lineY.toFixed(2)}" />
      <text class="chart-axis-label chart-axis-label-y" x="${left - 12}" y="${(lineY + 4).toFixed(2)}">${escapeHtml(formatarValorEixo(value))}</text>`;
  }).join('');

  const bars = resultado.periodos.map((periodo, indice) => {
    const custo = periodo.custo.total;
    const barHeight = maiorCusto > 0 ? (custo / maiorCusto) * plotHeight : 0;
    const x = left + indice * barSlot + (barSlot - barWidth) / 2;
    const labelEvery = resultado.periodos.length > 18 ? Math.ceil(resultado.periodos.length / 12) : 1;
    const label = indice % labelEvery === 0 ? escapeHtml(periodo.periodo.identificador) : '';
    return `<rect class="chart-bar${custo === maiorCusto ? ' is-highest' : ''}" x="${x.toFixed(2)}" y="${y(custo).toFixed(2)}" width="${barWidth.toFixed(2)}" height="${barHeight.toFixed(2)}" rx="3"><title>${escapeHtml(periodo.periodo.identificador)} · ${formatarDataPtBr(periodo.periodo.data)} · ${money(custo)}</title></rect>
      <text class="chart-axis-label chart-axis-label-x" x="${(x + barWidth / 2).toFixed(2)}" y="${height - bottom + 24}">${label}</text>`;
  }).join('');

  const svgHtml = `<svg class="period-cost-chart-svg" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
    <text class="chart-axis-title chart-axis-title-y" x="24" y="${top + plotHeight / 2}" transform="rotate(-90 24 ${top + plotHeight / 2})">Custo (R$)</text>
    ${grid}
    <line class="chart-axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" />
    <line class="chart-axis" x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" />
    ${bars}
    <text class="chart-axis-title chart-axis-title-x" x="${left + plotWidth / 2}" y="${height - 12}">Períodos</text>
  </svg>`;

  return { svgHtml, summaryText, ariaLabel };
}

export function gerarGraficoSensibilidade(
  analise: AnaliseDeSensibilidade,
  baseProdutividade: number,
  custoPorToneladaResultado: number,
  ternosPorPeriodo: number,
  unidade: UnidadeInfo,
): SensibilidadeResultado | undefined {
  const pontos = analise.pontos;
  const pontosDoGrafico = pontos.filter((ponto) => !ponto.ehCenarioAtual);
  const produtividades = pontosDoGrafico.map((ponto) => ponto.produtividade);
  const pontoOtimo = analise.otimizacao.melhor;

  if (!pontosDoGrafico.length || !pontoOtimo) {
    return undefined;
  }

  const summaryText = `Ótimo calculado: ${number(pontoOtimo.produtividade)} ${unidade.abreviacao}/terno/período · ${number(pontoOtimo.periodos)} períodos · ${number(ternosPorPeriodo)} terno(s)/período · ${money(pontoOtimo.resultado.custoPorTonelada)} por ${unidade.singular}`;
  const custos = pontosDoGrafico.map((ponto) => ponto.custoPorTonelada);
  const menorCusto = Math.min(...custos);
  const maiorCusto = Math.max(...custos);
  const custoBase = pontos.find((ponto) => ponto.produtividade === baseProdutividade)?.custoPorTonelada ?? custoPorToneladaResultado;
  const amplitude = Math.max(maiorCusto - menorCusto, custoBase * 0.12, 1);
  const yMin = Math.max(0, menorCusto - amplitude * 0.16);
  const yMax = maiorCusto + amplitude * 0.16;

  const width = 860;
  const height = 340;
  const left = 120;
  const right = 24;
  const top = 24;
  const bottom = 72;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  const x = (value: number) => left + (produtividades.length > 1 ? (value - produtividades[0]!) / (produtividades[produtividades.length - 1]! - produtividades[0]!) : 0.5) * plotWidth;
  const y = (value: number) => top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;
  const labelEvery = pontosDoGrafico.length > 18 ? Math.ceil(pontosDoGrafico.length / 8) : 1;
  const pontosDaTabela = pontos.filter((ponto, indice) => indice % 4 === 0 || ponto.produtividade === baseProdutividade || ponto.produtividade === pontoOtimo.produtividade);

  const grid = Array.from({ length: 5 }, (_, indice) => {
    const value = yMin + ((yMax - yMin) / 4) * indice;
    const lineY = y(value);
    return `<line class="chart-grid-line" x1="${left}" y1="${lineY.toFixed(2)}" x2="${width - right}" y2="${lineY.toFixed(2)}" />
      <text class="chart-axis-label chart-axis-label-y" x="${left - 12}" y="${(lineY + 4).toFixed(2)}">${escapeHtml(formatarValorEixo(value))}</text>`;
  }).join('');

  const line = pontosDoGrafico.map((ponto, indice) => `${indice === 0 ? 'M' : 'L'} ${x(ponto.produtividade).toFixed(2)} ${y(ponto.custoPorTonelada).toFixed(2)}`).join(' ');
  const optimalGuide = `<line class="sensitivity-optimal-guide" x1="${x(pontoOtimo.produtividade).toFixed(2)}" y1="${top}" x2="${x(pontoOtimo.produtividade).toFixed(2)}" y2="${top + plotHeight}" /><text class="sensitivity-optimal-guide-label" x="${x(pontoOtimo.produtividade).toFixed(2)}" y="${top - 7}">ótimo</text>`;
  const points = pontosDoGrafico.map((ponto, indice) => `<circle class="sensitivity-point${ponto.produtividade === pontoOtimo.produtividade ? ' is-optimal' : ''}" cx="${x(ponto.produtividade).toFixed(2)}" cy="${y(ponto.custoPorTonelada).toFixed(2)}" r="6"><title>${number(ponto.produtividade)} / terno / período · ${number(ponto.periodos)} períodos · ${money(ponto.custoPorTonelada)} por ${unidade.singular}</title></circle>
    <text class="chart-axis-label chart-axis-label-x" x="${x(ponto.produtividade).toFixed(2)}" y="${height - bottom + 24}">${indice % labelEvery === 0 ? escapeHtml(number(ponto.produtividade)) : ''}</text>`).join('');

  const ariaLabel = `Análise de sensibilidade. O custo por ${unidade.singular} varia de ${money(menorCusto)} a ${money(maiorCusto)}. O ótimo estimado é ${number(pontoOtimo.produtividade)} ${unidade.abreviacao} por terno por período.`;

  const svgHtml = `<svg class="period-cost-chart-svg sensitivity-chart-svg" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
    <text class="chart-axis-title chart-axis-title-y" x="24" y="${top + plotHeight / 2}" transform="rotate(-90 24 ${top + plotHeight / 2})">Custo por ${escapeHtml(unidade.singular)} (R$)</text>
    ${grid}
    <line class="chart-axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" />
    <line class="chart-axis" x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" />
    ${optimalGuide}
    <path class="sensitivity-line" d="${line}" />
    ${points}
    <text class="chart-axis-title chart-axis-title-x" x="${left + plotWidth / 2}" y="${height - 12}">Produtividade / terno / período</text>
  </svg>`;

  const tabelaHtml = `<div class="sensitivity-table-wrap"><table class="sensitivity-table"><thead><tr><th>Produtividade / terno / período</th><th>Períodos</th><th>Custo por ${escapeHtml(unidade.singular)}</th></tr></thead><tbody>
    ${pontosDaTabela.map((ponto) => `<tr class="${ponto.produtividade === baseProdutividade ? 'is-base' : ''}${ponto.produtividade === pontoOtimo.produtividade ? ' is-optimal' : ''}"><td>${number(ponto.produtividade)}${ponto.produtividade === baseProdutividade ? ' <span class="sensitivity-base-label">base</span>' : ''}${ponto.produtividade === pontoOtimo.produtividade ? ' <span class="sensitivity-optimal-label">ótimo</span>' : ''}</td><td>${number(ponto.periodos)}</td><td>${money(ponto.custoPorTonelada)}</td></tr>`).join('')}
  </tbody></table></div>`;

  return { svgHtml, summaryText, ariaLabel, tabelaHtml };
}
