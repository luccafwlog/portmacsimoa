import './styles.css';
import { data, formatarDataPtBr } from './dominio/tempo.js';
import { obterUnidade } from './dominio/unidade.js';
import { calendarioOperacional } from './calendario/operacional.js';
import { catalogoPortmac } from './catalogo/portmac.js';
import type { CustoOpcional, EntradaDeSimulacao, PeriodoOgmo, ResultadoDeSimulacao, TipoDeCustoOpcional } from './dominio/tipos.js';
import { simular, distribuirTernos } from './motor/simulador.js';
import { obterAnaliseDeSensibilidade } from './motor/sensibilidade.js';
import {
  escapeHtml,
  money,
  normalizarBusca,
  number,
  numberOf,
  quaseIgual,
  setText,
  valueOf,
} from './ui/formato.js';
import { gerarGraficoCustoPeriodos, gerarGraficoSensibilidade } from './ui/graficos.js';
import {
  OPTIONAL_COST_LABELS,
  printSavedBudget,
  renderClientsPage,
  saveBudget,
} from './ui/orcamentos.js';
import { renderCatalogPage } from './ui/catalogo-view.js';
import {
  renderDistributionTotals,
  showDistributionError,
  volumeDistribuidoPorPeriodos,
} from './ui/editor-periodos.js';

const form = document.querySelector<HTMLFormElement>('#simulation-form')!;
const errorBox = document.querySelector<HTMLDivElement>('#error')!;
const emptyState = document.querySelector<HTMLElement>('#empty-state')!;
const resultState = document.querySelector<HTMLElement>('#result-state')!;
const fainaInput = document.querySelector<HTMLInputElement>('#faina')!;
const fainaCodeInput = document.querySelector<HTMLInputElement>('#faina-code')!;
const fainaOptions = document.querySelector<HTMLDivElement>('#faina-options')!;
const volumeInput = document.querySelector<HTMLInputElement>('#volume')!;
const productivityInput = document.querySelector<HTMLInputElement>('#produtividade')!;
const dateInput = document.querySelector<HTMLInputElement>('#data')!;
const periodInput = document.querySelector<HTMLSelectElement>('#periodo')!;
const ternosPorPeriodoInput = document.querySelector<HTMLInputElement>('#ternos-por-periodo')!;
const costToggles = document.querySelectorAll<HTMLInputElement>('.cost-toggle');
const customCostList = document.querySelector<HTMLDivElement>('#custom-cost-list')!;
const addCustomCostButton = document.querySelector<HTMLButtonElement>('#add-custom-cost')!;
const pages = document.querySelectorAll<HTMLElement>('[data-page]');
const routeLinks = document.querySelectorAll<HTMLAnchorElement>('[data-route]');
const catalogSearchInput = document.querySelector<HTMLInputElement>('#catalog-search')!;
const catalogFilterButtons = document.querySelectorAll<HTMLButtonElement>('[data-catalog-source]');
const ternosEditorBody = document.querySelector<HTMLTableSectionElement>('#ternos-editor-body')!;
const ternosEditorStatus = document.querySelector<HTMLDivElement>('#ternos-editor-status')!;

let currentResult: ResultadoDeSimulacao | undefined;
let customCostCounter = 0;
let draftDistribution: readonly number[] = [];
let draftProductivities: readonly number[] = [];
let fainaOptionIndex = -1;
let catalogSourceFilter: 'TODAS' | 'ACT' | 'CCT' = 'TODAS';

const fainasSelecionaveis = catalogoPortmac.listarFainas()
  .filter((faina) => faina.status !== 'PENDENTE_DE_VALIDACAO');

type AppRoute = 'nova-simulacao' | 'clientes' | 'catalogo';

function routeFromHash(): AppRoute {
  const route = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  return route === 'clientes' || route === 'catalogo' ? route : 'nova-simulacao';
}

