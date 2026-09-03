import type { CatalogoOgmo } from '../catalogo/portas.js';
import type { CalendarioOgmo } from '../calendario/portas.js';
import type { FainaCatalogada, ResultadoDeSimulacao, TipoDeCustoOpcional } from '../dominio/tipos.js';
import { formatarDataPtBr } from '../dominio/tempo.js';
import { obterUnidade } from '../dominio/unidade.js';
import { obterAnaliseDeSensibilidade } from '../motor/sensibilidade.js';
import { escapeHtml, formatarDataHora, money, number } from './formato.js';

export const SAVED_BUDGETS_KEY = 'sco-orcamentos-salvos';

export const OPTIONAL_COST_LABELS: Record<TipoDeCustoOpcional, string> = {
  MATERIAL_DE_PEACAO: 'Material de peação',
  MADEIRA: 'Madeira',
  LOCACAO_DE_MAQUINA: 'Locação de máquina',
  MATERIAL_DE_ICAMENTO: 'Material de içamento',
  OUTRO: 'Outro custo',
};

export interface OrcamentoSalvo {
  readonly id: string;
  readonly cliente: string;
  readonly criadoEm: string;
  readonly resultado: ResultadoDeSimulacao;
}

export function isOrcamentoSalvo(value: unknown): value is OrcamentoSalvo {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string'
    && typeof record.cliente === 'string'
    && typeof record.criadoEm === 'string'
    && typeof record.resultado === 'object'
    && record.resultado !== null;
}

export function readSavedBudgets(): OrcamentoSalvo[] {
  try {
    const stored = JSON.parse(localStorage.getItem(SAVED_BUDGETS_KEY) ?? '[]') as unknown;
    return Array.isArray(stored) ? stored.filter(isOrcamentoSalvo) : [];
  } catch {
    return [];
  }
}

