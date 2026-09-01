import './styles.css';
import { data, formatarDataPtBr } from './dominio/tempo.js';
import { calendarioOperacional } from './calendario/operacional.js';
import { catalogoPortmac } from './catalogo/portmac.js';
import type { CustoOpcional, EntradaDeSimulacao, PeriodoOgmo, ResultadoDeSimulacao, TipoDeCustoOpcional } from './dominio/tipos.js';
import { simular } from './motor/simulador.js';
import { otimizarCenario, type ResultadoDeOtimizacao } from './motor/otimizador.js';

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
const ternosEditorVolumeTotal = document.querySelector<HTMLElement>('#ternos-editor-volume-total')!;
const ternosEditorVolumeTarget = document.querySelector<HTMLElement>('#ternos-editor-volume-target')!;
const ternosEditorTernosTotal = document.querySelector<HTMLElement>('#ternos-editor-ternos-total')!;
const ternosEditorTernosTarget = document.querySelector<HTMLElement>('#ternos-editor-ternos-target')!;
let currentResult: ResultadoDeSimulacao | undefined;
let customCostCounter = 0;
let draftDistribution: readonly number[] = [];
let draftProductivities: readonly number[] = [];
let fainaOptionIndex = -1;
let catalogSourceFilter: 'TODAS' | 'ACT' | 'CCT' = 'TODAS';
const SAVED_BUDGETS_KEY = 'sco-orcamentos-salvos';

interface OrcamentoSalvo {
  readonly id: string;
  readonly cliente: string;
  readonly criadoEm: string;
  readonly resultado: ResultadoDeSimulacao;
}

interface PontoDeSensibilidade {
  readonly produtividade: number;
  readonly custoPorTonelada: number;
  readonly periodos: number;
  readonly ehCenarioAtual?: boolean;
}

interface AnaliseDeSensibilidade {
  readonly pontos: readonly PontoDeSensibilidade[];
  readonly otimizacao: ResultadoDeOtimizacao;
}

/** Série de referência da aba “Gráficos” da planilha legada de fertilizantes. */
const CURVA_OTIMO_FERTILIZANTES: readonly [number, number][] = [
  [500, 34.05], [525, 32.45], [550, 30.8], [575, 29.46], [600, 29.46],
  [625, 28.11], [650, 26.92], [675, 27.35], [700, 26.32], [725, 26.7],
  [750, 26.21], [775, 26.57], [800, 26.94], [825, 26.61], [850, 26.95],
  [875, 27.29], [900, 26.62], [925, 26.93], [950, 27.25], [975, 26.47],
  [1000, 26.76], [1025, 27.05], [1050, 27.34], [1075, 27.63], [1100, 26.99],
  [1125, 27.26], [1150, 27.53], [1175, 27.79], [1200, 28.06], [1225, 27.31],
  [1250, 27.55], [1275, 27.8], [1300, 28.04], [1325, 28.29], [1350, 28.54],
  [1375, 28.78], [1400, 27.46], [1425, 27.68], [1450, 27.9], [1475, 28.11],
  [1500, 28.33], [1525, 28.55], [1550, 28.77], [1575, 28.99], [1600, 29.21],
  [1625, 27.59], [1650, 27.78], [1675, 27.97], [1700, 28.16], [1725, 28.35],
  [1750, 28.54], [1775, 28.73], [1800, 28.92],
];

const fainasSelecionaveis = catalogoPortmac.listarFainas()
  .filter((faina) => faina.status !== 'PENDENTE_DE_VALIDACAO');