function renderRoute(route: AppRoute): void {
  pages.forEach((page) => { page.hidden = page.dataset.page !== route; });
  routeLinks.forEach((link) => {
    const active = link.dataset.route === route;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (route === 'catalogo') renderCatalogPage(catalogoPortmac, catalogSearchInput.value, catalogSourceFilter);
  if (route === 'clientes') renderClientsPage(catalogoPortmac);
  document.title = route === 'nova-simulacao'
    ? 'SCO · Nova simulação'
    : route === 'clientes' ? 'SCO · Clientes cadastrados' : 'SCO · Catálogo de fainas';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

renderFainaOptions();
updateOperationUnitLabels();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  recalculate();
});
volumeInput.addEventListener('input', () => { markScenarioDirty(); updateCalculatedPeriods(); updateTernosPreview(); });
productivityInput.addEventListener('input', () => { markScenarioDirty(); updateCalculatedPeriods(); updateTernosPreview(); });
ternosPorPeriodoInput.addEventListener('input', () => { markScenarioDirty(); updateCalculatedPeriods(); updateTernosPreview(); });
dateInput.addEventListener('change', () => { markScenarioDirty(); updateTernosPreview(); });
periodInput.addEventListener('change', () => { markScenarioDirty(); updateTernosPreview(); });
catalogSearchInput.addEventListener('input', () => renderCatalogPage(catalogoPortmac, catalogSearchInput.value, catalogSourceFilter));
catalogFilterButtons.forEach((button) => button.addEventListener('click', () => {
  catalogSourceFilter = button.dataset.catalogSource as 'TODAS' | 'ACT' | 'CCT';
  catalogFilterButtons.forEach((filter) => {
    const active = filter === button;
    filter.classList.toggle('active', active);
    filter.setAttribute('aria-pressed', String(active));
  });
  renderCatalogPage(catalogoPortmac, catalogSearchInput.value, catalogSourceFilter);
}));
fainaInput.addEventListener('input', handleFainaInput);
fainaInput.addEventListener('focus', () => openFainaOptions());
fainaInput.addEventListener('keydown', handleFainaKeydown);
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Node) || !fainaInput.closest('.combobox')?.contains(event.target)) closeFainaOptions();
});
document.querySelector<HTMLButtonElement>('#save-budget')?.addEventListener('click', handleSaveBudget);
document.addEventListener('click', (event) => {
  const button = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('[data-print-budget]') : null;
  if (button) printSavedBudget(button.dataset.printBudget, catalogoPortmac, calendarioOperacional);
});
document.addEventListener('click', (event) => {
  const detailsButton = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('[data-catalog-details]') : null;
  if (detailsButton) {
    const details = document.getElementById(detailsButton.dataset.catalogDetails ?? '');
    if (details) {
      const shouldShow = details.hidden;
      details.hidden = !shouldShow;
      detailsButton.setAttribute('aria-expanded', String(shouldShow));
      detailsButton.querySelector('span')!.textContent = shouldShow ? '−' : '+';
    }
    return;
  }

  const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('.memory-periods-toggle') : null;
  if (!target) return;

  const periods = document.getElementById(target.getAttribute('aria-controls') ?? '');
  if (!(periods instanceof HTMLElement)) return;

  const shouldShow = periods.hidden;
  periods.hidden = !shouldShow;
  target.setAttribute('aria-expanded', String(shouldShow));
  target.querySelector<HTMLElement>('.memory-periods-toggle-icon')!.textContent = shouldShow ? '−' : '+';
});
costToggles.forEach((toggle) => toggle.addEventListener('change', () => updateOptionalCostInput(toggle)));
addCustomCostButton.addEventListener('click', addCustomCost);
updateCalculatedPeriods();
updateOperationUnitLabels();
updateTernosPreview();
renderCatalogPage(catalogoPortmac, '', 'TODAS');
window.addEventListener('hashchange', () => renderRoute(routeFromHash()));
renderRoute(routeFromHash());

function recalculate(
  distribution?: readonly number[],
  productivities?: readonly number[],
): void {
  clearError();
  try {
    const entrada = readInput(distribution, productivities);
    currentResult = simular(entrada, catalogoPortmac, calendarioOperacional);
    render(currentResult);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Não foi possível calcular este cenário.');
  }
}

function readInput(
  distribution?: readonly number[],
  productivities?: readonly number[],
): EntradaDeSimulacao {
  const dateValue = valueOf<HTMLInputElement>('#data');
  const [ano, mes, dia] = dateValue.split('-').map(Number);
  const cliente = valueOf<HTMLInputElement>('#cliente').trim();
  const custosOpcionais = readOptionalCosts();
  return {
    ...(cliente ? { cliente } : {}),
    ...(custosOpcionais.length ? { custosOpcionais } : {}),
    faina: fainaCodeInput.value,
    inicio: { data: data(ano!, mes!, dia!), periodo: valueOf<HTMLSelectElement>('#periodo') },
    volumeToneladas: numberOf('#volume'),
    produtividadeToneladasPorPeriodo: numberOf('#produtividade'),
    ternosPorPeriodoPadrao: numberOf('#ternos-por-periodo'),
    totalDeTernos: totalTernosCalculado(),
    ...((productivities ?? draftProductivities).length
      ? { produtividadesPorPeriodo: productivities ?? draftProductivities }
      : {}),
    ...((distribution ?? draftDistribution).length ? { ternosPorPeriodo: distribution ?? draftDistribution } : {}),
  };
}

