import './styles.css';
import { data, formatarDataPtBr } from './dominio/tempo.js';
import { calendarioOperacional } from './calendario/operacional.js';
import { catalogoPortmac } from './catalogo/portmac.js';
import type { CustoOpcional, EntradaDeSimulacao, ResultadoDeSimulacao, TipoDeCustoOpcional } from './dominio/tipos.js';
import { simular } from './motor/simulador.js';

const form = document.querySelector<HTMLFormElement>('#simulation-form')!;
const errorBox = document.querySelector<HTMLDivElement>('#error')!;
const emptyState = document.querySelector<HTMLElement>('#empty-state')!;
const resultState = document.querySelector<HTMLElement>('#result-state')!;
const distributionStatus = document.querySelector<HTMLDivElement>('#distribution-status')!;
const fainaInput = document.querySelector<HTMLSelectElement>('#faina')!;
const volumeInput = document.querySelector<HTMLInputElement>('#volume')!;
const productivityInput = document.querySelector<HTMLInputElement>('#produtividade')!;
const costToggles = document.querySelectorAll<HTMLInputElement>('.cost-toggle');
const customCostList = document.querySelector<HTMLDivElement>('#custom-cost-list')!;
const addCustomCostButton = document.querySelector<HTMLButtonElement>('#add-custom-cost')!;
const pages = document.querySelectorAll<HTMLElement>('[data-page]');
const routeLinks = document.querySelectorAll<HTMLAnchorElement>('[data-route]');
let currentResult: ResultadoDeSimulacao | undefined;
let customCostCounter = 0;

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

  setText('#catalog-count', String(registros.length));
  setText('#catalog-act-count', String(actCount));
  setText('#catalog-cct-count', String(cctCount));
  tableBody.innerHTML = registros.map((registro) => {
    const regra = registro.regra;
    const status = registro.status === 'PENDENTE_DE_VALIDACAO' || !regra
      ? '<span class="pending-pill">Pendente</span><small>aguarda validação</small>'
      : `<span class="ready-pill">Disponível</span><small>regra habilitada</small>`;
    return `
    <tr>
      <td><strong>${escapeHtml(registro.descricao)}</strong><small>${escapeHtml(registro.tipoDeCarga)} · código ${escapeHtml(registro.codigoDaTabela ?? registro.codigo)}</small></td>
      <td><span class="catalog-group">${escapeHtml(registro.grupoDaTabela ?? 'Catálogo ACT')}</span><small>${escapeHtml(registro.vigencia)}</small></td>
      <td><span class="source-pill source-${registro.fonte.toLowerCase()}">${registro.fonte}</span>${status}</td>
      <td><span class="rule-value">${escapeHtml(registro.unidade)}</span><small>unidade da tabela</small></td>
      <td>${regra ? `<span class="rule-value">${money(regra.taxaEstivaPorTonelada)}</span><small>estiva / ton / cota · ${number(regra.cotasEstivaPorTerno)} cotas/terno · conferentes ${money(regra.taxaConferentesPorTonelada)} / ton</small>` : '<span class="pending-rule">Regra não habilitada</span><small>transcrição documental</small>'}</td>
      <td><small>${escapeHtml(registro.referencia)}</small></td>
    </tr>
  `;
  }).join('');
}

fainaInput.innerHTML = catalogoPortmac.listarFainas()
  .filter((faina) => faina.status !== 'PENDENTE_DE_VALIDACAO')
  .map((faina) => `<option value="${faina.codigo}">${faina.descricao} · ${faina.fonte}</option>`)
  .join('');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  recalculate();
});
volumeInput.addEventListener('input', updateCalculatedPeriods);
productivityInput.addEventListener('input', updateCalculatedPeriods);
costToggles.forEach((toggle) => toggle.addEventListener('change', () => updateOptionalCostInput(toggle)));
addCustomCostButton.addEventListener('click', addCustomCost);
updateCalculatedPeriods();
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
    faina: valueOf<HTMLSelectElement>('#faina'),
    inicio: { data: data(ano!, mes!, dia!), periodo: valueOf<HTMLSelectElement>('#periodo') },
    volumeToneladas: numberOf('#volume'),
    produtividadeToneladasPorPeriodo: numberOf('#produtividade'),
    totalDeTernos: numberOf('#total-ternos'),
    ...(distribution === undefined ? {} : { ternosPorPeriodo: distribution }),
  };
}