const optionalCostLabels: Record<TipoDeCustoOpcional, string> = {
  MATERIAL_DE_PEACAO: 'Material de peação',
  MADEIRA: 'Madeira',
  LOCACAO_DE_MAQUINA: 'Locação de máquina',
  MATERIAL_DE_ICAMENTO: 'Material de içamento',
  OUTRO: 'Outro custo',
};

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
  if (route === 'catalogo') renderCatalogPage();
  if (route === 'clientes') renderClientsPage();
  document.title = route === 'nova-simulacao'
    ? 'SCO · Nova simulação'
    : route === 'clientes' ? 'SCO · Clientes cadastrados' : 'SCO · Catálogo de fainas';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCatalogPage(): void {
  const registros = catalogoPortmac.listarRegistros();
  const tableBody = document.querySelector<HTMLTableSectionElement>('#catalog-table-body')!;
  const actCount = registros.filter((registro) => registro.fonte === 'ACT').length;
  const cctCount = registros.filter((registro) => registro.fonte === 'CCT').length;
  const termo = normalizarBusca(catalogSearchInput.value);
  const filtrados = registros.filter((registro) => {
    if (catalogSourceFilter !== 'TODAS' && registro.fonte !== catalogSourceFilter) return false;
    if (!termo) return true;
    return normalizarBusca([
      registro.descricao,
      registro.codigo,
      registro.codigoDaTabela,
      registro.grupoDaTabela,
      registro.tipoDeCarga,
      registro.referencia,
    ].filter(Boolean).join(' ')).includes(termo);
  });

  setText('#catalog-count', String(registros.length));
  setText('#catalog-act-count', String(actCount));
  setText('#catalog-cct-count', String(cctCount));
  setText('#catalog-visible-count', `${filtrados.length} ${filtrados.length === 1 ? 'faina encontrada' : 'fainas encontradas'}`);
  tableBody.innerHTML = filtrados.length ? filtrados.map((registro) => {
    const regra = registro.regra;
    const regraCct = registro.regraCctProvisoria;
    const regraAct = registro.regraActProvisoria;
    const regraPlanilha = regraAct ?? regraCct;
    const status = registro.status === 'PENDENTE_DE_VALIDACAO' || (!regra && !regraPlanilha)
      ? '<span class="pending-pill">Pendente</span><small>aguarda validação</small>'
      : registro.status === 'PROVISORIA'
        ? '<span class="pending-pill">Provisória</span><small>aguarda documento oficial</small>'
      : `<span class="ready-pill">Disponível</span><small>regra habilitada</small>`;
    const detailsId = `catalog-details-${registro.codigo}`;
    return `
    <tr>
      <td>
        <strong>${escapeHtml(registro.descricao)}</strong>
        <small>${escapeHtml(registro.tipoDeCarga)} · código ${escapeHtml(registro.codigoDaTabela ?? registro.codigo)}</small>
        <button class="catalog-details-button" type="button" aria-expanded="false" aria-controls="${detailsId}" data-catalog-details="${detailsId}"><span aria-hidden="true">+</span> Detalhes</button>
      </td>
      <td><span class="catalog-group">${escapeHtml(registro.grupoDaTabela ?? 'Catálogo ACT')}</span><small>${escapeHtml(registro.vigencia)}</small></td>
      <td><span class="source-pill source-${registro.fonte.toLowerCase()}">${registro.fonte}</span>${status}</td>
      <td><span class="rule-value">${escapeHtml(registro.unidade)}</span><small>unidade da tabela</small></td>
      <td>${regra ? `<span class="rule-value">${money(regra.taxaEstivaPorTonelada)}</span><small>estiva / ton / cota · ${number(regra.cotasEstivaPorTerno)} cotas/terno · conferentes ${money(regra.taxaConferentesPorTonelada)} / ton</small>` : regraPlanilha ? `<span class="rule-value">${money(regraPlanilha.taxaBase)}</span><small>${regraPlanilha.baseDeCalculo === 'TARIFA_UNITARIA' ? 'tarifa unitária; não multiplicada por cotas' : 'cotas da equipe'} · ${regraPlanilha.regime === 'PRODUCAO' ? 'produção' : 'salário-dia'} · +${number(regraPlanilha.encargosContribuicaoAdicional * 100)}% encargos</small>` : '<span class="pending-rule">Regra não habilitada</span><small>transcrição documental</small>'}</td>
    </tr>
    <tr id="${detailsId}" class="catalog-details-row" hidden>
      <td colspan="5">${regraPlanilha ? renderCatalogMethod(registro, regraPlanilha) : '<div class="catalog-method-body"><p>Esta faina ainda não possui uma regra de custo habilitada.</p></div>'}</td>
    </tr>
  `;
  }).join('') : '<tr><td colspan="5" class="catalog-empty-result">Nenhuma faina corresponde aos filtros atuais.</td></tr>';
}