function render(resultado: ResultadoDeSimulacao): void {
  emptyState.hidden = true;
  resultState.hidden = false;
  const faina = catalogoPortmac.obterFaina(resultado.entrada.faina);
  setText('#result-faina', faina?.descricao ?? resultado.entrada.faina);
  setText('#result-source', faina ? `${faina.fonte}${faina.status === 'PROVISORIA' ? ' · PROVISÓRIA' : ''} · ${faina.vigencia}` : 'fonte não encontrada');
  setText('#result-client', resultado.entrada.cliente ? `Cliente: ${resultado.entrada.cliente}` : 'Cliente não informado');
  setText('#labor-cost-total', money(resultado.custoDeMaoDeObra));
  const unidade = obterUnidade(faina?.unidade);
  setText('#cost-per-unit-label', `Custo por ${unidade.singular}`);
  setText('#labor-cost-per-unit', `${money(resultado.custoDeMaoDeObra / resultado.entrada.volumeToneladas)} / ${unidade.abreviacao}`);
  setText('#composed-cost-total', money(resultado.custoTotal));
  renderOptionalCostLines(resultado);
  setText('#cost-per-ton', money(resultado.custoPorTonelada));
  setText('#cost-total', money(resultado.custoTotal));
  setText('#period-count', String(resultado.quantidadeDePeriodos));
  setText('#calculated-periods', String(resultado.quantidadeDePeriodos));
  const produtividades = resultado.entrada.produtividadesPorPeriodo;
  const produtividadeCustomizada = produtividades?.some((produtividade) => produtividade !== resultado.entrada.produtividadeToneladasPorPeriodo) ?? false;
  const ternosPorPeriodo = resultado.entrada.ternosPorPeriodoPadrao
    ?? (resultado.quantidadeDePeriodos ? resultado.entrada.totalDeTernos / resultado.quantidadeDePeriodos : 0);
  setText('#calculation-summary', produtividadeCustomizada
    ? `${number(resultado.entrada.volumeToneladas)} ${unidade.abreviacao} ÷ (produtividade por terno ajustada × ternos por período) = ${resultado.quantidadeDePeriodos} períodos · ${number(ternosPorPeriodo)} terno(s)/período · calendário de Vila Velha aplicado`
    : `${number(resultado.entrada.volumeToneladas)} ${unidade.abreviacao} ÷ (${number(resultado.entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/terno/período × ${number(ternosPorPeriodo)} terno(s)) = ${resultado.quantidadeDePeriodos} períodos · calendário de Vila Velha aplicado`);
  renderCalculationMemory(resultado);
  renderCharts(resultado);
  renderTernosEditor(resultado);
  const saveButton = document.querySelector<HTMLButtonElement>('#save-budget');
  const saveHint = document.querySelector<HTMLElement>('#save-budget-hint');
  if (saveButton && saveHint) {
    saveButton.disabled = !resultado.entrada.cliente;
    saveHint.textContent = resultado.entrada.cliente
      ? `Vinculado a ${resultado.entrada.cliente}`
      : 'Informe o cliente nos dados da operação para salvar';
  }
}