export function saveBudget(resultado: ResultadoDeSimulacao, cliente: string): OrcamentoSalvo {
  const orcamento: OrcamentoSalvo = {
    id: `orcamento-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    cliente,
    criadoEm: new Date().toISOString(),
    resultado,
  };
  const budgets = readSavedBudgets();
  budgets.unshift(orcamento);
  localStorage.setItem(SAVED_BUDGETS_KEY, JSON.stringify(budgets));
  return orcamento;
}

export function renderClientsPage(catalogo: CatalogoOgmo): void {
  const list = document.querySelector<HTMLDivElement>('#client-budget-list');
  const empty = document.querySelector<HTMLElement>('#clients-empty');
  if (!list || !empty) return;
  const budgets = readSavedBudgets();
  empty.hidden = budgets.length > 0;
  list.hidden = budgets.length === 0;
  list.innerHTML = budgets.map((budget) => {
    const faina = catalogo.obterFaina(budget.resultado.entrada.faina);
    const unidade = obterUnidade(faina?.unidade);
    return `<article class="saved-budget" data-budget-id="${escapeHtml(budget.id)}">
      <div class="saved-budget-heading">
        <div><span class="saved-budget-client">${escapeHtml(budget.cliente)}</span><small>salvo em ${escapeHtml(formatarDataHora(budget.criadoEm))}</small></div>
        <span class="result-chip">${escapeHtml(faina?.fonte ?? 'SCO')} · ${escapeHtml(faina?.vigencia ?? 'provisório')}</span>
      </div>
      <div class="saved-budget-grid">
        <div><span>Faina</span><strong>${escapeHtml(faina?.descricao ?? budget.resultado.entrada.faina)}</strong></div>
        <div><span>Operação</span><strong>${number(budget.resultado.entrada.volumeToneladas)} · ${number(budget.resultado.quantidadeDePeriodos)} períodos</strong></div>
        <div><span>Custo por ${escapeHtml(unidade.singular)}</span><strong class="saved-budget-primary-cost">${money(budget.resultado.custoPorTonelada)}</strong></div>
        <div><span>Custo total</span><strong>${money(budget.resultado.custoTotal)}</strong></div>
      </div>
      <div class="saved-budget-actions">
        <details class="saved-budget-details">
          <summary><span aria-hidden="true">+</span> Ver cenário completo</summary>
          ${renderSavedBudgetDetails(budget.resultado, faina)}
        </details>
        <button class="secondary-button print-budget-button" type="button" data-print-budget="${escapeHtml(budget.id)}">Imprimir simulação</button>
      </div>
    </article>`;
  }).join('');
}

export function renderSavedBudgetDetails(resultado: ResultadoDeSimulacao, faina?: FainaCatalogada): string {
  const unidade = obterUnidade(faina?.unidade);
  const entrada = resultado.entrada;
  return `<div class="saved-scenario-details">
    <div class="saved-scenario-section">
      <span class="saved-scenario-caption">Dados da operação</span>
      <div class="saved-scenario-grid">
        <div><span>Faina</span><strong>${escapeHtml(faina?.descricao ?? entrada.faina)}</strong></div>
        <div><span>Início</span><strong>${formatarDataPtBr(entrada.inicio.data)} · ${escapeHtml(entrada.inicio.periodo)}</strong></div>
        <div><span>Quantidade</span><strong>${number(entrada.volumeToneladas)} ${unidade.abreviacao}</strong></div>
        <div><span>Produtividade-base</span><strong>${number(entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/terno/período</strong></div>
        <div><span>Períodos calculados</span><strong>${number(resultado.quantidadeDePeriodos)}</strong></div>
        <div><span>Ternos por período</span><strong>${number(entrada.ternosPorPeriodoPadrao ?? (resultado.quantidadeDePeriodos ? entrada.totalDeTernos / resultado.quantidadeDePeriodos : 0))}</strong></div>
        <div><span>Total de ternos calculado</span><strong>${number(entrada.totalDeTernos)}</strong></div>
      </div>
    </div>
    <div class="saved-scenario-section">
      <span class="saved-scenario-caption">Composição por período</span>
      <div class="saved-period-table-wrap"><table class="saved-period-table"><thead><tr><th>Data</th><th>Período</th><th>Produtividade / terno</th><th>Produção</th><th>Ternos</th><th>Majoração</th><th>Custo</th></tr></thead><tbody>
        ${resultado.periodos.map((periodo, indice) => `<tr><td>${formatarDataPtBr(periodo.periodo.data)}</td><td>${escapeHtml(periodo.periodo.identificador)}</td><td>${number(resultado.entrada.produtividadesPorPeriodo?.[indice] ?? resultado.entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/terno</td><td>${number(periodo.producaoToneladas)} ${unidade.abreviacao}</td><td>${number(periodo.ternos)}</td><td>${escapeHtml(periodo.custo.majoracao?.descricao ?? 'preço normal')}</td><td>${money(periodo.custo.total)}</td></tr>`).join('')}
      </tbody></table></div>
    </div>
    <div class="saved-scenario-section saved-period-memory">
      <span class="saved-scenario-caption">Memória por período</span>
      <div class="saved-period-memory-list">
        ${resultado.periodos.map((periodo) => `<details class="saved-period-memory-item">
          <summary>${formatarDataPtBr(periodo.periodo.data)} · ${escapeHtml(periodo.periodo.identificador)} <strong>${money(periodo.custo.total)}</strong></summary>
          <div class="saved-period-memory-lines">
            ${periodo.custo.memoria.map((linha) => `<div><span>${escapeHtml(linha.descricao)}</span><strong>${money(linha.valor)}</strong></div>`).join('')}
          </div>
        </details>`).join('')}
      </div>
    </div>
    ${resultado.custosOpcionais.length ? `<div class="saved-scenario-section saved-scenario-costs">
      <span class="saved-scenario-caption">Custos opcionais</span>
      ${resultado.custosOpcionais.map((custo) => {
        const label = custo.tipo === 'OUTRO' ? custo.descricao?.trim() || OPTIONAL_COST_LABELS.OUTRO : OPTIONAL_COST_LABELS[custo.tipo];
        return `<div><span>${escapeHtml(label)}</span><strong>${money(custo.custoTotal)}</strong></div>`;
      }).join('')}
    </div>` : ''}
    <div class="saved-scenario-section saved-scenario-costs">
      <span class="saved-scenario-caption">Resumo financeiro</span>
      ${resultado.memoria.map((linha) => `<div><span>${escapeHtml(linha.descricao)}</span><strong>${money(linha.valor)}</strong></div>`).join('')}
    </div>
  </div>`;
}

export function printSavedBudget(id: string | undefined, catalogo: CatalogoOgmo, calendario: CalendarioOgmo): void {
  if (!id) return;
  const budget = readSavedBudgets().find((item) => item.id === id);
  if (!budget) return;
  const faina = catalogo.obterFaina(budget.resultado.entrada.faina);
  const unidade = obterUnidade(faina?.unidade);
  const analise = obterAnaliseDeSensibilidade(budget.resultado, catalogo, calendario);
  const sensibilidade = analise.pontos;
  const produtividadeBase = budget.resultado.entrada.produtividadeToneladasPorPeriodo;
  const pontoOtimo = analise.otimizacao.melhor;
  const report = document.createElement('section');
  report.className = 'print-report';
  report.innerHTML = `<header class="print-report-header">
    <img src="/brand/portmac-blue.png" alt="PORTMAC" />
    <div><span>SIMULAÇÃO DE CUSTO DE OPERAÇÃO</span><strong>Orçamento salvo</strong></div>
  </header>
  <div class="print-report-client"><span>Cliente</span><strong>${escapeHtml(budget.cliente)}</strong><small>Gerado em ${escapeHtml(formatarDataHora(budget.criadoEm))}</small></div>
  <h1>${escapeHtml(faina?.descricao ?? budget.resultado.entrada.faina)}</h1>
  <p class="print-report-source">${escapeHtml(faina?.fonte ?? 'SCO')} · ${escapeHtml(faina?.vigencia ?? 'provisório')} · ${escapeHtml(faina?.referencia ?? '')}</p>
  <section class="print-report-primary-cost"><span>Custo por ${escapeHtml(unidade.singular)}</span><strong>${money(budget.resultado.custoPorTonelada)}</strong></section>
  <section class="print-report-section"><h2>Dados da operação</h2><div class="print-report-grid">
    <div><span>Início</span><strong>${formatarDataPtBr(budget.resultado.entrada.inicio.data)} · ${escapeHtml(budget.resultado.entrada.inicio.periodo)}</strong></div>
    <div><span>Quantidade</span><strong>${number(budget.resultado.entrada.volumeToneladas)} ${unidade.abreviacao}</strong></div>
    <div><span>Produtividade-base</span><strong>${number(budget.resultado.entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/terno/período</strong></div>
    <div><span>Períodos</span><strong>${number(budget.resultado.quantidadeDePeriodos)}</strong></div>
    <div><span>Ternos por período</span><strong>${number(budget.resultado.entrada.ternosPorPeriodoPadrao ?? (budget.resultado.quantidadeDePeriodos ? budget.resultado.entrada.totalDeTernos / budget.resultado.quantidadeDePeriodos : 0))}</strong></div>
    <div><span>Total de ternos</span><strong>${number(budget.resultado.entrada.totalDeTernos)}</strong></div>
    <div><span>Custo total</span><strong>${money(budget.resultado.custoTotal)}</strong></div>
  </div></section>
  <section class="print-report-section"><h2>Composição por período</h2><div class="saved-period-table-wrap"><table class="saved-period-table"><thead><tr><th>Data</th><th>Período</th><th>Produtividade / terno</th><th>Produção</th><th>Ternos</th><th>Majoração</th><th>Custo</th></tr></thead><tbody>
    ${budget.resultado.periodos.map((periodo, indice) => `<tr><td>${formatarDataPtBr(periodo.periodo.data)}</td><td>${escapeHtml(periodo.periodo.identificador)}</td><td>${number(budget.resultado.entrada.produtividadesPorPeriodo?.[indice] ?? budget.resultado.entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/terno</td><td>${number(periodo.producaoToneladas)} ${unidade.abreviacao}</td><td>${number(periodo.ternos)}</td><td>${escapeHtml(periodo.custo.majoracao?.descricao ?? 'preço normal')}</td><td>${money(periodo.custo.total)}</td></tr>`).join('')}
  </tbody></table></div></section>
  <section class="print-report-section"><h2>Sensibilidade à produtividade</h2><p class="print-report-note">Comparação do custo por ${escapeHtml(unidade.singular)} em cenários automáticos de produtividade por terno e por período${pontoOtimo ? ` · ótimo calculado em ${number(pontoOtimo.produtividade)} ${unidade.abreviacao}/terno/período, com ${number(pontoOtimo.periodos)} períodos` : ''}.</p><div class="print-memory">${sensibilidade.map((ponto) => `<div><span>${number(ponto.produtividade)} ${unidade.abreviacao}/terno/período · ${number(ponto.periodos)} períodos${ponto.produtividade === produtividadeBase ? ' · base' : ''}${pontoOtimo && ponto.produtividade === pontoOtimo.produtividade ? ' · ótimo' : ''}</span><strong>${money(ponto.custoPorTonelada)}</strong></div>`).join('')}</div></section>
  <section class="print-report-section"><h2>Memória por período</h2><div class="print-period-memory">
    ${budget.resultado.periodos.map((periodo) => `<div class="print-period-memory-block"><h3>${formatarDataPtBr(periodo.periodo.data)} · ${escapeHtml(periodo.periodo.identificador)} · ${money(periodo.custo.total)}</h3>${periodo.custo.memoria.map((linha) => `<div><span>${escapeHtml(linha.descricao)}</span><strong>${money(linha.valor)}</strong></div>`).join('')}</div>`).join('')}
  </div></section>
  ${budget.resultado.custosOpcionais.length ? `<section class="print-report-section"><h2>Custos opcionais</h2><div class="print-memory">${budget.resultado.custosOpcionais.map((custo) => {
    const label = custo.tipo === 'OUTRO' ? custo.descricao?.trim() || OPTIONAL_COST_LABELS.OUTRO : OPTIONAL_COST_LABELS[custo.tipo];
    return `<div><span>${escapeHtml(label)}</span><strong>${money(custo.custoTotal)}</strong></div>`;
  }).join('')}</div></section>` : ''}
  <section class="print-report-section"><h2>Memória de cálculo</h2><div class="print-memory">${budget.resultado.memoria.map((linha) => `<div><span>${escapeHtml(linha.descricao)}</span><strong>${money(linha.valor)}</strong></div>`).join('')}</div></section>
  <footer class="print-report-footer">PORTMAC · simulador de custo de operação · documento preliminar</footer>`;
  document.body.appendChild(report);
  document.body.classList.add('printing-budget');
  const cleanup = () => {
    document.body.classList.remove('printing-budget');
    report.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