function renderClientsPage(): void {
  const list = document.querySelector<HTMLDivElement>('#client-budget-list');
  const empty = document.querySelector<HTMLElement>('#clients-empty');
  if (!list || !empty) return;
  const budgets = readSavedBudgets();
  empty.hidden = budgets.length > 0;
  list.hidden = budgets.length === 0;
  list.innerHTML = budgets.map((budget) => {
    const faina = catalogoPortmac.obterFaina(budget.resultado.entrada.faina);
    const unidade = unidadeDaFaina(faina?.unidade);
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

function renderSavedBudgetDetails(resultado: ResultadoDeSimulacao, faina?: ReturnType<typeof catalogoPortmac.obterFaina>): string {
  const unidade = unidadeDaFaina(faina?.unidade);
  const entrada = resultado.entrada;
  return `<div class="saved-scenario-details">
    <div class="saved-scenario-section">
      <span class="saved-scenario-caption">Dados da operação</span>
      <div class="saved-scenario-grid">
        <div><span>Faina</span><strong>${escapeHtml(faina?.descricao ?? entrada.faina)}</strong></div>
        <div><span>Início</span><strong>${formatarDataPtBr(entrada.inicio.data)} · ${escapeHtml(entrada.inicio.periodo)}</strong></div>
        <div><span>Quantidade</span><strong>${number(entrada.volumeToneladas)} ${unidade.abreviacao}</strong></div>
        <div><span>Produtividade-base</span><strong>${number(entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/período</strong></div>
        <div><span>Períodos calculados</span><strong>${number(resultado.quantidadeDePeriodos)}</strong></div>
        <div><span>Ternos por período</span><strong>${number(entrada.ternosPorPeriodoPadrao ?? (resultado.quantidadeDePeriodos ? entrada.totalDeTernos / resultado.quantidadeDePeriodos : 0))}</strong></div>
        <div><span>Total de ternos calculado</span><strong>${number(entrada.totalDeTernos)}</strong></div>
      </div>
    </div>
    <div class="saved-scenario-section">
      <span class="saved-scenario-caption">Composição por período</span>
      <div class="saved-period-table-wrap"><table class="saved-period-table"><thead><tr><th>Data</th><th>Período</th><th>Produção</th><th>Ternos</th><th>Majoração</th><th>Custo</th></tr></thead><tbody>
        ${resultado.periodos.map((periodo) => `<tr><td>${formatarDataPtBr(periodo.periodo.data)}</td><td>${escapeHtml(periodo.periodo.identificador)}</td><td>${number(periodo.producaoToneladas)} ${unidade.abreviacao}</td><td>${number(periodo.ternos)}</td><td>${escapeHtml(periodo.custo.majoracao?.descricao ?? 'preço normal')}</td><td>${money(periodo.custo.total)}</td></tr>`).join('')}
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
        const label = custo.tipo === 'OUTRO' ? custo.descricao?.trim() || optionalCostLabels.OUTRO : optionalCostLabels[custo.tipo];
        return `<div><span>${escapeHtml(label)}</span><strong>${money(custo.custoTotal)}</strong></div>`;
      }).join('')}
    </div>` : ''}
    <div class="saved-scenario-section saved-scenario-costs">
      <span class="saved-scenario-caption">Resumo financeiro</span>
      ${resultado.memoria.map((linha) => `<div><span>${escapeHtml(linha.descricao)}</span><strong>${money(linha.valor)}</strong></div>`).join('')}
    </div>
  </div>`;
}

function renderCatalogMethod(
  registro: ReturnType<typeof catalogoPortmac.listarRegistros>[number],
  regra: NonNullable<ReturnType<typeof catalogoPortmac.listarRegistros>[number]['regraActProvisoria'] | ReturnType<typeof catalogoPortmac.listarRegistros>[number]['regraCctProvisoria']>,
): string {
  const fator = regra.baseDeCalculo === 'TARIFA_UNITARIA' ? '1 tarifa unitária' : 'cotas da equipe';
  const formula = regra.baseDeCalculo === 'TARIFA_UNITARIA'
    ? 'tarifa-base × produção do período × encargos × majoração × ternos'
    : 'cotas × tarifa-base × produção do período × encargos × majoração × ternos';
  const composition = regra.composicao.map((item) =>
    `<li>${escapeHtml(item.categoria)}: ${item.homens} homens · ${number(item.cotas)} cotas${item.funcoes.length ? ` · ${escapeHtml(item.funcoes.join(', '))}` : ''}</li>`,
  ).join('');
  return `<div class="catalog-method-body">
    <div class="catalog-reference-detail"><span>Referência documental</span><small>${escapeHtml(registro.referencia)}</small></div>
    <p><strong>Fórmula aplicada</strong><br><code>${formula}</code></p>
    <div class="catalog-method-grid">
      <div><span>Base monetária</span><strong>${money(regra.taxaBase)}</strong></div>
      <div><span>Unidade</span><strong>${escapeHtml(regra.unidade)}</strong></div>
      <div><span>Regime</span><strong>${regra.regime === 'PRODUCAO' ? 'produção' : 'salário-dia'}</strong></div>
      <div><span>Tratamento da equipe</span><strong>${fator}</strong></div>
      <div><span>Encargos</span><strong>+${number(regra.encargosContribuicaoAdicional * 100)}%</strong></div>
      <div><span>Fonte</span><strong>${escapeHtml(registro.fonte)} · ${escapeHtml(registro.codigoDaTabela ?? registro.codigo)}</strong></div>
    </div>
    <p class="catalog-method-note">${regra.baseDeCalculo === 'TARIFA_UNITARIA' ? 'A tarifa já representa o valor por unidade produzida. A composição abaixo é informativa e não multiplica o custo.' : 'A taxa é distribuída pelas cotas da composição e multiplicada pela quantidade de ternos.'}</p>
    <ul>${composition}</ul>
  </div>`;
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
catalogSearchInput.addEventListener('input', renderCatalogPage);
catalogFilterButtons.forEach((button) => button.addEventListener('click', () => {
  catalogSourceFilter = button.dataset.catalogSource as 'TODAS' | 'ACT' | 'CCT';
  catalogFilterButtons.forEach((filter) => {
    const active = filter === button;
    filter.classList.toggle('active', active);
    filter.setAttribute('aria-pressed', String(active));
  });
  renderCatalogPage();
}));
fainaInput.addEventListener('input', handleFainaInput);
fainaInput.addEventListener('focus', () => openFainaOptions());
fainaInput.addEventListener('keydown', handleFainaKeydown);
document.addEventListener('click', (event) => {
  if (!(event.target instanceof Node) || !fainaInput.closest('.combobox')?.contains(event.target)) closeFainaOptions();
});
document.querySelector<HTMLButtonElement>('#save-budget')?.addEventListener('click', saveCurrentBudget);
document.addEventListener('click', (event) => {
  const button = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>('[data-print-budget]') : null;
  if (button) printSavedBudget(button.dataset.printBudget);
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
  const unidade = unidadeDaFaina(faina?.unidade);
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
  setText('#calculation-summary', produtividadeCustomizada
    ? `${number(resultado.entrada.volumeToneladas)} ${unidade.abreviacao} ÷ produtividade ajustada por período = ${resultado.quantidadeDePeriodos} períodos · calendário de Vila Velha aplicado`
    : `${number(resultado.entrada.volumeToneladas)} ${unidade.abreviacao} ÷ ${number(resultado.entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/período = ${resultado.quantidadeDePeriodos} períodos · calendário de Vila Velha aplicado`);
  renderCalculationMemory(resultado);
  renderPeriodCostChart(resultado);
  renderProductivitySensitivity(resultado);
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

function renderPeriodCostChart(resultado: ResultadoDeSimulacao): void {
  const container = document.querySelector<HTMLDivElement>('#period-cost-chart-body');
  const summary = document.querySelector<HTMLElement>('#period-cost-chart-summary');
  if (!container || !summary) return;
  const custos = resultado.periodos.map((periodo) => periodo.custo.total);
  const maiorCusto = Math.max(...custos, 0);
  const media = custos.length ? custos.reduce((total, custo) => total + custo, 0) / custos.length : 0;
  summary.textContent = `${resultado.periodos.length} períodos · média ${money(media)}`;
  container.setAttribute('role', 'img');
  container.setAttribute('aria-label', `Gráfico de custo por período. Maior custo: ${money(maiorCusto)}. Média: ${money(media)}.`);
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
  const barWidth = Math.max(6, Math.min(34, barSlot * .58));
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
  container.innerHTML = `<svg class="period-cost-chart-svg" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
    <text class="chart-axis-title chart-axis-title-y" x="24" y="${top + plotHeight / 2}" transform="rotate(-90 24 ${top + plotHeight / 2})">Custo (R$)</text>
    ${grid}
    <line class="chart-axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" />
    <line class="chart-axis" x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" />
    ${bars}
    <text class="chart-axis-title chart-axis-title-x" x="${left + plotWidth / 2}" y="${height - 12}">Períodos</text>
  </svg>`;
}

function formatarValorEixo(value: number): string {
  if (value >= 1000) return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(value).toLocaleString('pt-BR')}`;
}

function obterAnaliseDeSensibilidade(resultado: ResultadoDeSimulacao): AnaliseDeSensibilidade {
  const faina = catalogoPortmac.obterFaina(resultado.entrada.faina);
  const baseEntrada: EntradaDeSimulacao = {
    ...(resultado.entrada.cliente ? { cliente: resultado.entrada.cliente } : {}),
    ...(resultado.entrada.custosOpcionais?.length ? { custosOpcionais: resultado.entrada.custosOpcionais } : {}),
    faina: resultado.entrada.faina,
    inicio: resultado.entrada.inicio,
    volumeToneladas: resultado.entrada.volumeToneladas,
    produtividadeToneladasPorPeriodo: resultado.entrada.produtividadeToneladasPorPeriodo,
    ...(resultado.entrada.ternosPorPeriodoPadrao ? { ternosPorPeriodoPadrao: resultado.entrada.ternosPorPeriodoPadrao } : {}),
    totalDeTernos: resultado.entrada.totalDeTernos,
  };
  const produtividades = faina?.unidade === 'TON'
    ? CURVA_OTIMO_FERTILIZANTES.map(([produtividade]) => produtividade)
    : gerarGradePorPeriodos(baseEntrada);
  const otimizacao = otimizarCenario(baseEntrada, catalogoPortmac, calendarioOperacional, produtividades);
  const pontos = otimizacao.candidatos.map((candidato) => ({
    produtividade: candidato.produtividade,
    custoPorTonelada: candidato.resultado.custoPorTonelada,
    periodos: candidato.periodos,
  }));
  const produtividadeBase = baseEntrada.produtividadeToneladasPorPeriodo;
  const candidatoAtual = produtividadeBase > 0 && pontos.some((ponto) => ponto.produtividade === produtividadeBase)
    ? undefined
    : {
      produtividade: produtividadeBase,
      custoPorTonelada: resultado.custoPorTonelada,
      periodos: resultado.quantidadeDePeriodos,
      ehCenarioAtual: true,
    };
  return {
    pontos: candidatoAtual ? [...pontos, candidatoAtual].sort((a, b) => a.produtividade - b.produtividade) : pontos,
    otimizacao,
  };
}

function gerarGradePorPeriodos(entrada: EntradaDeSimulacao): readonly number[] {
  // Para unidades sem uma faixa documental de produtividade, a grade de
  // períodos é fixa. Ela não pode ser derivada do cenário-base.
  const periodoMinimo = 1;
  const periodoMaximo = 36;
  return Array.from({ length: periodoMaximo - periodoMinimo + 1 }, (_, indice) => {
    const periodos = periodoMinimo + indice;
    return Number((entrada.volumeToneladas / periodos).toFixed(2));
  });
}

function renderProductivitySensitivity(resultado: ResultadoDeSimulacao): void {
  const container = document.querySelector<HTMLDivElement>('#productivity-sensitivity-body');
  const summary = document.querySelector<HTMLElement>('#productivity-sensitivity-summary');
  if (!container) return;
  const analise = obterAnaliseDeSensibilidade(resultado);
  const pontos = analise.pontos;
  const base = resultado.entrada.produtividadeToneladasPorPeriodo;
  const pontosDoGrafico = pontos.filter((ponto) => !ponto.ehCenarioAtual);
  const produtividades = pontosDoGrafico.map((ponto) => ponto.produtividade);
  const unidade = unidadeDaFaina(catalogoPortmac.obterFaina(resultado.entrada.faina)?.unidade);
  const pontoOtimo = analise.otimizacao.melhor;
  if (!pontosDoGrafico.length || !pontoOtimo) {
    if (summary) summary.textContent = 'ótimo indisponível';
    container.innerHTML = '<p class="sensitivity-empty">Não foi possível gerar cenários comparativos para esta operação.</p>';
    return;
  }
  if (summary) {
    const ternosPorPeriodo = resultado.entrada.ternosPorPeriodoPadrao
      ?? (resultado.quantidadeDePeriodos ? resultado.entrada.totalDeTernos / resultado.quantidadeDePeriodos : 0);
    summary.textContent = `Ótimo calculado: ${number(pontoOtimo.produtividade)} ${unidade.abreviacao}/período · ${number(pontoOtimo.periodos)} períodos · ${number(ternosPorPeriodo)} terno(s)/período · ${money(pontoOtimo.resultado.custoPorTonelada)} por ${unidade.singular}`;
  }
  const custos = pontosDoGrafico.map((ponto) => ponto.custoPorTonelada);
  const menorCusto = Math.min(...custos);
  const maiorCusto = Math.max(...custos);
  const custoBase = pontos.find((ponto) => ponto.produtividade === base)?.custoPorTonelada ?? resultado.custoPorTonelada;
  const amplitude = Math.max(maiorCusto - menorCusto, custoBase * .12, 1);
  const yMin = Math.max(0, menorCusto - amplitude * .16);
  const yMax = maiorCusto + amplitude * .16;
  const width = 860;
  const height = 340;
  const left = 120;
  const right = 24;
  const top = 24;
  const bottom = 72;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = (value: number) => left + (produtividades.length > 1 ? (value - produtividades[0]!) / (produtividades[produtividades.length - 1]! - produtividades[0]!) : .5) * plotWidth;
  const y = (value: number) => top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;
  const labelEvery = pontosDoGrafico.length > 18 ? Math.ceil(pontosDoGrafico.length / 8) : 1;
  const pontosDaTabela = pontos.filter((ponto, indice) => indice % 4 === 0 || ponto.produtividade === base || ponto.produtividade === pontoOtimo.produtividade);
  const grid = Array.from({ length: 5 }, (_, indice) => {
    const value = yMin + ((yMax - yMin) / 4) * indice;
    const lineY = y(value);
    return `<line class="chart-grid-line" x1="${left}" y1="${lineY.toFixed(2)}" x2="${width - right}" y2="${lineY.toFixed(2)}" />
      <text class="chart-axis-label chart-axis-label-y" x="${left - 12}" y="${(lineY + 4).toFixed(2)}">${escapeHtml(formatarValorEixo(value))}</text>`;
  }).join('');
  const line = pontosDoGrafico.map((ponto, indice) => `${indice === 0 ? 'M' : 'L'} ${x(ponto.produtividade).toFixed(2)} ${y(ponto.custoPorTonelada).toFixed(2)}`).join(' ');
  const optimalGuide = `<line class="sensitivity-optimal-guide" x1="${x(pontoOtimo.produtividade).toFixed(2)}" y1="${top}" x2="${x(pontoOtimo.produtividade).toFixed(2)}" y2="${top + plotHeight}" /><text class="sensitivity-optimal-guide-label" x="${x(pontoOtimo.produtividade).toFixed(2)}" y="${top - 7}">ótimo</text>`;
  const points = pontosDoGrafico.map((ponto, indice) => `<circle class="sensitivity-point${ponto.produtividade === pontoOtimo.produtividade ? ' is-optimal' : ''}" cx="${x(ponto.produtividade).toFixed(2)}" cy="${y(ponto.custoPorTonelada).toFixed(2)}" r="6"><title>${number(ponto.produtividade)} / período · ${number(ponto.periodos)} períodos · ${money(ponto.custoPorTonelada)} por ${unidade.singular}</title></circle>
    <text class="chart-axis-label chart-axis-label-x" x="${x(ponto.produtividade).toFixed(2)}" y="${height - bottom + 24}">${indice % labelEvery === 0 ? escapeHtml(number(ponto.produtividade)) : ''}</text>`).join('');
  container.setAttribute('role', 'img');
  container.setAttribute('aria-label', `Análise de sensibilidade. O custo por ${unidade.singular} varia de ${money(menorCusto)} a ${money(maiorCusto)}. O ótimo estimado é ${number(pontoOtimo.produtividade)} ${unidade.abreviacao} por período.`);
  container.innerHTML = `<svg class="period-cost-chart-svg sensitivity-chart-svg" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">
    <text class="chart-axis-title chart-axis-title-y" x="24" y="${top + plotHeight / 2}" transform="rotate(-90 24 ${top + plotHeight / 2})">Custo por ${escapeHtml(unidade.singular)} (R$)</text>
    ${grid}
    <line class="chart-axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" />
    <line class="chart-axis" x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" />
    ${optimalGuide}
    <path class="sensitivity-line" d="${line}" />
    ${points}
    <text class="chart-axis-title chart-axis-title-x" x="${left + plotWidth / 2}" y="${height - 12}">Produtividade / período</text>
  </svg>
  <div class="sensitivity-table-wrap"><table class="sensitivity-table"><thead><tr><th>Produtividade / período</th><th>Períodos</th><th>Custo por ${escapeHtml(unidade.singular)}</th></tr></thead><tbody>
    ${pontosDaTabela.map((ponto) => `<tr class="${ponto.produtividade === base ? 'is-base' : ''}${ponto.produtividade === pontoOtimo.produtividade ? ' is-optimal' : ''}"><td>${number(ponto.produtividade)}${ponto.produtividade === base ? ' <span class="sensitivity-base-label">base</span>' : ''}${ponto.produtividade === pontoOtimo.produtividade ? ' <span class="sensitivity-optimal-label">ótimo</span>' : ''}</td><td>${number(ponto.periodos)}</td><td>${money(ponto.custoPorTonelada)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function saveCurrentBudget(): void {
  if (!currentResult) return;
  const cliente = currentResult.entrada.cliente?.trim();
  const saveHint = document.querySelector<HTMLElement>('#save-budget-hint');
  if (!cliente) {
    showError('Informe o cliente nos dados da operação antes de salvar o orçamento.');
    saveHint?.replaceChildren(document.createTextNode('Informe o cliente nos dados da operação para salvar'));
    return;
  }
  const budgets = readSavedBudgets();
  budgets.unshift({
    id: `orcamento-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    cliente,
    criadoEm: new Date().toISOString(),
    resultado: currentResult,
  });
  localStorage.setItem(SAVED_BUDGETS_KEY, JSON.stringify(budgets));
  if (saveHint) saveHint.textContent = 'Orçamento salvo no cadastro do cliente';
  const button = document.querySelector<HTMLButtonElement>('#save-budget');
  if (button) {
    button.textContent = 'Orçamento salvo';
    button.disabled = true;
  }
}

function readSavedBudgets(): OrcamentoSalvo[] {
  try {
    const stored = JSON.parse(localStorage.getItem(SAVED_BUDGETS_KEY) ?? '[]') as unknown;
    return Array.isArray(stored) ? stored.filter(isOrcamentoSalvo) : [];
  } catch {
    return [];
  }
}

function printSavedBudget(id?: string): void {
  if (!id) return;
  const budget = readSavedBudgets().find((item) => item.id === id);
  if (!budget) return;
  const faina = catalogoPortmac.obterFaina(budget.resultado.entrada.faina);
  const unidade = unidadeDaFaina(faina?.unidade);
  const analise = obterAnaliseDeSensibilidade(budget.resultado);
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
    <div><span>Produtividade-base</span><strong>${number(budget.resultado.entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/período</strong></div>
    <div><span>Períodos</span><strong>${number(budget.resultado.quantidadeDePeriodos)}</strong></div>
    <div><span>Ternos por período</span><strong>${number(budget.resultado.entrada.ternosPorPeriodoPadrao ?? (budget.resultado.quantidadeDePeriodos ? budget.resultado.entrada.totalDeTernos / budget.resultado.quantidadeDePeriodos : 0))}</strong></div>
    <div><span>Total de ternos</span><strong>${number(budget.resultado.entrada.totalDeTernos)}</strong></div>
    <div><span>Custo total</span><strong>${money(budget.resultado.custoTotal)}</strong></div>
  </div></section>
  <section class="print-report-section"><h2>Composição por período</h2><div class="saved-period-table-wrap"><table class="saved-period-table"><thead><tr><th>Data</th><th>Período</th><th>Produção</th><th>Ternos</th><th>Majoração</th><th>Custo</th></tr></thead><tbody>
    ${budget.resultado.periodos.map((periodo) => `<tr><td>${formatarDataPtBr(periodo.periodo.data)}</td><td>${escapeHtml(periodo.periodo.identificador)}</td><td>${number(periodo.producaoToneladas)} ${unidade.abreviacao}</td><td>${number(periodo.ternos)}</td><td>${escapeHtml(periodo.custo.majoracao?.descricao ?? 'preço normal')}</td><td>${money(periodo.custo.total)}</td></tr>`).join('')}
  </tbody></table></div></section>
  <section class="print-report-section"><h2>Sensibilidade à produtividade</h2><p class="print-report-note">Comparação do custo por ${escapeHtml(unidade.singular)} em cenários automáticos de produtividade${pontoOtimo ? ` · ótimo calculado em ${number(pontoOtimo.produtividade)} ${unidade.abreviacao}/período, com ${number(pontoOtimo.periodos)} períodos` : ''}.</p><div class="print-memory">${sensibilidade.map((ponto) => `<div><span>${number(ponto.produtividade)} ${unidade.abreviacao}/período · ${number(ponto.periodos)} períodos${ponto.produtividade === produtividadeBase ? ' · base' : ''}${pontoOtimo && ponto.produtividade === pontoOtimo.produtividade ? ' · ótimo' : ''}</span><strong>${money(ponto.custoPorTonelada)}</strong></div>`).join('')}</div></section>
  <section class="print-report-section"><h2>Memória por período</h2><div class="print-period-memory">
    ${budget.resultado.periodos.map((periodo) => `<div class="print-period-memory-block"><h3>${formatarDataPtBr(periodo.periodo.data)} · ${escapeHtml(periodo.periodo.identificador)} · ${money(periodo.custo.total)}</h3>${periodo.custo.memoria.map((linha) => `<div><span>${escapeHtml(linha.descricao)}</span><strong>${money(linha.valor)}</strong></div>`).join('')}</div>`).join('')}
  </div></section>
  ${budget.resultado.custosOpcionais.length ? `<section class="print-report-section"><h2>Custos opcionais</h2><div class="print-memory">${budget.resultado.custosOpcionais.map((custo) => {
    const label = custo.tipo === 'OUTRO' ? custo.descricao?.trim() || optionalCostLabels.OUTRO : optionalCostLabels[custo.tipo];
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

function isOrcamentoSalvo(value: unknown): value is OrcamentoSalvo {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string'
    && typeof record.cliente === 'string'
    && typeof record.criadoEm === 'string'
    && typeof record.resultado === 'object'
    && record.resultado !== null;
}

function formatarDataHora(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function applyPeriodDetails(): void {
  const ternos = Array.from(ternosEditorBody.querySelectorAll<HTMLInputElement>('.ternos-input')).map((input) => Number(input.value));
  const produtividades = Array.from(ternosEditorBody.querySelectorAll<HTMLInputElement>('.productivity-period-input')).map((input) => Number(input.value));
  const totalTernos = ternos.reduce((sum, value) => sum + value, 0);
  const volume = numberOf('#volume');
  const totalTernosEsperado = totalTernosCalculado();
  draftDistribution = ternos;
  draftProductivities = produtividades;
  renderDistributionTotals(produtividades, ternos);
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
  const totalProdutividade = produtividades.reduce((sum, value) => sum + value, 0);
  if (!quaseIgual(totalProdutividade, volume)) {
    showDistributionError(`O volume distribuído é ${number(totalProdutividade)}; ele precisa ser exatamente ${number(volume)}.`);
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
    draftDistribution = distribuirTernosLocal(totalTernos, periodos.length);
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
    || !quaseIgual(draftProductivities.reduce((soma, produtividade) => soma + produtividade, 0), volume)
  ) {
    draftProductivities = distribuirProdutividadeLocal(volume, periodos.length);
  }

  const totalTernosLabel = Number.isFinite(totalTernos)
    ? `${number(totalTernos)} ${totalTernos === 1 ? 'terno' : 'ternos'}`
    : 'total de ternos pendente';
  setText('#ternos-editor-count', `${periodos.length} ${periodos.length === 1 ? 'período' : 'períodos'} · ${totalTernosLabel}`);
  renderDistributionTotals(draftProductivities, draftDistribution);
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
  const faina = catalogoPortmac.obterFaina(fainaCodeInput.value);
  const unidade = unidadeDaFaina(faina?.unidade);
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
            <span>${unidade.abreviacao} / período</span>
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
  if (volume <= 0 || produtividade <= 0) return [];
  const quantidade = Math.ceil(volume / produtividade);
  const [ano, mes, dia] = dateInput.value.split('-').map(Number);
  if (!ano || !mes || !dia) return [];
  try {
    return calendarioOperacional.projetar({ data: data(ano, mes, dia), periodo: periodInput.value }, quantidade);
  } catch {
    return [];
  }
}

function distribuirTernosLocal(total: number, periodos: number): readonly number[] {
  if (periodos <= 0 || !Number.isFinite(total)) return [];
  const base = Math.floor(total / periodos);
  const sobras = total % periodos;
  return Array.from({ length: periodos }, (_, indice) => base + (indice >= periodos - sobras ? 1 : 0));
}

function distribuirProdutividadeLocal(total: number, periodos: number): readonly number[] {
  if (periodos <= 0 || !Number.isFinite(total) || total <= 0) return [];
  if (periodos === 1) return [total];
  const base = Math.round((total / periodos) * 100) / 100;
  const distribuicao = Array.from({ length: periodos }, () => base);
  distribuicao[periodos - 1] = Math.round((total - base * (periodos - 1)) * 100) / 100;
  return distribuicao;
}

function quaseIgual(a: number, b: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 0.0001;
}

function renderDistributionTotals(
  produtividades: readonly number[],
  ternos: readonly number[],
  abreviacao?: string,
): void {
  const volume = numberOf('#volume');
  const totalVolume = produtividades.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const totalTernos = ternos.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const totalTernosEsperado = totalTernosCalculado();
  const unidade = abreviacao ?? unidadeDaFaina(catalogoPortmac.obterFaina(fainaCodeInput.value)?.unidade).abreviacao;
  ternosEditorVolumeTotal.textContent = `${number(totalVolume)} ${unidade}`;
  ternosEditorVolumeTarget.textContent = `${number(volume)} ${unidade}`;
  ternosEditorTernosTotal.textContent = number(totalTernos);
  ternosEditorTernosTarget.textContent = Number.isFinite(totalTernosEsperado) ? number(totalTernosEsperado) : '—';
  ternosEditorVolumeTotal.parentElement?.classList.toggle('is-valid', quaseIgual(totalVolume, volume));
  ternosEditorTernosTotal.parentElement?.classList.toggle('is-valid', totalTernos === totalTernosEsperado);
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
  lines.innerHTML = resultado.custosOpcionais.length
    ? resultado.custosOpcionais.map((custo) => {
      const label = custo.tipo === 'OUTRO' ? custo.descricao?.trim() || optionalCostLabels.OUTRO : optionalCostLabels[custo.tipo];
      return `
        <div class="cost-line cost-line-optional">
          <div><span>${escapeHtml(label)}</span><small>${money(custo.custoPorTonelada)} / ${unidadeDaFaina(catalogoPortmac.obterFaina(resultado.entrada.faina)?.unidade).abreviacao}</small></div>
          <strong>${money(custo.custoTotal)}</strong>
        </div>
      `;
    }).join('')
    : '<p class="no-optional-costs">Nenhum custo opcional ativado.</p>';
}

function renderCalculationMemory(resultado: ResultadoDeSimulacao): void {
  const container = document.querySelector<HTMLDivElement>('#calculation-memory-lines')!;
  const unidade = unidadeDaFaina(catalogoPortmac.obterFaina(resultado.entrada.faina)?.unidade);
  const summary = resultado.memoria.map((linha, indice) => `
    <div class="memory-line">
      <span>${escapeHtml(linha.descricao)}</span>
      <strong>${indice < 4 ? number(linha.valor) : money(linha.valor)}</strong>
    </div>
  `).join('');
  const periods = resultado.periodos.map((periodo) => `
    <details class="memory-period">
      <summary>${formatarDataPtBr(periodo.periodo.data)} · ${escapeHtml(periodo.periodo.identificador)} · produtividade ${number(periodo.producaoToneladas)} ${unidade.abreviacao} · ${money(periodo.custo.total)}</summary>
      <div class="memory-period-lines">
        <div class="memory-line">
          <span>Produtividade do período</span>
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

function showDistributionError(message: string): void {
  ternosEditorStatus.textContent = message;
  ternosEditorStatus.hidden = false;
}

function updateCalculatedPeriods(): void {
  const volume = Number(volumeInput.value);
  const productivity = Number(productivityInput.value);
  const periods = volume > 0 && productivity > 0 ? Math.ceil(volume / productivity) : undefined;
  setText('#calculated-periods', periods === undefined ? '—' : String(periods));
  const totalTernos = periods === undefined ? Number.NaN : periods * Number(ternosPorPeriodoInput.value);
  setText('#total-ternos', Number.isInteger(totalTernos) && totalTernos > 0 ? number(totalTernos) : '—');
}

function totalTernosCalculado(): number {
  const volume = Number(volumeInput.value);
  const produtividade = Number(productivityInput.value);
  const ternosPorPeriodo = Number(ternosPorPeriodoInput.value);
  if (volume <= 0 || produtividade <= 0 || !Number.isInteger(ternosPorPeriodo) || ternosPorPeriodo < 1 || ternosPorPeriodo > 4) {
    return Number.NaN;
  }
  return Math.ceil(volume / produtividade) * ternosPorPeriodo;
}

function valueOf<T extends HTMLInputElement | HTMLSelectElement>(selector: string): string {
  return document.querySelector<T>(selector)!.value;
}

function numberOf(selector: string): number { return Number(valueOf<HTMLInputElement>(selector)); }
function setText(selector: string, value: string): void { document.querySelector<HTMLElement>(selector)!.textContent = value; }
function number(value: number): string { return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value); }
function money(value: number): string { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function normalizarBusca(value: string | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function unidadeDaFaina(unidade?: string): { singular: string; abreviacao: string } {
  switch (unidade) {
    case 'UNIDADE': return { singular: 'unidade', abreviacao: 'unid.' };
    case 'CONTAINER': return { singular: 'container', abreviacao: 'contêiner(es)' };
    case 'EQUIPE': return { singular: 'equipe', abreviacao: 'equipe(s)' };
    case 'VOLUME': return { singular: 'volume', abreviacao: 'volume(s)' };
    default: return { singular: 'tonelada', abreviacao: 'ton' };
  }
}
function updateOperationUnitLabels(): void {
  const faina = catalogoPortmac.obterFaina(fainaCodeInput.value);
  const unidade = unidadeDaFaina(faina?.unidade);
  const nome = unidade.abreviacao === 'TON' ? 'Volume do navio' : 'Quantidade do navio';
  document.querySelector<HTMLElement>('#volume-field-label')!.innerHTML = `${nome} <b>${unidade.abreviacao}</b>`;
  document.querySelector<HTMLElement>('#productivity-field-label')!.innerHTML = `Capacidade <b>${unidade.abreviacao} / período</b>`;
}
function clearError(): void { errorBox.hidden = true; errorBox.textContent = ''; }
function showError(message: string): void { errorBox.textContent = message; errorBox.hidden = false; }