function renderCharts(resultado: ResultadoDeSimulacao): void {
  const periodChartContainer = document.querySelector<HTMLDivElement>('#period-cost-chart-body');
  const periodChartSummary = document.querySelector<HTMLElement>('#period-cost-chart-summary');
  if (periodChartContainer && periodChartSummary) {
    const { svgHtml, summaryText, ariaLabel } = gerarGraficoCustoPeriodos(resultado);
    periodChartSummary.textContent = summaryText;
    periodChartContainer.setAttribute('role', 'img');
    periodChartContainer.setAttribute('aria-label', ariaLabel);
    periodChartContainer.innerHTML = svgHtml;
  }

  const sensitivityContainer = document.querySelector<HTMLDivElement>('#productivity-sensitivity-body');
  const sensitivitySummary = document.querySelector<HTMLElement>('#productivity-sensitivity-summary');
  if (sensitivityContainer) {
    const faina = catalogoPortmac.obterFaina(resultado.entrada.faina);
    const unidade = obterUnidade(faina?.unidade);
    const analise = obterAnaliseDeSensibilidade(resultado, catalogoPortmac, calendarioOperacional);
    const ternosPorPeriodo = resultado.entrada.ternosPorPeriodoPadrao
      ?? (resultado.quantidadeDePeriodos ? resultado.entrada.totalDeTernos / resultado.quantidadeDePeriodos : 0);
    const dados = gerarGraficoSensibilidade(
      analise,
      resultado.entrada.produtividadeToneladasPorPeriodo,
      resultado.custoPorTonelada,
      ternosPorPeriodo,
      unidade,
    );
    if (!dados) {
      if (sensitivitySummary) sensitivitySummary.textContent = 'ótimo indisponível';
      sensitivityContainer.innerHTML = '<p class="sensitivity-empty">Não foi possível gerar cenários comparativos para esta operação.</p>';
    } else {
      if (sensitivitySummary) sensitivitySummary.textContent = dados.summaryText;
      sensitivityContainer.setAttribute('role', 'img');
      sensitivityContainer.setAttribute('aria-label', dados.ariaLabel);
      sensitivityContainer.innerHTML = `${dados.svgHtml}${dados.tabelaHtml}`;
    }
  }
}

function handleSaveBudget(): void {
  if (!currentResult) return;
  const cliente = currentResult.entrada.cliente?.trim();
  const saveHint = document.querySelector<HTMLElement>('#save-budget-hint');
  if (!cliente) {
    showError('Informe o cliente nos dados da operação antes de salvar o orçamento.');
    saveHint?.replaceChildren(document.createTextNode('Informe o cliente nos dados da operação para salvar'));
    return;
  }
  saveBudget(currentResult, cliente);
  if (saveHint) saveHint.textContent = 'Orçamento salvo no cadastro do cliente';
  const button = document.querySelector<HTMLButtonElement>('#save-budget');
  if (button) {
    button.textContent = 'Orçamento salvo';
    button.disabled = true;
  }
}

function applyPeriodDetails(): void {
  const ternos = Array.from(ternosEditorBody.querySelectorAll<HTMLInputElement>('.ternos-input')).map((input) => Number(input.value));
  const produtividades = Array.from(ternosEditorBody.querySelectorAll<HTMLInputElement>('.productivity-period-input')).map((input) => Number(input.value));
  const totalTernos = ternos.reduce((sum, value) => sum + value, 0);
  const volume = numberOf('#volume');
  const totalTernosEsperado = totalTernosCalculado();
  draftDistribution = ternos;
  draftProductivities = produtividades;
  const unidade = obterUnidade(catalogoPortmac.obterFaina(fainaCodeInput.value)?.unidade);
  renderDistributionTotals(produtividades, ternos, volume, totalTernosEsperado, unidade.abreviacao);
  if (ternos.some((value) => !Number.isInteger(value) || value < 0 || value > 4)) {
    showDistributionError('Cada período deve ter entre 0 e 4 ternos.');
    return;
  }
  if (totalTernos !== totalTernosEsperado) {
    if (!Number.isFinite(totalTernosEsperado)) {
      showDistributionError('Informe os ternos por período para validar a distribuição.');
      return;
    }
    showDistributionError(`A soma atual é ${totalTernos}; ela precisa permanecer em ${totalTernosEsperado}.`);
    return;
  }
  if (produtividades.some((value) => !Number.isFinite(value) || value <= 0)) {
    showDistributionError('Cada produtividade por período deve ser maior que zero.');
    return;
  }
  const totalVolumeDistribuido = volumeDistribuidoPorPeriodos(produtividades, ternos, volume);
  if (!quaseIgual(totalVolumeDistribuido, volume)) {
    showDistributionError(`O volume distribuído é ${number(totalVolumeDistribuido)}; ele precisa ser exatamente ${number(volume)}.`);
    return;
  }
  ternosEditorStatus.hidden = true;
  if (currentResult && ternos.length === currentResult.quantidadeDePeriodos) {
    recalculate(ternos, produtividades);
  } else {
    renderTernosEditor();
  }
}