function render(resultado: ResultadoDeSimulacao): void {
  emptyState.hidden = true;
  resultState.hidden = false;
  const faina = catalogoPortmac.obterFaina(resultado.entrada.faina);
  setText('#result-faina', faina?.descricao ?? resultado.entrada.faina);
  setText('#result-source', faina ? `${faina.fonte} · ${faina.vigencia}` : 'fonte não encontrada');
  setText('#result-client', resultado.entrada.cliente ? `Cliente: ${resultado.entrada.cliente}` : 'Cliente não informado');
  setText('#labor-cost-total', money(resultado.custoDeMaoDeObra));
  setText('#labor-cost-per-ton', `${money(resultado.custoDeMaoDeObra / resultado.entrada.volumeToneladas)} / ton`);
  setText('#composed-cost-total', money(resultado.custoTotal));
  renderOptionalCostLines(resultado);
  setText('#cost-per-ton', money(resultado.custoPorTonelada));
  setText('#cost-total', money(resultado.custoTotal));
  setText('#period-count', String(resultado.quantidadeDePeriodos));
  setText('#calculated-periods', String(resultado.quantidadeDePeriodos));
  setText('#ternos-total-label', String(resultado.entrada.totalDeTernos));
  setText('#calculation-summary', `${number(resultado.entrada.volumeToneladas)} ton ÷ ${number(resultado.entrada.produtividadeToneladasPorPeriodo)} ton/período = ${resultado.quantidadeDePeriodos} períodos`);

  const body = document.querySelector<HTMLTableSectionElement>('#periods-body')!;
  body.innerHTML = resultado.periodos.map((periodo) => `
    <tr>
      <td>${periodo.periodo.identificador}</td>
      <td>${formatarDataPtBr(periodo.periodo.data)}</td>
      <td>${number(periodo.producaoToneladas)} ton</td>
      <td>
        <div class="ternos-control">
          <input class="ternos-input" data-period-index="${periodo.periodo.indice}" type="range" min="0" max="4" step="1" value="${periodo.ternos}" aria-label="Ternos no ${periodo.periodo.identificador}" />
          <output class="ternos-value" for="ternos-${periodo.periodo.indice}">${periodo.ternos}</output>
        </div>
      </td>
      <td>${money(periodo.custo.total)}</td>
    </tr>
  `).join('');

  body.querySelectorAll<HTMLInputElement>('.ternos-input').forEach((input) => {
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
  distributionStatus.hidden = true;
}

function applyDistribution(): void {
  if (!currentResult) return;
  const values = Array.from(document.querySelectorAll<HTMLInputElement>('.ternos-input')).map((input) => Number(input.value));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 4)) {
    showDistributionError('Cada período deve ter entre 0 e 4 ternos.');
    return;
  }
  if (total !== currentResult.entrada.totalDeTernos) {
    showDistributionError(`A soma atual é ${total}; ela precisa permanecer em ${currentResult.entrada.totalDeTernos}.`);
    return;
  }
  recalculate(values);
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
          <div><span>${escapeHtml(label)}</span><small>${money(custo.custoPorTonelada)} / ton</small></div>
          <strong>${money(custo.custoTotal)}</strong>
        </div>
      `;
    }).join('')
    : '<p class="no-optional-costs">Nenhum custo opcional ativado.</p>';
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
  distributionStatus.textContent = message;
  distributionStatus.hidden = false;
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
function clearError(): void { errorBox.hidden = true; errorBox.textContent = ''; }
function showError(message: string): void { errorBox.textContent = message; errorBox.hidden = false; }
