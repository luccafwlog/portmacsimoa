import './styles.css';
import { data, formatarDataPtBr } from './dominio/tempo.js';
import { calendarioOperacional } from './calendario/operacional.js';
import { catalogoPortmac } from './catalogo/portmac.js';
import type { CustoOpcional, EntradaDeSimulacao, PeriodoOgmo, ResultadoDeSimulacao, TipoDeCustoOpcional } from './dominio/tipos.js';
import { simular } from './motor/simulador.js';

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
const totalTernosInput = document.querySelector<HTMLInputElement>('#total-ternos')!;
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
let fainaOptionIndex = -1;
let catalogSourceFilter: 'TODAS' | 'ACT' | 'CCT' = 'TODAS';

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
    return `
    <tr>
      <td><strong>${escapeHtml(registro.descricao)}</strong><small>${escapeHtml(registro.tipoDeCarga)} · código ${escapeHtml(registro.codigoDaTabela ?? registro.codigo)}</small></td>
      <td><span class="catalog-group">${escapeHtml(registro.grupoDaTabela ?? 'Catálogo ACT')}</span><small>${escapeHtml(registro.vigencia)}</small></td>
      <td><span class="source-pill source-${registro.fonte.toLowerCase()}">${registro.fonte}</span>${status}</td>
      <td><span class="rule-value">${escapeHtml(registro.unidade)}</span><small>unidade da tabela</small></td>
      <td>${regra ? `<span class="rule-value">${money(regra.taxaEstivaPorTonelada)}</span><small>estiva / ton / cota · ${number(regra.cotasEstivaPorTerno)} cotas/terno · conferentes ${money(regra.taxaConferentesPorTonelada)} / ton</small>` : regraPlanilha ? `<span class="rule-value">${money(regraPlanilha.taxaBase)}</span><small>${regraPlanilha.regime === 'PRODUCAO' ? 'produção' : 'salário-dia'} · ${number(regraPlanilha.composicao.reduce((total, item) => total + item.cotas, 0))} cotas/terno · +${number(regraPlanilha.encargosContribuicaoAdicional * 100)}% encargos</small>` : '<span class="pending-rule">Regra não habilitada</span><small>transcrição documental</small>'}</td>
      <td><small>${escapeHtml(registro.referencia)}</small></td>
    </tr>
  `;
  }).join('') : '<tr><td colspan="6" class="catalog-empty-result">Nenhuma faina corresponde aos filtros atuais.</td></tr>';
}

renderFainaOptions();
selectFaina(fainasSelecionaveis[0]?.codigo);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  recalculate();
});
volumeInput.addEventListener('input', () => { markScenarioDirty(); updateCalculatedPeriods(); updateTernosPreview(); });
productivityInput.addEventListener('input', () => { markScenarioDirty(); updateCalculatedPeriods(); updateTernosPreview(); });
totalTernosInput.addEventListener('input', () => { markScenarioDirty(); updateTernosPreview(); });
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
costToggles.forEach((toggle) => toggle.addEventListener('change', () => updateOptionalCostInput(toggle)));
addCustomCostButton.addEventListener('click', addCustomCost);
updateCalculatedPeriods();
updateOperationUnitLabels();
updateTernosPreview();
window.addEventListener('hashchange', () => renderRoute(routeFromHash()));
renderRoute(routeFromHash());

function recalculate(distribution?: readonly number[]): void {
  clearError();
  try {
    const entrada = readInput(distribution);
    currentResult = simular(entrada, catalogoPortmac, calendarioOperacional);
    render(currentResult);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Não foi possível calcular este cenário.');
  }
}

function readInput(distribution?: readonly number[]): EntradaDeSimulacao {
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
    totalDeTernos: numberOf('#total-ternos'),
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
  setText('#calculation-summary', `${number(resultado.entrada.volumeToneladas)} ${unidade.abreviacao} ÷ ${number(resultado.entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/período = ${resultado.quantidadeDePeriodos} períodos · calendário nacional aplicado`);
  renderCalculationMemory(resultado);
  renderTernosEditor(resultado);
}

function applyDistribution(): void {
  const values = Array.from(ternosEditorBody.querySelectorAll<HTMLInputElement>('.ternos-input')).map((input) => Number(input.value));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 4)) {
    showDistributionError('Cada período deve ter entre 0 e 4 ternos.');
    return;
  }
  const totalEsperado = numberOf('#total-ternos');
  if (total !== totalEsperado) {
    draftDistribution = values;
    showDistributionError(`A soma atual é ${total}; ela precisa permanecer em ${totalEsperado}.`);
    return;
  }
  draftDistribution = values;
  ternosEditorStatus.hidden = true;
  if (currentResult && values.length === currentResult.quantidadeDePeriodos) recalculate(values);
  else renderTernosEditor();
}

function renderTernosEditor(resultado?: ResultadoDeSimulacao): void {
  const periodos: readonly PeriodoOgmo[] = resultado
    ? resultado.periodos.map((periodo) => periodo.periodo)
    : projetarPeriodosDoFormulario();
  const totalTernos = numberOf('#total-ternos');
  if (resultado) draftDistribution = resultado.distribuicaoDeTernos;
  if (draftDistribution.length !== periodos.length || draftDistribution.reduce((soma, ternos) => soma + ternos, 0) !== totalTernos) {
    draftDistribution = distribuirTernosLocal(totalTernos, periodos.length);
  }

  setText('#ternos-editor-count', `${periodos.length} ${periodos.length === 1 ? 'período' : 'períodos'} · ${totalTernos} ${totalTernos === 1 ? 'terno' : 'ternos'}`);
  if (!periodos.length) {
    ternosEditorStatus.textContent = 'Informe uma quantidade e uma produtividade válidas para distribuir os ternos.';
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
    return `
      <tr>
        <td>${escapeHtml(periodo.identificador)}</td>
        <td>${formatarDataPtBr(periodo.data)}</td>
        <td>${calculado ? `${number(calculado.producaoToneladas)} ${unidade.abreviacao}` : '—'}</td>
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
      applyDistribution();
    });
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
  const summary = resultado.memoria.map((linha, indice) => `
    <div class="memory-line">
      <span>${escapeHtml(linha.descricao)}</span>
      <strong>${indice < 4 ? number(linha.valor) : money(linha.valor)}</strong>
    </div>
  `).join('');
  const periods = resultado.periodos.map((periodo, indice) => `
    <details class="memory-period"${indice === 0 ? ' open' : ''}>
      <summary>${formatarDataPtBr(periodo.periodo.data)} · ${escapeHtml(periodo.periodo.identificador)} · ${money(periodo.custo.total)}</summary>
      <div class="memory-period-lines">
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
      <span class="memory-caption">Composição por período</span>
      ${periods}
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
  const periods = volume > 0 && productivity > 0 ? Math.ceil(volume / productivity) : '—';
  setText('#calculated-periods', String(periods));
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
  const nome = unidade.singular[0]!.toUpperCase() + unidade.singular.slice(1);
  document.querySelector<HTMLElement>('#volume-field-label')!.innerHTML = `${nome} da operação <b>${unidade.abreviacao}</b>`;
  document.querySelector<HTMLElement>('#productivity-field-label')!.innerHTML = `Capacidade <b>${unidade.abreviacao} / período</b>`;
}
function clearError(): void { errorBox.hidden = true; errorBox.textContent = ''; }
function showError(message: string): void { errorBox.textContent = message; errorBox.hidden = false; }