function renderTernosEditor(resultado?: ResultadoDeSimulacao): void {
  const periodos: readonly PeriodoOgmo[] = resultado
    ? resultado.periodos.map((periodo) => periodo.periodo)
    : projetarPeriodosDoFormulario();
  const totalTernos = totalTernosCalculado();
  if (resultado) draftDistribution = resultado.distribuicaoDeTernos;
  if (draftDistribution.length !== periodos.length || draftDistribution.reduce((soma, ternos) => soma + ternos, 0) !== totalTernos) {
    draftDistribution = distribuirTernos(totalTernos, periodos.length);
  }
  const produtividadeBase = numberOf('#produtividade');
  if (resultado) {
    draftProductivities = resultado.entrada.produtividadesPorPeriodo
      ?? Array.from({ length: periodos.length }, () => produtividadeBase);
  }
  const volume = numberOf('#volume');
  if (
    draftProductivities.length !== periodos.length
    || draftProductivities.some((produtividade) => !Number.isFinite(produtividade) || produtividade <= 0)
    || !quaseIgual(volumeDistribuidoPorPeriodos(draftProductivities, draftDistribution, volume), volume)
  ) {
    draftProductivities = periodos.length && produtividadeBase > 0 && Number.isFinite(totalTernos)
      ? Array.from({ length: periodos.length }, () => produtividadeBase)
      : [];
  }

  const totalTernosLabel = Number.isFinite(totalTernos)
    ? `${number(totalTernos)} ${totalTernos === 1 ? 'terno' : 'ternos'}`
    : 'total de ternos pendente';
  setText('#ternos-editor-count', `${periodos.length} ${periodos.length === 1 ? 'período' : 'períodos'} · ${totalTernosLabel}`);
  const unidade = obterUnidade(catalogoPortmac.obterFaina(fainaCodeInput.value)?.unidade);
  renderDistributionTotals(draftProductivities, draftDistribution, volume, totalTernos, unidade.abreviacao);
  if (!periodos.length) {
    ternosEditorStatus.textContent = 'Informe volume, produtividade e data válidos para detalhar os períodos.';
    ternosEditorStatus.hidden = false;
    ternosEditorBody.innerHTML = '';
    return;
  }
  const excedeLimite = totalTernos > periodos.length * 4;
  ternosEditorStatus.textContent = excedeLimite
    ? `O máximo é ${periodos.length * 4} ternos para ${periodos.length} períodos.`
    : '';
  ternosEditorStatus.hidden = !excedeLimite;
  ternosEditorBody.innerHTML = periodos.map((periodo, indice) => {
    const calculado = resultado?.periodos[indice];
    const ternos = draftDistribution[indice] ?? 0;
    const produtividade = draftProductivities[indice] ?? produtividadeBase;
    return `
      <tr>
        <td>${escapeHtml(periodo.identificador)}</td>
        <td>${formatarDataPtBr(periodo.data)}</td>
        <td>
          <label class="period-productivity-control">
            <input class="productivity-period-input" data-period-index="${periodo.indice}" type="number" min="0.01" step="0.01" value="${produtividade}" aria-label="Produtividade no ${periodo.identificador}" />
            <span>${unidade.abreviacao} / terno / período</span>
          </label>
        </td>
        <td>
          <div class="ternos-control">
            <input class="ternos-input" data-period-index="${periodo.indice}" type="range" min="0" max="4" step="1" value="${Math.min(4, Math.max(0, ternos))}" aria-label="Ternos no ${periodo.identificador}" ${excedeLimite ? 'disabled' : ''} />
            <output class="ternos-value" for="ternos-${periodo.indice}">${Math.min(4, Math.max(0, ternos))}</output>
          </div>
        </td>
        <td class="period-premium-cell">
          ${calculado ? `<span class="period-premium">${escapeHtml(calculado.custo.majoracao?.descricao ?? 'dia normal · preço normal')}</span><small>tabela ${escapeHtml(calculado.custo.majoracao?.fonte ?? 'ACT')}</small>` : '<span class="period-pending">a calcular</span>'}
        </td>
        <td>${calculado ? money(calculado.custo.total) : '—'}</td>
      </tr>
    `;
  }).join('');

  ternosEditorBody.querySelectorAll<HTMLInputElement>('.ternos-input').forEach((input) => {
    input.id = `ternos-${input.dataset.periodIndex}`;
    input.addEventListener('input', () => {
      const value = input.closest('.ternos-control')?.querySelector<HTMLOutputElement>('.ternos-value');
      if (value) {
        value.value = input.value;
        value.textContent = input.value;
      }
      applyPeriodDetails();
    });
  });
  ternosEditorBody.querySelectorAll<HTMLInputElement>('.productivity-period-input').forEach((input) => {
    input.addEventListener('input', () => applyPeriodDetails());
  });
}

function updateTernosPreview(): void {
  renderTernosEditor();
}

function projetarPeriodosDoFormulario(): readonly PeriodoOgmo[] {
  const volume = Number(volumeInput.value);
  const produtividade = Number(productivityInput.value);
  const ternosPorPeriodo = Number(ternosPorPeriodoInput.value);
  if (volume <= 0 || produtividade <= 0 || !Number.isInteger(ternosPorPeriodo) || ternosPorPeriodo < 1 || ternosPorPeriodo > 4) return [];
  const quantidade = Math.ceil(volume / (produtividade * ternosPorPeriodo));
  const [ano, mes, dia] = dateInput.value.split('-').map(Number);
  if (!ano || !mes || !dia) return [];
  try {
    return calendarioOperacional.projetar({ data: data(ano, mes, dia), periodo: periodInput.value }, quantidade);
  } catch {
    return [];
  }
}

function renderFainaOptions(): void {
  const termo = normalizarBusca(fainaInput.value);
  const opcoes = fainasSelecionaveis.filter((faina) => normalizarBusca([
    faina.descricao,
    faina.codigo,
    faina.codigoDaTabela,
    faina.grupoDaTabela,
    faina.fonte,
  ].filter(Boolean).join(' ')).includes(termo));
  fainaOptions.innerHTML = opcoes.length ? opcoes.map((faina, indice) => `
    <button id="faina-option-${indice}" class="combobox-option" type="button" role="option" aria-selected="${faina.codigo === fainaCodeInput.value}" data-faina-code="${escapeHtml(faina.codigo)}">
      <strong>${escapeHtml(faina.descricao)}</strong>
      <small>${escapeHtml(faina.codigoDaTabela ?? faina.codigo)} · ${faina.fonte}${faina.status === 'PROVISORIA' ? ' · provisória' : ''}</small>
    </button>
  `).join('') : '<div class="combobox-empty">Nenhuma faina encontrada.</div>';
  fainaOptionIndex = -1;
}

function selectFaina(codigo?: string): void {
  if (!codigo) return;
  const faina = fainasSelecionaveis.find((registro) => registro.codigo === codigo);
  if (!faina) return;
  fainaCodeInput.value = faina.codigo;
  fainaInput.value = `${faina.descricao} · ${faina.codigoDaTabela ?? faina.codigo} · ${faina.fonte}`;
  fainaInput.setAttribute('aria-label', `Faina selecionada: ${faina.descricao}`);
  renderFainaOptions();
  closeFainaOptions();
  markScenarioDirty();
  updateOperationUnitLabels();
  updateTernosPreview();
}

function handleFainaInput(): void {
  fainaCodeInput.value = '';
  markScenarioDirty();
  renderFainaOptions();
  openFainaOptions();
  updateOperationUnitLabels();
}

function handleFainaKeydown(event: KeyboardEvent): void {
  const options = Array.from(fainaOptions.querySelectorAll<HTMLButtonElement>('.combobox-option'));
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    openFainaOptions();
    if (!options.length) return;
    fainaOptionIndex = event.key === 'ArrowDown'
      ? Math.min(fainaOptionIndex + 1, options.length - 1)
      : Math.max(fainaOptionIndex - 1, 0);
    options.forEach((option, indice) => option.classList.toggle('active', indice === fainaOptionIndex));
    fainaInput.setAttribute('aria-activedescendant', options[fainaOptionIndex]!.id);
  } else if (event.key === 'Enter' && fainaOptionIndex >= 0 && options[fainaOptionIndex]) {
    event.preventDefault();
    selectFaina(options[fainaOptionIndex]!.dataset.fainaCode);
  } else if (event.key === 'Escape') {
    closeFainaOptions();
  }
}

function openFainaOptions(): void {
  renderFainaOptions();
  fainaOptions.hidden = false;
  fainaInput.setAttribute('aria-expanded', 'true');
}

function closeFainaOptions(): void {
  fainaOptions.hidden = true;
  fainaInput.setAttribute('aria-expanded', 'false');
  fainaInput.removeAttribute('aria-activedescendant');
}

fainaOptions.addEventListener('click', (event) => {
  const option = (event.target as HTMLElement).closest<HTMLButtonElement>('.combobox-option');
  if (option) selectFaina(option.dataset.fainaCode);
});

function markScenarioDirty(): void {
  if (!currentResult) return;
  currentResult = undefined;
  resultState.hidden = true;
  emptyState.hidden = false;
}

function readOptionalCosts(): CustoOpcional[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('.cost-toggle'))
    .filter((toggle) => toggle.checked)
    .map((toggle) => {
      const tipo = toggle.dataset.costType as TipoDeCustoOpcional;
      return {
        tipo,
        custoTotal: numberOf(`#${toggle.dataset.costInput!}`),
        ...(tipo === 'OUTRO'
          ? { descricao: valueOf<HTMLInputElement>(`#${toggle.dataset.costDescription!}`).trim() }
          : {}),
      };
    });
}

function addCustomCost(): void {
  customCostCounter += 1;
  const suffix = customCostCounter;
  const descriptionId = `custom-cost-description-${suffix}`;
  const amountId = `custom-cost-amount-${suffix}`;
  const fieldsId = `custom-cost-fields-${suffix}`;

  customCostList.insertAdjacentHTML('beforeend', `
    <div class="optional-cost-item custom-cost-item">
      <div class="custom-cost-heading">
        <label class="toggle-row">
          <input class="cost-toggle" type="checkbox" checked aria-label="Ativar custo personalizado" data-cost-type="OUTRO" data-cost-input="${amountId}" data-cost-description="${descriptionId}" />
          <span class="toggle-switch" aria-hidden="true"></span>
          <span class="custom-cost-state">Ativo</span>
        </label>
        <button class="remove-custom-cost" type="button">Remover</button>
      </div>
      <div id="${fieldsId}" class="custom-cost-inputs">
        <label class="optional-input" for="${descriptionId}">
          <span>Descrição</span>
          <input id="${descriptionId}" type="text" maxlength="120" placeholder="Nome do custo" required />
        </label>
        <label class="optional-input" for="${amountId}">
          <span>Custo total <b>R$</b></span>
          <input id="${amountId}" type="number" min="0" step="0.01" placeholder="0,00" required />
        </label>
      </div>
    </div>
  `);

  const item = customCostList.lastElementChild as HTMLElement;
  const toggle = item.querySelector<HTMLInputElement>('.cost-toggle')!;
  toggle.addEventListener('change', () => updateOptionalCostInput(toggle));
  item.querySelector<HTMLButtonElement>('.remove-custom-cost')!.addEventListener('click', () => item.remove());
  updateOptionalCostInput(toggle);
}

function updateOptionalCostInput(toggle: HTMLInputElement): void {
  const item = toggle.closest<HTMLElement>('.optional-cost-item')!;
  item.querySelectorAll<HTMLInputElement>('input:not(.cost-toggle)').forEach((input) => {
    input.disabled = !toggle.checked;
    input.required = toggle.checked;
  });
  item.querySelectorAll<HTMLElement>('.optional-input, .custom-cost-inputs').forEach((wrapper) => {
    wrapper.hidden = !toggle.checked;
  });
}

function renderOptionalCostLines(resultado: ResultadoDeSimulacao): void {
  const lines = document.querySelector<HTMLDivElement>('#optional-cost-lines')!;
  const faina = catalogoPortmac.obterFaina(resultado.entrada.faina);
  const unidade = obterUnidade(faina?.unidade);
  lines.innerHTML = resultado.custosOpcionais.length
    ? resultado.custosOpcionais.map((custo) => {
      const label = custo.tipo === 'OUTRO' ? custo.descricao?.trim() || OPTIONAL_COST_LABELS.OUTRO : OPTIONAL_COST_LABELS[custo.tipo];
      return `
        <div class="cost-line cost-line-optional">
          <div><span>${escapeHtml(label)}</span><small>${money(custo.custoPorTonelada)} / ${unidade.abreviacao}</small></div>
          <strong>${money(custo.custoTotal)}</strong>
        </div>
      `;
    }).join('')
    : '<p class="no-optional-costs">Nenhum custo opcional ativado.</p>';
}

function renderCalculationMemory(resultado: ResultadoDeSimulacao): void {
  const container = document.querySelector<HTMLDivElement>('#calculation-memory-lines')!;
  const unidade = obterUnidade(catalogoPortmac.obterFaina(resultado.entrada.faina)?.unidade);
  const summary = resultado.memoria.map((linha, indice) => `
    <div class="memory-line">
      <span>${escapeHtml(linha.descricao)}</span>
      <strong>${indice < 4 ? number(linha.valor) : money(linha.valor)}</strong>
    </div>
  `).join('');
  const periods = resultado.periodos.map((periodo, indice) => `
    <details class="memory-period">
      <summary>${formatarDataPtBr(periodo.periodo.data)} · ${escapeHtml(periodo.periodo.identificador)} · produção ${number(periodo.producaoToneladas)} ${unidade.abreviacao} · ${money(periodo.custo.total)}</summary>
      <div class="memory-period-lines">
        <div class="memory-line">
          <span>Produtividade por terno</span>
          <strong>${number(resultado.entrada.produtividadesPorPeriodo?.[indice] ?? resultado.entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/terno/período</strong>
        </div>
        <div class="memory-line">
          <span>Ternos alocados</span>
          <strong>${number(periodo.ternos)}</strong>
        </div>
        <div class="memory-line">
          <span>Produção movimentada no período</span>
          <strong>${number(periodo.producaoToneladas)} ${unidade.abreviacao}</strong>
        </div>
        ${periodo.custo.memoria.map((linha) => `
          <div class="memory-line">
            <span>${escapeHtml(linha.descricao)}</span>
            <strong>${money(linha.valor)}</strong>
          </div>
        `).join('')}
      </div>
    </details>
  `).join('');
  container.innerHTML = `
    <div class="memory-overview">
      <span class="memory-caption">Resumo do cenário</span>
      ${summary}
    </div>
    <div class="memory-periods">
      <button class="memory-periods-toggle" type="button" aria-expanded="false" aria-controls="memory-periods-list">
        <span class="memory-periods-toggle-label">Composição por período</span>
        <span class="memory-periods-toggle-icon" aria-hidden="true">+</span>
      </button>
      <div id="memory-periods-list" class="memory-periods-list" hidden>
        ${periods}
      </div>
    </div>
  `;
}

function updateCalculatedPeriods(): void {
  const volume = Number(volumeInput.value);
  const productivity = Number(productivityInput.value);
  const ternosPorPeriodo = Number(ternosPorPeriodoInput.value);
  const periods = volume > 0
    && productivity > 0
    && Number.isInteger(ternosPorPeriodo)
    && ternosPorPeriodo >= 1
    && ternosPorPeriodo <= 4
    ? Math.ceil(volume / (productivity * ternosPorPeriodo))
    : undefined;
  setText('#calculated-periods', periods === undefined ? '—' : String(periods));
  const totalTernos = periods === undefined ? Number.NaN : periods * ternosPorPeriodo;
  setText('#total-ternos', Number.isInteger(totalTernos) && totalTernos > 0 ? number(totalTernos) : '—');
}

function totalTernosCalculado(): number {
  const volume = Number(volumeInput.value);
  const produtividade = Number(productivityInput.value);
  const ternosPorPeriodo = Number(ternosPorPeriodoInput.value);
  if (volume <= 0 || produtividade <= 0 || !Number.isInteger(ternosPorPeriodo) || ternosPorPeriodo < 1 || ternosPorPeriodo > 4) {
    return Number.NaN;
  }
  const quantidadeDePeriodos = Math.ceil(volume / (produtividade * ternosPorPeriodo));
  return quantidadeDePeriodos * ternosPorPeriodo;
}

function updateOperationUnitLabels(): void {
  const faina = catalogoPortmac.obterFaina(fainaCodeInput.value);
  const unidade = obterUnidade(faina?.unidade);
  const nome = unidade.abreviacao === 'ton' ? 'Volume do navio' : 'Quantidade do navio';
  document.querySelector<HTMLElement>('#volume-field-label')!.innerHTML = `${nome} <b>${unidade.abreviacao}</b>`;
  document.querySelector<HTMLElement>('#productivity-field-label')!.innerHTML = `Capacidade <b>${unidade.abreviacao} / período</b>`;
}

function clearError(): void { errorBox.hidden = true; errorBox.textContent = ''; }
function showError(message: string): void { errorBox.textContent = message; errorBox.hidden = false; }
