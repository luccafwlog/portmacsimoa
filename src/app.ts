import './styles.css';
import { data, formatarData, formatarDataCurtaPtBr, formatarDataPtBr } from './dominio/tempo.js';
import { calendarioOperacional } from './calendario/operacional.js';
import { catalogoPortmac } from './catalogo/portmac.js';
import type { CustoOpcional, EntradaDeSimulacao, LinhaDeMemoria, PeriodoOgmo, ResultadoDeSimulacao, TipoDeCustoOpcional } from './dominio/tipos.js';
import type { MajoracaoDoPeriodo } from './dominio/majoracoes.js';
import { majoracaoDoPeriodoProjetado, simular } from './motor/simulador.js';
import { gerarGradeDeProdutividades, otimizarCenario } from './motor/otimizador.js';
import { analisarFainaDeReferencia, type ReferenciaDaFaina } from './motor/referencia.js';
import { formatarMoeda, formatarNumero, formatarNumeroFixo, formatarPercentual, pluralizar, rotuloDaUnidade } from './dominio/formato.js';

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
const clientSearchInput = document.querySelector<HTMLInputElement>('#clients-search');
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
let periodosDoEditor: readonly PeriodoOgmo[] = [];
let chaveDosPeriodosDoEditor = '';
let fainaOptionIndex = -1;
let catalogSourceFilter: 'TODAS' | 'ACT' | 'CCT' = 'TODAS';
/** A referência depende só da faina; recalculá-la a cada tecla seria desperdício. */
const referenciasPorFaina = new Map<string, ReferenciaDaFaina>();
const SAVED_BUDGETS_KEY = 'sco-orcamentos-salvos';

interface OrcamentoSalvo {
  readonly id: string;
  readonly cliente: string;
  readonly criadoEm: string;
  readonly resultado: ResultadoDeSimulacao;
}

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
      <td><span class="rule-value">${escapeHtml(rotuloDaUnidade(registro.unidade).plural)}</span><small>${escapeHtml(registro.unidade.toLowerCase())} · unidade da tabela</small></td>
      <td>${regra ? `<span class="rule-value">${formatarMoeda(regra.taxaEstivaPorTonelada)}</span><small>estiva / ton / cota · ${formatarNumero(regra.cotasEstivaPorTerno)} cotas/terno · conferentes ${formatarMoeda(regra.taxaConferentesPorTonelada)} / ton</small>` : regraPlanilha ? `<span class="rule-value">${formatarMoeda(regraPlanilha.taxaBase)}</span><small>${regraPlanilha.baseDeCalculo === 'TARIFA_UNITARIA' ? 'tarifa unitária; não multiplicada por cotas' : 'cotas da equipe'} · ${regraPlanilha.regime === 'PRODUCAO' ? 'produção' : 'salário-dia'} · +${formatarNumero(regraPlanilha.encargosContribuicaoAdicional * 100)}% encargos</small>` : '<span class="pending-rule">Regra não habilitada</span><small>transcrição documental</small>'}</td>
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
  const termo = normalizarBusca(clientSearchInput?.value);
  const visiveis = termo
    ? budgets.filter((budget) => normalizarBusca(`${budget.cliente} ${catalogoPortmac.obterFaina(budget.resultado.entrada.faina)?.descricao ?? ''}`).includes(termo))
    : budgets;
  const clientes = agruparPorCliente(visiveis);
  setText('#clients-count', formatarNumero(new Set(budgets.map((budget) => chaveDoCliente(budget.cliente))).size));
  setText('#clients-budget-count', formatarNumero(budgets.length));
  const busca = document.querySelector<HTMLElement>('#clients-toolbar');
  if (busca) busca.hidden = budgets.length === 0;
  empty.hidden = budgets.length > 0;
  list.hidden = budgets.length === 0;
  if (!budgets.length) { list.innerHTML = ''; return; }
  if (!clientes.length) {
    list.innerHTML = '<p class="page-empty-result">Nenhum cliente corresponde à busca.</p>';
    return;
  }
  // A página se chama "clientes": o cliente é o cabeçalho e os orçamentos são
  // o que ele acumulou, em vez de uma lista plana que repete o mesmo nome.
  list.innerHTML = clientes.map(([cliente, orcamentos]) => `<section class="client-group">
    <header class="client-group-heading">
      <div>
        <h3>${escapeHtml(cliente)}</h3>
        <small>${pluralizar(orcamentos.length, 'orçamento salvo', 'orçamentos salvos')} · último em ${escapeHtml(formatarDataHora(orcamentos[0]!.criadoEm))}</small>
      </div>
      <span class="result-chip">${escapeHtml(formatarMoeda(orcamentos.reduce((soma, orcamento) => soma + orcamento.resultado.custoTotal, 0)))} acumulados</span>
    </header>
    ${orcamentos.map((budget) => renderSavedBudgetCard(budget)).join('')}
  </section>`).join('');
}

function renderSavedBudgetCard(budget: OrcamentoSalvo): string {
  const faina = catalogoPortmac.obterFaina(budget.resultado.entrada.faina);
  const unidade = rotuloDaUnidade(faina?.unidade);
  return `<article class="saved-budget" data-budget-id="${escapeHtml(budget.id)}">
      <div class="saved-budget-heading">
        <div><span class="saved-budget-client">${escapeHtml(faina?.descricao ?? budget.resultado.entrada.faina)}</span><small>salvo em ${escapeHtml(formatarDataHora(budget.criadoEm))}</small></div>
        <span class="result-chip">${escapeHtml(faina?.fonte ?? 'SCO')} · ${escapeHtml(faina?.vigencia ?? 'provisório')}</span>
      </div>
      <div class="saved-budget-grid">
        <div><span>Início</span><strong>${formatarDataPtBr(budget.resultado.entrada.inicio.data)} · ${escapeHtml(budget.resultado.entrada.inicio.periodo)}</strong></div>
        <div><span>Operação</span><strong>${formatarNumero(budget.resultado.entrada.volumeToneladas)} ${escapeHtml(unidade.abreviacao)} · ${pluralizar(budget.resultado.quantidadeDePeriodos, 'período', 'períodos')}</strong></div>
        <div><span>Custo por ${escapeHtml(unidade.singular)}</span><strong class="saved-budget-primary-cost">${formatarMoeda(budget.resultado.custoPorTonelada)}</strong></div>
        <div><span>Custo total</span><strong>${formatarMoeda(budget.resultado.custoTotal)}</strong></div>
      </div>
      <div class="saved-budget-actions">
        <details class="saved-budget-details">
          <summary><span aria-hidden="true">+</span> Ver cenário completo</summary>
          ${renderSavedBudgetDetails(budget.resultado, faina)}
        </details>
        <div class="saved-budget-buttons">
          <button class="secondary-button print-budget-button" type="button" data-print-budget="${escapeHtml(budget.id)}">Imprimir simulação</button>
          <button class="secondary-button delete-budget-button" type="button" data-delete-budget="${escapeHtml(budget.id)}">Excluir</button>
        </div>
      </div>
    </article>`;
}

/** Nomes iguais a menos de acento e caixa pertencem ao mesmo cliente. */
function chaveDoCliente(cliente: string): string {
  return normalizarBusca(cliente).trim();
}

function agruparPorCliente(budgets: readonly OrcamentoSalvo[]): [string, OrcamentoSalvo[]][] {
  const grupos = new Map<string, OrcamentoSalvo[]>();
  for (const budget of budgets) {
    const chave = chaveDoCliente(budget.cliente);
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(budget);
    else grupos.set(chave, [budget]);
  }
  return [...grupos.values()]
    .map((orcamentos): [string, OrcamentoSalvo[]] => [orcamentos[0]!.cliente, orcamentos])
    .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
}

function deleteSavedBudget(id?: string): void {
  if (!id) return;
  const budgets = readSavedBudgets();
  const alvo = budgets.find((budget) => budget.id === id);
  if (!alvo) return;
  if (!window.confirm(`Excluir o orçamento de ${alvo.cliente} salvo em ${formatarDataHora(alvo.criadoEm)}?`)) return;
  writeSavedBudgets(budgets.filter((budget) => budget.id !== id));
  renderClientsPage();
}

function renderSavedBudgetDetails(resultado: ResultadoDeSimulacao, faina?: ReturnType<typeof catalogoPortmac.obterFaina>): string {
  const unidade = rotuloDaUnidade(faina?.unidade);
  const entrada = resultado.entrada;
  return `<div class="saved-scenario-details">
    <div class="saved-scenario-section">
      <span class="saved-scenario-caption">Dados da operação</span>
      <div class="saved-scenario-grid">
        <div><span>Faina</span><strong>${escapeHtml(faina?.descricao ?? entrada.faina)}</strong></div>
        <div><span>Início</span><strong>${formatarDataPtBr(entrada.inicio.data)} · ${escapeHtml(entrada.inicio.periodo)}</strong></div>
        <div><span>Quantidade</span><strong>${formatarNumero(entrada.volumeToneladas)} ${unidade.abreviacao}</strong></div>
        <div><span>Produtividade-base</span><strong>${formatarNumero(entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/terno/período</strong></div>
        <div><span>Períodos calculados</span><strong>${formatarNumero(resultado.quantidadeDePeriodos)}</strong></div>
        <div><span>Ternos por período</span><strong>${formatarNumero(entrada.ternosPorPeriodoPadrao ?? (resultado.quantidadeDePeriodos ? entrada.totalDeTernos / resultado.quantidadeDePeriodos : 0))}</strong></div>
        <div><span>Total de ternos calculado</span><strong>${formatarNumero(entrada.totalDeTernos)}</strong></div>
      </div>
    </div>
    <div class="saved-scenario-section">
      <span class="saved-scenario-caption">Composição por período</span>
      <div class="saved-period-table-wrap"><table class="saved-period-table"><thead><tr><th>Data</th><th>Período</th><th>Produtividade / terno</th><th>Produção</th><th>Ternos</th><th>Majoração</th><th>Custo</th></tr></thead><tbody>
        ${resultado.periodos.map((periodo, indice) => `<tr><td>${formatarDataPtBr(periodo.periodo.data)}</td><td>${escapeHtml(periodo.periodo.identificador)}</td><td>${formatarNumero(resultado.entrada.produtividadesPorPeriodo?.[indice] ?? resultado.entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/terno</td><td>${formatarNumero(periodo.producaoToneladas)} ${unidade.abreviacao}</td><td>${formatarNumero(periodo.ternos)}</td><td>${escapeHtml(periodo.custo.majoracao?.descricao ?? 'preço normal')}</td><td>${formatarMoeda(periodo.custo.total)}</td></tr>`).join('')}
      </tbody></table></div>
    </div>
    <div class="saved-scenario-section saved-period-memory">
      <span class="saved-scenario-caption">Memória por período</span>
      <div class="saved-period-memory-list">
        ${resultado.periodos.map((periodo) => `<details class="saved-period-memory-item">
          <summary>${formatarDataPtBr(periodo.periodo.data)} · ${escapeHtml(periodo.periodo.identificador)} <strong>${formatarMoeda(periodo.custo.total)}</strong></summary>
          <div class="saved-period-memory-lines">
            ${periodo.custo.memoria.map((linha) => `<div><span>${escapeHtml(linha.descricao)}</span><strong>${formatarMoeda(linha.valor)}</strong></div>`).join('')}
          </div>
        </details>`).join('')}
      </div>
    </div>
    ${resultado.custosOpcionais.length ? `<div class="saved-scenario-section saved-scenario-costs">
      <span class="saved-scenario-caption">Custos opcionais</span>
      ${resultado.custosOpcionais.map((custo) => {
        const label = custo.tipo === 'OUTRO' ? custo.descricao?.trim() || optionalCostLabels.OUTRO : optionalCostLabels[custo.tipo];
        return `<div><span>${escapeHtml(label)}</span><strong>${formatarMoeda(custo.custoTotal)}</strong></div>`;
      }).join('')}
    </div>` : ''}
    <div class="saved-scenario-section saved-scenario-costs">
      <span class="saved-scenario-caption">Resumo financeiro</span>
      ${resultado.memoria.map((linha) => `<div><span>${escapeHtml(linha.descricao)}</span><strong>${valorDeMemoria(linha)}</strong></div>`).join('')}
    </div>
  </div>`;
}

function renderCatalogMethod(
  registro: ReturnType<typeof catalogoPortmac.listarRegistros>[number],
  regra: NonNullable<ReturnType<typeof catalogoPortmac.listarRegistros>[number]['regraActProvisoria'] | ReturnType<typeof catalogoPortmac.listarRegistros>[number]['regraCctProvisoria']>,
): string {
  const fator = regra.baseDeCalculo === 'TARIFA_UNITARIA' ? '1 tarifa unitária' : 'cotas da equipe';
  const formula = regra.regime === 'PRODUCAO'
    ? regra.baseDeCalculo === 'TARIFA_UNITARIA'
      ? 'tarifa-base × produção agregada dos ternos × encargos × majoração'
      : 'cotas × tarifa-base × produção agregada dos ternos × encargos × majoração'
    : regra.baseDeCalculo === 'TARIFA_UNITARIA'
      ? 'tarifa-base × encargos × majoração × ternos'
      : 'cotas × tarifa-base × encargos × majoração × ternos';
  const composition = regra.composicao.map((item) =>
    `<li>${escapeHtml(item.categoria)}: ${item.homens} homens · ${formatarNumero(item.cotas)} cotas${item.funcoes.length ? ` · ${escapeHtml(item.funcoes.join(', '))}` : ''}</li>`,
  ).join('');
  return `<div class="catalog-method-body">
    <div class="catalog-method-top">
      <p class="catalog-method-formula"><strong>Fórmula aplicada</strong><code>${formula}</code></p>
      <div class="catalog-reference-detail"><span>Referência documental</span><small>${escapeHtml(registro.referencia)}</small></div>
    </div>
    <div class="catalog-method-grid">
      <div><span>Base monetária</span><strong>${formatarMoeda(regra.taxaBase)}</strong></div>
      <div><span>Unidade</span><strong>${escapeHtml(rotuloDaUnidade(regra.unidade).plural)}</strong></div>
      <div><span>Regime</span><strong>${regra.regime === 'PRODUCAO' ? 'produção' : 'salário-dia'}</strong></div>
      <div><span>Tratamento da equipe</span><strong>${fator}</strong></div>
      <div><span>Encargos</span><strong>+${formatarNumero(regra.encargosContribuicaoAdicional * 100)}%</strong></div>
      <div><span>Fonte</span><strong>${escapeHtml(registro.fonte)} · ${escapeHtml(registro.codigoDaTabela ?? registro.codigo)}</strong></div>
    </div>
    <p class="catalog-method-note">${regra.regime === 'PRODUCAO'
      ? 'A produtividade informada é por terno; a produção do período já representa a soma da produtividade dos ternos alocados e não é multiplicada novamente.'
      : 'A remuneração é calculada por terno e multiplicada pela quantidade de ternos do período.'}</p>
    <ul>${composition}</ul>
  </div>`;
}

renderFainaOptions();
updateOperationUnitLabels();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  recalculate();
});
volumeInput.addEventListener('input', aoMudarOCenario);
productivityInput.addEventListener('input', aoMudarOCenario);
ternosPorPeriodoInput.addEventListener('input', aoMudarOCenario);
dateInput.addEventListener('change', aoMudarOCenario);
periodInput.addEventListener('change', aoMudarOCenario);
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
  if (!(event.target instanceof HTMLElement)) return;
  const imprimir = event.target.closest<HTMLButtonElement>('[data-print-budget]');
  if (imprimir) { printSavedBudget(imprimir.dataset.printBudget); return; }
  const excluir = event.target.closest<HTMLButtonElement>('[data-delete-budget]');
  if (excluir) deleteSavedBudget(excluir.dataset.deleteBudget);
});
clientSearchInput?.addEventListener('input', renderClientsPage);
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
renderAnaliseDeProdutividade();
window.addEventListener('hashchange', () => renderRoute(routeFromHash()));
renderRoute(routeFromHash());

/**
 * Um campo do cenário mudou: refaz o que depende dele.
 *
 * A análise varre dezenas de simulações, então entra no mesmo agendamento por
 * quadro dos ajustes do editor — digitar um volume não deve disparar uma
 * varredura por tecla.
 */
function aoMudarOCenario(): void {
  markScenarioDirty();
  updateCalculatedPeriods();
  updateTernosPreview();
  agendarAnalise();
}

let quadroDeAnaliseAgendado = 0;
function agendarAnalise(): void {
  if (quadroDeAnaliseAgendado) return;
  quadroDeAnaliseAgendado = requestAnimationFrame(() => {
    quadroDeAnaliseAgendado = 0;
    renderAnaliseDeProdutividade();
  });
}

function recalculate(
  distribution?: readonly number[],
  productivities?: readonly number[],
): void {
  clearError();
  // O código da faina só existe depois de escolher uma opção da lista. Sem esta
  // checagem o motor devolvia "A faina é obrigatória" mesmo com o campo escrito.
  if (!fainaCodeInput.value && fainaInput.value.trim()) {
    showError('Escolha uma faina da lista do catálogo: digitar o nome não seleciona o registro.');
    openFainaOptions();
    return;
  }
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
  setText('#labor-cost-total', formatarMoeda(resultado.custoDeMaoDeObra));
  const unidade = rotuloDaUnidade(faina?.unidade);
  setText('#cost-per-unit-label', `Custo por ${unidade.singular}`);
  setText('#labor-cost-per-unit', `${formatarMoeda(resultado.custoDeMaoDeObra / resultado.entrada.volumeToneladas)} / ${unidade.abreviacao}`);
  setText('#composed-cost-total', formatarMoeda(resultado.custoTotal));
  renderOptionalCostLines(resultado);
  setText('#cost-per-ton', formatarMoeda(resultado.custoPorTonelada));
  setText('#cost-total', formatarMoeda(resultado.custoTotal));
  setText('#period-count', String(resultado.quantidadeDePeriodos));
  setText('#calculated-periods', String(resultado.quantidadeDePeriodos));
  const produtividades = resultado.entrada.produtividadesPorPeriodo;
  const produtividadeCustomizada = produtividades?.some((produtividade) => produtividade !== resultado.entrada.produtividadeToneladasPorPeriodo) ?? false;
  const ternosPorPeriodo = resultado.entrada.ternosPorPeriodoPadrao
    ?? (resultado.quantidadeDePeriodos ? resultado.entrada.totalDeTernos / resultado.quantidadeDePeriodos : 0);
  const ternosPorPeriodoTexto = pluralizar(ternosPorPeriodo, 'terno', 'ternos');
  setText('#calculation-summary', produtividadeCustomizada
    ? `${formatarNumero(resultado.entrada.volumeToneladas)} ${unidade.abreviacao} ÷ (produtividade por terno ajustada × ternos por período) = ${pluralizar(resultado.quantidadeDePeriodos, 'período', 'períodos')} · ${ternosPorPeriodoTexto} por período · calendário de Vila Velha aplicado`
    : `${formatarNumero(resultado.entrada.volumeToneladas)} ${unidade.abreviacao} ÷ (${formatarNumero(resultado.entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/terno/período × ${ternosPorPeriodoTexto}) = ${pluralizar(resultado.quantidadeDePeriodos, 'período', 'períodos')} · calendário de Vila Velha aplicado`);
  renderCalculationMemory(resultado);
  renderPeriodCostChart(resultado);
  renderTernosEditor(resultado);
  // Um cenário novo é um orçamento novo: sem restaurar o rótulo, o botão
  // continuava anunciando "Orçamento salvo" para um resultado ainda não salvo.
  const saveButton = document.querySelector<HTMLButtonElement>('#save-budget');
  const saveHint = document.querySelector<HTMLElement>('#save-budget-hint');
  if (saveButton && saveHint) {
    saveButton.textContent = 'Salvar orçamento';
    saveButton.disabled = !resultado.entrada.cliente;
    saveHint.textContent = resultado.entrada.cliente
      ? `Vinculado a ${resultado.entrada.cliente}`
      : 'Informe o cliente nos dados da operação para salvar';
  }
}

/**
 * Geometria compartilhada pelos dois gráficos.
 *
 * Antes cada função repetia as mesmas oito constantes de margem; qualquer
 * ajuste de leitura precisava ser feito duas vezes e as escalas divergiam.
 */
const GRAFICO = {
  largura: 860,
  // A base acomoda três linhas de rótulo — data, faixa e ternos — mais o
  // título do eixo, que antes se sobrepunha à linha dos ternos.
  altura: 362,
  esquerda: 132,
  direita: 28,
  topo: 28,
  base: 98,
} as const;
const GRAFICO_LARGURA_UTIL = GRAFICO.largura - GRAFICO.esquerda - GRAFICO.direita;
const GRAFICO_ALTURA_UTIL = GRAFICO.altura - GRAFICO.topo - GRAFICO.base;

/** Linhas de grade horizontais com o rótulo do eixo Y já formatado. */
function gradeHorizontal(
  escalaY: (valor: number) => number,
  valores: readonly number[],
  formatar: (valor: number) => string = formatarValorEixo,
): string {
  return valores.map((valor) => {
    const y = escalaY(valor).toFixed(2);
    return `<line class="chart-grid-line" x1="${GRAFICO.esquerda}" y1="${y}" x2="${GRAFICO.largura - GRAFICO.direita}" y2="${y}" />
      <text class="chart-axis-label chart-axis-label-y" x="${GRAFICO.esquerda - 12}" y="${(Number(y) + 4).toFixed(2)}">${escapeHtml(formatar(valor))}</text>`;
  }).join('');
}

function eixos(): string {
  const { esquerda, topo, largura, direita } = GRAFICO;
  const baseY = topo + GRAFICO_ALTURA_UTIL;
  return `<line class="chart-axis" x1="${esquerda}" y1="${topo}" x2="${esquerda}" y2="${baseY}" />
    <line class="chart-axis" x1="${esquerda}" y1="${baseY}" x2="${largura - direita}" y2="${baseY}" />`;
}

/** Distribui no máximo `maximo` rótulos por um eixo com `total` posições. */
function passoDeRotulos(total: number, maximo = 12): number {
  return total <= maximo ? 1 : Math.ceil(total / maximo);
}

/**
 * Uma barra do cenário: o que um período movimenta, com quantos ternos e a
 * que custo. O rascunho em edição e o resultado calculado produzem a mesma
 * forma, então os dois gráficos são o mesmo desenho com dados diferentes.
 */
interface BarraDoCenario {
  readonly periodo: PeriodoOgmo;
  readonly producao: number;
  readonly ternos: number;
  readonly majoracao: MajoracaoDoPeriodo | undefined;
  /** Ausente quando a faina ainda não permite calcular o custo do período. */
  readonly custo: number | undefined;
}

/**
 * Desenha o cenário período a período.
 *
 * Prefere custo no eixo Y; cai para produção quando ainda não há regra de custo
 * aplicável. A cor separa preço normal de período com adicional de jornada,
 * que é o que faz a barra saltar ao mover um terno para a madrugada.
 */
function renderScenarioChart(
  container: HTMLElement,
  barras: readonly BarraDoCenario[],
  unidade: ReturnType<typeof rotuloDaUnidade>,
): void {
  if (!barras.length) {
    container.removeAttribute('role');
    container.removeAttribute('aria-label');
    container.innerHTML = '';
    return;
  }
  const temCusto = barras.every((barra) => barra.custo !== undefined);
  const valorDaBarra = (barra: BarraDoCenario) => temCusto ? barra.custo! : barra.producao;
  const formatarValor = (valor: number) => temCusto ? formatarMoeda(valor) : `${formatarNumero(valor)} ${unidade.abreviacao}`;
  const formatarEixo = (valor: number) => temCusto
    ? formatarValorEixo(valor)
    : formatarNumero(valor, valor >= 100 ? 0 : 2);
  const valores = barras.map(valorDaBarra);
  const maior = Math.max(...valores, 0);
  const total = valores.reduce((soma, valor) => soma + valor, 0);
  const majorados = barras.filter((barra) => (barra.majoracao?.adicionalPercentual ?? 0) > 0).length;

  const { esquerda, topo, altura, base } = GRAFICO;
  const y = (valor: number) => topo + GRAFICO_ALTURA_UTIL - (maior > 0 ? valor / maior : 0) * GRAFICO_ALTURA_UTIL;
  const divisoes = 4;
  const grade = gradeHorizontal(y, Array.from({ length: divisoes + 1 }, (_, indice) => (maior / divisoes) * indice), formatarEixo);
  const vao = GRAFICO_LARGURA_UTIL / barras.length;
  const largura = Math.max(4, Math.min(34, vao * .62));
  const passo = passoDeRotulos(barras.length);
  // Os ternos só cabem embaixo de cada barra quando há espaço para o dígito.
  const mostrarTernos = vao >= 22;
  const svgBarras = barras.map((barra, indice) => {
    const valor = valorDaBarra(barra);
    const adicional = barra.majoracao?.adicionalPercentual ?? 0;
    const alturaDaBarra = maior > 0 ? (valor / maior) * GRAFICO_ALTURA_UTIL : 0;
    const x = esquerda + indice * vao + (vao - largura) / 2;
    const centro = (x + largura / 2).toFixed(2);
    const rotula = indice % passo === 0;
    const descricao = `${formatarDataPtBr(barra.periodo.data)} · ${barra.periodo.identificador} · ${pluralizar(barra.ternos, 'terno', 'ternos')} · ${formatarNumero(barra.producao)} ${unidade.abreviacao} · ${barra.majoracao?.descricao ?? 'preço normal'}${barra.custo === undefined ? '' : ` · ${formatarMoeda(barra.custo)}`}`;
    return `<rect class="chart-bar${adicional > 0 ? ' is-majorado' : ''}${barra.ternos === 0 ? ' is-vazio' : ''}" x="${x.toFixed(2)}" y="${y(valor).toFixed(2)}" width="${largura.toFixed(2)}" height="${alturaDaBarra.toFixed(2)}" rx="3"><title>${escapeHtml(descricao)}</title></rect>
      <text class="chart-axis-label chart-axis-label-x" x="${centro}" y="${altura - base + 22}">${rotula ? escapeHtml(formatarDataCurtaPtBr(barra.periodo.data)) : ''}</text>
      <text class="chart-axis-label chart-axis-label-x chart-axis-label-band" x="${centro}" y="${altura - base + 38}">${rotula ? escapeHtml(barra.periodo.identificador) : ''}</text>
      <text class="chart-ternos-label" x="${centro}" y="${altura - base + 58}">${mostrarTernos ? formatarNumero(barra.ternos) : ''}</text>`;
  }).join('');
  const rotuloDaLinhaDeTernos = mostrarTernos
    ? `<text class="chart-row-label" x="${esquerda - 12}" y="${altura - base + 58}">ternos</text>`
    : '';

  container.setAttribute('role', 'img');
  container.setAttribute('aria-label', `Cenário por período. ${pluralizar(barras.length, 'período', 'períodos')}, ${majorados} com adicional de jornada. ${temCusto ? `Custo total ${formatarMoeda(total)}` : `Produção total ${formatarNumero(total)} ${unidade.plural}`}.`);
  container.innerHTML = `<div class="chart-scroll"><svg class="chart-svg" viewBox="0 0 ${GRAFICO.largura} ${altura}" aria-hidden="true" focusable="false">
    <text class="chart-axis-title chart-axis-title-y" x="18" y="${topo + GRAFICO_ALTURA_UTIL / 2}" transform="rotate(-90 18 ${topo + GRAFICO_ALTURA_UTIL / 2})">${temCusto ? 'Custo (R$)' : `Produção (${escapeHtml(unidade.abreviacao)})`}</text>
    ${grade}
    ${eixos()}
    ${svgBarras}
    ${rotuloDaLinhaDeTernos}
    <text class="chart-axis-title chart-axis-title-x" x="${esquerda + GRAFICO_LARGURA_UTIL / 2}" y="${altura - 12}">Períodos da operação</text>
  </svg></div>
  <ul class="chart-legend">
    <li><span class="chart-swatch chart-swatch-normal" aria-hidden="true"></span>Preço normal</li>
    <li><span class="chart-swatch chart-swatch-majorado" aria-hidden="true"></span>Com adicional de jornada · ${majorados} de ${barras.length}</li>
  </ul>`;
}

function renderPeriodCostChart(resultado: ResultadoDeSimulacao): void {
  const container = document.querySelector<HTMLDivElement>('#period-cost-chart-body');
  const summary = document.querySelector<HTMLElement>('#period-cost-chart-summary');
  if (!container || !summary) return;
  const unidade = rotuloDaUnidade(catalogoPortmac.obterFaina(resultado.entrada.faina)?.unidade);
  const barras: BarraDoCenario[] = resultado.periodos.map((periodo) => ({
    periodo: periodo.periodo,
    producao: periodo.producaoToneladas,
    ternos: periodo.ternos,
    majoracao: periodo.custo.majoracao,
    custo: periodo.custo.total,
  }));
  const media = barras.length ? resultado.custoDeMaoDeObra / barras.length : 0;
  summary.textContent = `${pluralizar(barras.length, 'período', 'períodos')} · ${pluralizar(resultado.entrada.totalDeTernos, 'terno', 'ternos')} · média ${formatarMoeda(media)}`;
  renderScenarioChart(container, barras, unidade);
}

interface PontoDaCurva {
  readonly produtividade: number;
  readonly custo: number;
  readonly periodos: number;
}

interface MarcaDaCurva {
  readonly produtividade: number;
  readonly rotulo: string;
  readonly variante: 'joelho' | 'cenario';
}

/**
 * Curva de custo por unidade em função da produtividade.
 *
 * O eixo X é linear porque a grade também é: pontos igualmente espaçados
 * mostram o joelho onde ele está, em vez de amontoá-lo na ponta baixa.
 */
/**
 * Análise de produtividade, exibida antes de fechar o cenário.
 *
 * São duas leituras distintas e propositalmente separadas: a **referência da
 * faina**, medida em calendário neutro e independente do que o usuário digitou,
 * e o **cenário informado**, que varre a produtividade sobre a data, o volume e
 * os ternos reais. A diferença entre as duas é a informação de negócio — o que
 * a tabela cobra contra o que aquela semana específica entrega.
 */
function renderAnaliseDeProdutividade(): void {
  const painel = document.querySelector<HTMLElement>('#analise-produtividade');
  if (!painel) return;
  const faina = catalogoPortmac.obterFaina(fainaCodeInput.value);
  painel.hidden = !faina;
  if (!faina) return;
  const unidade = rotuloDaUnidade(faina.unidade);
  renderReferenciaDaFaina(faina, unidade);
  renderAnaliseDoCenario(faina, unidade);
  const pendencia = document.querySelector<HTMLElement>('#analise-pendencia');
  if (pendencia) {
    const referencia = referenciaDaFaina(faina);
    pendencia.hidden = referencia?.forma === 'JOELHO';
    pendencia.textContent = 'Nenhuma faina do catálogo declara produção mínima garantida. É esse piso que faz o custo por unidade parar de cair a partir de uma produtividade — sem ele, o simulador não tem como apontar um ótimo próprio da faina.';
  }
}

function referenciaDaFaina(faina: NonNullable<ReturnType<typeof catalogoPortmac.obterFaina>>): ReferenciaDaFaina | undefined {
  const emCache = referenciasPorFaina.get(faina.codigo);
  if (emCache) return emCache;
  try {
    const referencia = analisarFainaDeReferencia(faina, catalogoPortmac, calendarioOperacional);
    referenciasPorFaina.set(faina.codigo, referencia);
    return referencia;
  } catch {
    return undefined;
  }
}

function renderReferenciaDaFaina(
  faina: NonNullable<ReturnType<typeof catalogoPortmac.obterFaina>>,
  unidade: ReturnType<typeof rotuloDaUnidade>,
): void {
  const bloco = document.querySelector<HTMLElement>('#analise-referencia');
  const corpo = document.querySelector<HTMLElement>('#analise-referencia-body');
  const leitura = document.querySelector<HTMLElement>('#analise-referencia-leitura');
  const rodape = document.querySelector<HTMLElement>('#analise-referencia-base');
  if (!bloco || !corpo || !leitura || !rodape) return;
  const referencia = referenciaDaFaina(faina);
  bloco.hidden = !referencia || referencia.pontos.length < 2;
  if (!referencia || referencia.pontos.length < 2) return;

  rodape.textContent = `${formatarNumero(referencia.volumeDeReferencia)} ${unidade.abreviacao} · ${pluralizar(referencia.ternosDeReferencia, 'terno', 'ternos')} · semana sem feriado a partir de ${formatarDataPtBr(referencia.inicio.data)}`;
  leitura.textContent = leituraDaReferencia(referencia, unidade);
  const marcas: MarcaDaCurva[] = referencia.joelho
    ? [{ produtividade: referencia.joelho.produtividade, rotulo: 'ótimo da faina', variante: 'joelho' }]
    : [];
  renderCurveChart(
    corpo,
    referencia.pontos.map((ponto) => ({ produtividade: ponto.produtividade, custo: ponto.custoPorUnidade, periodos: ponto.periodos })),
    unidade,
    marcas,
  );
}

/** O que a curva de referência afirma, sem prometer mais do que ela sustenta. */
function leituraDaReferencia(
  referencia: ReferenciaDaFaina,
  unidade: ReturnType<typeof rotuloDaUnidade>,
): string {
  const variacao = formatarPercentual(referencia.amplitude * 100, 1);
  switch (referencia.forma) {
    case 'JOELHO':
      return `O custo por ${unidade.singular} cai até ${formatarNumero(referencia.joelho!.produtividade)} ${unidade.abreviacao} por terno por período e estabiliza a partir daí: abaixo dessa marca a operação paga a produção mínima garantida, e não o que moveu. Esse é o ótimo da faina.`;
    case 'DECRESCENTE':
      return `Quanto maior a produtividade, menor o custo por ${unidade.singular} — a faina é remunerada por salário-dia, então a equipe custa o mesmo movendo mais ou menos. Não há ponto de virada: terminar antes é sempre mais barato.`;
    case 'CONSTANTE':
      return `O custo por ${unidade.singular} praticamente não muda com a produtividade (${variacao} em toda a faixa). Nesta faina a produtividade define a duração da operação, não o preço unitário.`;
    default:
      return `O custo por ${unidade.singular} varia ${variacao} na faixa, mas o menor valor não está na ponta mais produtiva: o que oscila é em que faixas de jornada a operação cai, não a produtividade. Esta faina não tem um ótimo próprio enquanto não houver produção mínima cadastrada.`;
  }
}

function renderAnaliseDoCenario(
  faina: NonNullable<ReturnType<typeof catalogoPortmac.obterFaina>>,
  unidade: ReturnType<typeof rotuloDaUnidade>,
): void {
  const bloco = document.querySelector<HTMLElement>('#analise-cenario');
  const corpo = document.querySelector<HTMLElement>('#analise-cenario-body');
  const leitura = document.querySelector<HTMLElement>('#analise-cenario-leitura');
  const rodape = document.querySelector<HTMLElement>('#analise-cenario-base');
  const selo = document.querySelector<HTMLElement>('#analise-badge');
  if (!bloco || !corpo || !leitura || !rodape) return;

  const entrada = entradaDoCenarioParaAnalise(faina.codigo);
  bloco.hidden = !entrada;
  if (!entrada) {
    if (selo) selo.textContent = 'informe data, volume e ternos para comparar o seu cenário';
    return;
  }
  // A faixa acompanha a ordem de grandeza da operação: varrer até doze dias
  // encheria o gráfico de durações que ninguém consideraria.
  const ternosPorPeriodo = entrada.ternosPorPeriodoPadrao ?? 1;
  const periodosDoCenario = Math.ceil(entrada.volumeToneladas / (entrada.produtividadeToneladasPorPeriodo * ternosPorPeriodo));
  const grade = gerarGradeDeProdutividades(entrada.volumeToneladas, ternosPorPeriodo, {
    periodosMaximos: Math.max(12, Math.ceil(periodosDoCenario * 2)),
  });
  const otimizacao = otimizarCenario(entrada, catalogoPortmac, calendarioOperacional, grade);
  const melhor = otimizacao.melhor;
  bloco.hidden = otimizacao.candidatos.length < 2 || !melhor;
  if (otimizacao.candidatos.length < 2 || !melhor) {
    if (selo) selo.textContent = 'cenário sem alternativas comparáveis';
    return;
  }

  const informada = entrada.produtividadeToneladasPorPeriodo;
  const noCenario = custoDaProdutividadeInformada(entrada);
  rodape.textContent = `${formatarNumero(entrada.volumeToneladas)} ${unidade.abreviacao} · ${pluralizar(entrada.ternosPorPeriodoPadrao ?? 1, 'terno', 'ternos')} por período · início ${formatarDataPtBr(entrada.inicio.data)} ${entrada.inicio.periodo}`;
  if (selo) {
    selo.textContent = `Melhor duração: ${pluralizar(melhor.periodos, 'período', 'períodos')} a ${formatarNumero(melhor.produtividade)} ${unidade.abreviacao}/terno · ${formatarMoeda(melhor.resultado.custoPorTonelada)} por ${unidade.singular}`;
  }
  leitura.textContent = leituraDoCenario(melhor, informada, noCenario, unidade);

  const marcas: MarcaDaCurva[] = [
    { produtividade: melhor.produtividade, rotulo: 'melhor', variante: 'joelho' },
  ];
  if (informada > 0) marcas.push({ produtividade: informada, rotulo: 'informada', variante: 'cenario' });
  renderCurveChart(
    corpo,
    otimizacao.candidatos.map((candidato) => ({
      produtividade: candidato.produtividade,
      custo: candidato.resultado.custoPorTonelada,
      periodos: candidato.periodos,
    })),
    unidade,
    marcas,
  );
}

function leituraDoCenario(
  melhor: NonNullable<ReturnType<typeof otimizarCenario>['melhor']>,
  informada: number,
  custoInformado: number | undefined,
  unidade: ReturnType<typeof rotuloDaUnidade>,
): string {
  const otimo = melhor.resultado.custoPorTonelada;
  if (custoInformado === undefined) {
    return `Na data e no volume informados, o menor custo por ${unidade.singular} aparece em ${formatarNumero(melhor.produtividade)} ${unidade.abreviacao} por terno por período, fechando em ${pluralizar(melhor.periodos, 'período', 'períodos')}.`;
  }
  const diferenca = custoInformado - otimo;
  if (diferenca <= 0.005) {
    return `A produtividade informada (${formatarNumero(informada)} ${unidade.abreviacao}) já está no melhor ponto desta data e deste volume: ${formatarMoeda(otimo)} por ${unidade.singular}.`;
  }
  const percentual = formatarPercentual((diferenca / custoInformado) * 100, 1);
  return `A ${formatarNumero(informada)} ${unidade.abreviacao} por terno o cenário custa ${formatarMoeda(custoInformado)} por ${unidade.singular}. Fechando em ${pluralizar(melhor.periodos, 'período', 'períodos')} — ${formatarNumero(melhor.produtividade)} ${unidade.abreviacao} por terno — cairia para ${formatarMoeda(otimo)}, ${percentual} menos. A diferença vem das faixas de jornada em que cada duração cai; o modelo não conhece limite de produtividade, então leia a comparação como o que a tabela cobra em cada duração, não como uma meta de berço.`;
}

/** Cenário completo o bastante para varrer produtividades; senão, nada. */
function entradaDoCenarioParaAnalise(codigo: string): EntradaDeSimulacao | undefined {
  const volume = Number(volumeInput.value);
  const produtividade = Number(productivityInput.value);
  const ternos = Number(ternosPorPeriodoInput.value);
  const [ano, mes, dia] = dateInput.value.split('-').map(Number);
  if (!(volume > 0) || !(produtividade > 0)) return undefined;
  if (!Number.isInteger(ternos) || ternos < 1 || ternos > 4) return undefined;
  if (!ano || !mes || !dia || !periodInput.value) return undefined;
  const periodos = Math.ceil(volume / (produtividade * ternos));
  return {
    faina: codigo,
    inicio: { data: data(ano, mes, dia), periodo: periodInput.value },
    volumeToneladas: volume,
    produtividadeToneladasPorPeriodo: produtividade,
    ternosPorPeriodoPadrao: ternos,
    totalDeTernos: ternos * periodos,
  };
}

function custoDaProdutividadeInformada(entrada: EntradaDeSimulacao): number | undefined {
  try {
    return simular(entrada, catalogoPortmac, calendarioOperacional).custoPorTonelada;
  } catch {
    return undefined;
  }
}

function renderCurveChart(
  container: HTMLElement,
  pontos: readonly PontoDaCurva[],
  unidade: ReturnType<typeof rotuloDaUnidade>,
  marcas: readonly MarcaDaCurva[],
): void {
  if (pontos.length < 2) {
    container.removeAttribute('role');
    container.innerHTML = '';
    return;
  }
  const ordenados = [...pontos].sort((a, b) => a.produtividade - b.produtividade);
  const xs = ordenados.map((ponto) => ponto.produtividade);
  const ys = ordenados.map((ponto) => ponto.custo);
  const xMin = Math.min(...xs, ...marcas.map((marca) => marca.produtividade));
  const xMax = Math.max(...xs, ...marcas.map((marca) => marca.produtividade));
  const menor = Math.min(...ys);
  const maior = Math.max(...ys);
  const folga = Math.max((maior - menor) * .18, maior * .04, .01);
  const yMin = Math.max(0, menor - folga);
  const yMax = maior + folga;

  const { esquerda, topo, altura, base } = GRAFICO;
  const x = (valor: number) => xMax === xMin
    ? esquerda + GRAFICO_LARGURA_UTIL / 2
    : esquerda + ((valor - xMin) / (xMax - xMin)) * GRAFICO_LARGURA_UTIL;
  const y = (valor: number) => yMax === yMin
    ? topo + GRAFICO_ALTURA_UTIL / 2
    : topo + GRAFICO_ALTURA_UTIL - ((valor - yMin) / (yMax - yMin)) * GRAFICO_ALTURA_UTIL;
  const grade = gradeHorizontal(y, Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) / 4) * i));
  const linha = ordenados
    .map((ponto, indice) => `${indice === 0 ? 'M' : 'L'} ${x(ponto.produtividade).toFixed(2)} ${y(ponto.custo).toFixed(2)}`)
    .join(' ');
  const passo = passoDeRotulos(ordenados.length, 8);
  const marcadores = ordenados.map((ponto, indice) => {
    const descricao = `${formatarNumero(ponto.produtividade)} ${unidade.abreviacao}/terno/período · ${pluralizar(ponto.periodos, 'período', 'períodos')} · ${formatarMoeda(ponto.custo)} por ${unidade.singular}`;
    return `<circle class="curve-point" cx="${x(ponto.produtividade).toFixed(2)}" cy="${y(ponto.custo).toFixed(2)}" r="3.5"><title>${escapeHtml(descricao)}</title></circle>
      <text class="chart-axis-label chart-axis-label-x" x="${x(ponto.produtividade).toFixed(2)}" y="${altura - base + 22}">${indice % passo === 0 ? escapeHtml(formatarNumero(ponto.produtividade, 0)) : ''}</text>`;
  }).join('');
  const guias = marcas.map((marca) => {
    const posicao = x(marca.produtividade);
    const rotulo = Math.min(Math.max(posicao, esquerda + 26), esquerda + GRAFICO_LARGURA_UTIL - 26);
    return `<line class="curve-guide curve-guide-${marca.variante}" x1="${posicao.toFixed(2)}" y1="${topo}" x2="${posicao.toFixed(2)}" y2="${topo + GRAFICO_ALTURA_UTIL}" />
      <text class="curve-guide-label curve-guide-label-${marca.variante}" x="${rotulo.toFixed(2)}" y="${topo - 10}">${escapeHtml(marca.rotulo)}</text>`;
  }).join('');

  container.setAttribute('role', 'img');
  container.setAttribute('aria-label', `Custo por ${unidade.singular} em função da produtividade, de ${formatarMoeda(menor)} a ${formatarMoeda(maior)}.${marcas.map((marca) => ` ${marca.rotulo} em ${formatarNumero(marca.produtividade)} ${unidade.abreviacao} por terno por período.`).join('')}`);
  container.innerHTML = `<div class="chart-scroll"><svg class="chart-svg" viewBox="0 0 ${GRAFICO.largura} ${altura}" aria-hidden="true" focusable="false">
    <text class="chart-axis-title chart-axis-title-y" x="18" y="${topo + GRAFICO_ALTURA_UTIL / 2}" transform="rotate(-90 18 ${topo + GRAFICO_ALTURA_UTIL / 2})">Custo por ${escapeHtml(unidade.singular)} (R$)</text>
    ${grade}
    ${eixos()}
    ${guias}
    <path class="curve-line" d="${linha}" />
    ${marcadores}
    <text class="chart-axis-title chart-axis-title-x" x="${esquerda + GRAFICO_LARGURA_UTIL / 2}" y="${altura - 12}">Produtividade por terno por período (${escapeHtml(unidade.abreviacao)})</text>
  </svg></div>`;
}

/**
 * Rótulo do eixo de valores, com precisão conforme a ordem de grandeza.
 *
 * Custo por tonelada de sacaria vive entre R$ 2 e R$ 4: arredondar para
 * inteiro faria todos os rótulos virarem "R$ 3" e o eixo não diria nada.
 */
function formatarValorEixo(value: number): string {
  if (value >= 1000) return `R$ ${formatarNumeroFixo(value / 1000, 1)} mil`;
  if (value >= 100) return `R$ ${formatarNumeroFixo(value, 0)}`;
  if (value >= 10) return `R$ ${formatarNumeroFixo(value, 1)}`;
  return `R$ ${formatarNumeroFixo(value, 2)}`;
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
  writeSavedBudgets(budgets);
  if (saveHint) saveHint.textContent = 'Orçamento salvo no cadastro do cliente';
  const button = document.querySelector<HTMLButtonElement>('#save-budget');
  if (button) {
    button.textContent = 'Orçamento salvo';
    button.disabled = true;
  }
}

function writeSavedBudgets(budgets: readonly OrcamentoSalvo[]): void {
  try {
    localStorage.setItem(SAVED_BUDGETS_KEY, JSON.stringify(budgets));
  } catch {
    showError('Não foi possível gravar os orçamentos neste navegador.');
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
  const unidade = rotuloDaUnidade(faina?.unidade);
  const report = document.createElement('section');
  report.className = 'print-report';
  report.innerHTML = `<header class="print-report-header">
    <img src="/brand/portmac-blue.png" alt="PORTMAC" />
    <div><span>SIMULAÇÃO DE CUSTO DE OPERAÇÃO</span><strong>Orçamento salvo</strong></div>
  </header>
  <div class="print-report-client"><span>Cliente</span><strong>${escapeHtml(budget.cliente)}</strong><small>Gerado em ${escapeHtml(formatarDataHora(budget.criadoEm))}</small></div>
  <h1>${escapeHtml(faina?.descricao ?? budget.resultado.entrada.faina)}</h1>
  <p class="print-report-source">${escapeHtml(faina?.fonte ?? 'SCO')} · ${escapeHtml(faina?.vigencia ?? 'provisório')} · ${escapeHtml(faina?.referencia ?? '')}</p>
  <section class="print-report-primary-cost"><span>Custo por ${escapeHtml(unidade.singular)}</span><strong>${formatarMoeda(budget.resultado.custoPorTonelada)}</strong></section>
  <section class="print-report-section"><h2>Dados da operação</h2><div class="print-report-grid">
    <div><span>Início</span><strong>${formatarDataPtBr(budget.resultado.entrada.inicio.data)} · ${escapeHtml(budget.resultado.entrada.inicio.periodo)}</strong></div>
    <div><span>Quantidade</span><strong>${formatarNumero(budget.resultado.entrada.volumeToneladas)} ${unidade.abreviacao}</strong></div>
    <div><span>Produtividade-base</span><strong>${formatarNumero(budget.resultado.entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/terno/período</strong></div>
    <div><span>Períodos</span><strong>${formatarNumero(budget.resultado.quantidadeDePeriodos)}</strong></div>
    <div><span>Ternos por período</span><strong>${formatarNumero(budget.resultado.entrada.ternosPorPeriodoPadrao ?? (budget.resultado.quantidadeDePeriodos ? budget.resultado.entrada.totalDeTernos / budget.resultado.quantidadeDePeriodos : 0))}</strong></div>
    <div><span>Total de ternos</span><strong>${formatarNumero(budget.resultado.entrada.totalDeTernos)}</strong></div>
    <div><span>Custo total</span><strong>${formatarMoeda(budget.resultado.custoTotal)}</strong></div>
  </div></section>
  <section class="print-report-section"><h2>Composição por período</h2><div class="saved-period-table-wrap"><table class="saved-period-table"><thead><tr><th>Data</th><th>Período</th><th>Produtividade / terno</th><th>Produção</th><th>Ternos</th><th>Majoração</th><th>Custo</th></tr></thead><tbody>
    ${budget.resultado.periodos.map((periodo, indice) => `<tr><td>${formatarDataPtBr(periodo.periodo.data)}</td><td>${escapeHtml(periodo.periodo.identificador)}</td><td>${formatarNumero(budget.resultado.entrada.produtividadesPorPeriodo?.[indice] ?? budget.resultado.entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/terno</td><td>${formatarNumero(periodo.producaoToneladas)} ${unidade.abreviacao}</td><td>${formatarNumero(periodo.ternos)}</td><td>${escapeHtml(periodo.custo.majoracao?.descricao ?? 'preço normal')}</td><td>${formatarMoeda(periodo.custo.total)}</td></tr>`).join('')}
  </tbody></table></div></section>
  <section class="print-report-section"><h2>Memória por período</h2><div class="print-period-memory">
    ${budget.resultado.periodos.map((periodo) => `<div class="print-period-memory-block"><h3>${formatarDataPtBr(periodo.periodo.data)} · ${escapeHtml(periodo.periodo.identificador)} · ${formatarMoeda(periodo.custo.total)}</h3>${periodo.custo.memoria.map((linha) => `<div><span>${escapeHtml(linha.descricao)}</span><strong>${formatarMoeda(linha.valor)}</strong></div>`).join('')}</div>`).join('')}
  </div></section>
  ${budget.resultado.custosOpcionais.length ? `<section class="print-report-section"><h2>Custos opcionais</h2><div class="print-memory">${budget.resultado.custosOpcionais.map((custo) => {
    const label = custo.tipo === 'OUTRO' ? custo.descricao?.trim() || optionalCostLabels.OUTRO : optionalCostLabels[custo.tipo];
    return `<div><span>${escapeHtml(label)}</span><strong>${formatarMoeda(custo.custoTotal)}</strong></div>`;
  }).join('')}</div></section>` : ''}
  <section class="print-report-section"><h2>Memória de cálculo</h2><div class="print-memory">${budget.resultado.memoria.map((linha) => `<div><span>${escapeHtml(linha.descricao)}</span><strong>${valorDeMemoria(linha)}</strong></div>`).join('')}</div></section>
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

let quadroDeAjusteAgendado = 0;

/**
 * Coalesce os ajustes do editor em um redesenho por quadro.
 *
 * Um arrasto de slider dispara dezenas de eventos por segundo e cada um
 * recalcula o custo de todos os períodos: em uma operação longa isso derrubava
 * a resposta a ~22 quadros por segundo. Só o último estado de cada quadro
 * interessa.
 */
function agendarAjusteDosPeriodos(): void {
  if (quadroDeAjusteAgendado) return;
  quadroDeAjusteAgendado = requestAnimationFrame(() => {
    quadroDeAjusteAgendado = 0;
    applyPeriodDetails();
  });
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
  // O gráfico é redesenhado antes das validações: é justamente durante um
  // ajuste, com a soma dos ternos fora do total, que ele precisa acompanhar.
  renderEditorChart(periodosDoRascunho(), produtividades, ternos);
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
  const totalVolumeDistribuido = volumeDistribuidoPorPeriodos(produtividades, ternos);
  if (!quaseIgual(totalVolumeDistribuido, volume)) {
    showDistributionError(`O volume distribuído é ${formatarNumero(totalVolumeDistribuido)}; ele precisa ser exatamente ${formatarNumero(volume)}.`);
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
    || !quaseIgual(volumeDistribuidoPorPeriodos(draftProductivities, draftDistribution), volume)
  ) {
    draftProductivities = periodos.length && produtividadeBase > 0 && Number.isFinite(totalTernos)
      ? Array.from({ length: periodos.length }, () => produtividadeBase)
      : [];
  }

  const totalTernosLabel = Number.isFinite(totalTernos)
    ? `${formatarNumero(totalTernos)} ${totalTernos === 1 ? 'terno' : 'ternos'}`
    : 'total de ternos pendente';
  setText('#ternos-editor-count', `${periodos.length} ${periodos.length === 1 ? 'período' : 'períodos'} · ${totalTernosLabel}`);
  renderDistributionTotals(draftProductivities, draftDistribution);
  periodosDoEditor = periodos;
  if (!periodos.length) {
    ternosEditorStatus.textContent = 'Informe volume, produtividade e data válidos para detalhar os períodos.';
    ternosEditorStatus.hidden = false;
    ternosEditorBody.innerHTML = '';
    renderEditorChart([], [], []);
    return;
  }
  const excedeLimite = totalTernos > periodos.length * 4;
  ternosEditorStatus.textContent = excedeLimite
    ? `O máximo é ${periodos.length * 4} ternos para ${pluralizar(periodos.length, 'período', 'períodos')}.`
    : '';
  ternosEditorStatus.hidden = !excedeLimite;
  const unidade = rotuloDaUnidade(catalogoPortmac.obterFaina(fainaCodeInput.value)?.unidade);
  // A tabela só é reconstruída quando a própria sequência de períodos muda.
  // Trocar o innerHTML a cada ajuste destruía o slider sob o cursor e matava o
  // arrasto no instante em que a distribuição voltava a fechar.
  const chave = periodos.map((periodo) => `${formatarData(periodo.data)}#${periodo.identificador}`).join('|');
  if (chave !== chaveDosPeriodosDoEditor || ternosEditorBody.rows.length !== periodos.length) {
    chaveDosPeriodosDoEditor = chave;
    construirLinhasDoEditor(periodos, unidade, excedeLimite);
  }
  atualizarLinhasDoEditor(periodos, excedeLimite, resultado);
  renderEditorChart(periodos, draftProductivities, draftDistribution);
}

function construirLinhasDoEditor(
  periodos: readonly PeriodoOgmo[],
  unidade: ReturnType<typeof rotuloDaUnidade>,
  excedeLimite: boolean,
): void {
  ternosEditorBody.innerHTML = periodos.map((periodo) => `
      <tr>
        <td>${escapeHtml(periodo.identificador)}</td>
        <td>${formatarDataPtBr(periodo.data)}</td>
        <td>
          <label class="period-productivity-control">
            <input class="productivity-period-input" id="produtividade-${periodo.indice}" data-period-index="${periodo.indice}" type="number" min="0.01" step="0.01" aria-label="Produtividade no ${escapeHtml(periodo.identificador)} de ${formatarDataPtBr(periodo.data)}" />
            <span>${escapeHtml(unidade.abreviacao)} / terno / período</span>
          </label>
        </td>
        <td>
          <div class="ternos-control">
            <input class="ternos-input" id="ternos-${periodo.indice}" data-period-index="${periodo.indice}" type="range" min="0" max="4" step="1" aria-label="Ternos no ${escapeHtml(periodo.identificador)} de ${formatarDataPtBr(periodo.data)}" ${excedeLimite ? 'disabled' : ''} />
            <output class="ternos-value" for="ternos-${periodo.indice}"></output>
          </div>
        </td>
        <td class="period-premium-cell"></td>
        <td></td>
      </tr>
    `).join('');

  ternosEditorBody.querySelectorAll<HTMLInputElement>('.ternos-input').forEach((input) => {
    input.addEventListener('input', () => {
      const saida = input.closest('.ternos-control')?.querySelector<HTMLOutputElement>('.ternos-value');
      if (saida) {
        saida.value = input.value;
        saida.textContent = input.value;
      }
      agendarAjusteDosPeriodos();
    });
  });
  ternosEditorBody.querySelectorAll<HTMLInputElement>('.productivity-period-input').forEach((input) => {
    input.addEventListener('input', () => agendarAjusteDosPeriodos());
  });
}

/**
 * Escreve nas linhas existentes os valores do rascunho e o que o cálculo já
 * sabe. Um campo em foco nunca é sobrescrito: é o campo que o usuário está
 * mexendo agora.
 */
function atualizarLinhasDoEditor(
  periodos: readonly PeriodoOgmo[],
  excedeLimite: boolean,
  resultado?: ResultadoDeSimulacao,
): void {
  const produtividadeBase = numberOf('#produtividade');
  periodos.forEach((periodo, indice) => {
    const linha = ternosEditorBody.rows[indice];
    if (!linha) return;
    const ternos = Math.min(4, Math.max(0, draftDistribution[indice] ?? 0));
    const produtividade = draftProductivities[indice] ?? produtividadeBase;

    const campoProdutividade = linha.querySelector<HTMLInputElement>('.productivity-period-input');
    if (campoProdutividade && campoProdutividade !== document.activeElement) {
      const texto = Number.isFinite(produtividade) ? String(produtividade) : '';
      if (campoProdutividade.value !== texto) campoProdutividade.value = texto;
    }

    const campoTernos = linha.querySelector<HTMLInputElement>('.ternos-input');
    if (campoTernos) {
      campoTernos.disabled = excedeLimite;
      if (campoTernos !== document.activeElement && campoTernos.value !== String(ternos)) {
        campoTernos.value = String(ternos);
      }
    }
    const saida = linha.querySelector<HTMLOutputElement>('.ternos-value');
    if (saida) {
      const valor = campoTernos?.value ?? String(ternos);
      saida.value = valor;
      saida.textContent = valor;
    }

    const calculado = resultado?.periodos[indice];
    const celulaMajoracao = linha.querySelector<HTMLElement>('.period-premium-cell');
    if (celulaMajoracao) {
      celulaMajoracao.innerHTML = calculado
        ? `<span class="period-premium">${escapeHtml(calculado.custo.majoracao?.descricao ?? 'dia normal · preço normal')}</span><small>tabela ${escapeHtml(calculado.custo.majoracao?.fonte ?? 'ACT')}</small>`
        : '<span class="period-pending">a calcular</span>';
    }
    const celulaCusto = linha.cells[linha.cells.length - 1];
    if (celulaCusto) celulaCusto.textContent = calculado ? formatarMoeda(calculado.custo.total) : '—';
  });
}

/** Períodos que o editor está exibindo agora, sem reprojetar o calendário. */
function periodosDoRascunho(): readonly PeriodoOgmo[] {
  return periodosDoEditor;
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

function distribuirTernosLocal(total: number, periodos: number): readonly number[] {
  if (periodos <= 0 || !Number.isFinite(total)) return [];
  const base = Math.floor(total / periodos);
  const sobras = total % periodos;
  return Array.from({ length: periodos }, (_, indice) => base + (indice >= periodos - sobras ? 1 : 0));
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
  const totalVolume = volumeDistribuidoPorPeriodos(produtividades, ternos);
  const totalTernos = ternos.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const totalTernosEsperado = totalTernosCalculado();
  const unidade = abreviacao ?? rotuloDaUnidade(catalogoPortmac.obterFaina(fainaCodeInput.value)?.unidade).abreviacao;
  ternosEditorVolumeTotal.textContent = `${formatarNumero(totalVolume)} ${unidade}`;
  ternosEditorVolumeTarget.textContent = `${formatarNumero(volume)} ${unidade}`;
  ternosEditorTernosTotal.textContent = formatarNumero(totalTernos);
  ternosEditorTernosTarget.textContent = Number.isFinite(totalTernosEsperado) ? formatarNumero(totalTernosEsperado) : '—';
  ternosEditorVolumeTotal.parentElement?.classList.toggle('is-valid', quaseIgual(totalVolume, volume));
  ternosEditorTernosTotal.parentElement?.classList.toggle('is-valid', totalTernos === totalTernosEsperado);
}

/**
 * Produção de cada período, na mesma ordem em que o simulador a distribui:
 * capacidade do período limitada pelo que ainda resta do navio.
 */
function producoesPorPeriodo(
  produtividades: readonly number[],
  ternos: readonly number[],
): number[] {
  let restante = numberOf('#volume');
  return produtividades.map((produtividade, indice) => {
    const quantidadeDeTernos = ternos[indice] ?? Number.NaN;
    if (
      !Number.isFinite(produtividade) || produtividade <= 0
      || !Number.isFinite(quantidadeDeTernos) || quantidadeDeTernos < 0
    ) return 0;
    const producao = Math.min(produtividade * quantidadeDeTernos, Math.max(0, restante));
    restante -= producao;
    return producao;
  });
}

function volumeDistribuidoPorPeriodos(
  produtividades: readonly number[],
  ternos: readonly number[],
): number {
  return producoesPorPeriodo(produtividades, ternos).reduce((soma, producao) => soma + producao, 0);
}

/**
 * Custo do rascunho, período a período, sem passar pelo `simular`.
 *
 * O gráfico ao vivo precisa responder no meio de um ajuste — quando a soma dos
 * ternos ainda não fecha e a simulação recusaria a entrada. O catálogo calcula
 * um período isolado sem exigir que a operação inteira esteja consistente.
 */
function montarBarrasDoRascunho(
  periodos: readonly PeriodoOgmo[],
  produtividades: readonly number[],
  ternos: readonly number[],
): BarraDoCenario[] {
  const faina = catalogoPortmac.obterFaina(fainaCodeInput.value);
  const producoes = producoesPorPeriodo(produtividades, ternos);
  return periodos.map((periodo, indice) => {
    const producao = producoes[indice] ?? 0;
    const ternosDoPeriodo = ternos[indice] ?? 0;
    const majoracao = faina ? majoracaoDoPeriodoProjetado(periodo, faina.fonte) : undefined;
    let custo: number | undefined;
    if (faina) {
      try {
        custo = catalogoPortmac.calcularCustoDoPeriodo({
          faina,
          periodo,
          producaoToneladas: producao,
          ternos: ternosDoPeriodo,
          ...(majoracao ? { majoracao } : {}),
        }).total;
      } catch {
        // Faina sem regra habilitada: o gráfico cai para produção no eixo.
        custo = undefined;
      }
    }
    return { periodo, producao, ternos: ternosDoPeriodo, majoracao, custo };
  });
}

/** Redesenha o gráfico do editor a cada ajuste, válido o rascunho ou não. */
function renderEditorChart(
  periodos: readonly PeriodoOgmo[],
  produtividades: readonly number[],
  ternos: readonly number[],
): void {
  const container = document.querySelector<HTMLDivElement>('#editor-chart-body');
  const summary = document.querySelector<HTMLElement>('#editor-chart-summary');
  const wrapper = document.querySelector<HTMLElement>('#editor-chart');
  if (!container || !summary || !wrapper) return;
  const pronto = periodos.length > 0 && produtividades.length === periodos.length && ternos.length === periodos.length;
  wrapper.hidden = !pronto;
  if (!pronto) {
    renderScenarioChart(container, [], rotuloDaUnidade());
    return;
  }
  const unidade = rotuloDaUnidade(catalogoPortmac.obterFaina(fainaCodeInput.value)?.unidade);
  const barras = montarBarrasDoRascunho(periodos, produtividades, ternos);
  const custoDoRascunho = barras.reduce((soma, barra) => soma + (barra.custo ?? 0), 0);
  const temCusto = barras.every((barra) => barra.custo !== undefined);
  const ternosDistribuidos = ternos.reduce((soma, valor) => soma + (Number.isFinite(valor) ? valor : 0), 0);
  // Um período com terno alocado e produção zero é capacidade requisitada que
  // não move carga — a barra some do gráfico, então o aviso vai no resumo.
  const ociosos = barras.filter((barra) => barra.ternos > 0 && barra.producao <= 0).length;
  const aviso = ociosos ? ` · ${pluralizar(ociosos, 'período sem produção', 'períodos sem produção')}` : '';
  summary.textContent = temCusto
    ? `Mão de obra do rascunho ${formatarMoeda(custoDoRascunho)} · ${pluralizar(ternosDistribuidos, 'terno', 'ternos')}${aviso}`
    : `${pluralizar(ternosDistribuidos, 'terno', 'ternos')} distribuídos${aviso}`;
  renderScenarioChart(container, barras, unidade);
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
  agendarAnalise();
}

function handleFainaInput(): void {
  fainaCodeInput.value = '';
  markScenarioDirty();
  renderFainaOptions();
  openFainaOptions();
  updateOperationUnitLabels();
  agendarAnalise();
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
          <div><span>${escapeHtml(label)}</span><small>${formatarMoeda(custo.custoPorTonelada)} / ${rotuloDaUnidade(catalogoPortmac.obterFaina(resultado.entrada.faina)?.unidade).abreviacao}</small></div>
          <strong>${formatarMoeda(custo.custoTotal)}</strong>
        </div>
      `;
    }).join('')
    : '<p class="no-optional-costs">Nenhum custo opcional ativado.</p>';
}

function renderCalculationMemory(resultado: ResultadoDeSimulacao): void {
  const container = document.querySelector<HTMLDivElement>('#calculation-memory-lines')!;
  const unidade = rotuloDaUnidade(catalogoPortmac.obterFaina(resultado.entrada.faina)?.unidade);
  const summary = resultado.memoria.map((linha) => `
    <div class="memory-line">
      <span>${escapeHtml(linha.descricao)}</span>
      <strong>${valorDeMemoria(linha)}</strong>
    </div>
  `).join('');
  const periods = resultado.periodos.map((periodo, indice) => `
    <details class="memory-period">
      <summary>${formatarDataPtBr(periodo.periodo.data)} · ${escapeHtml(periodo.periodo.identificador)} · produção ${formatarNumero(periodo.producaoToneladas)} ${unidade.abreviacao} · ${formatarMoeda(periodo.custo.total)}</summary>
      <div class="memory-period-lines">
        <div class="memory-line">
          <span>Produtividade por terno</span>
          <strong>${formatarNumero(resultado.entrada.produtividadesPorPeriodo?.[indice] ?? resultado.entrada.produtividadeToneladasPorPeriodo)} ${unidade.abreviacao}/terno/período</strong>
        </div>
        <div class="memory-line">
          <span>Ternos alocados</span>
          <strong>${formatarNumero(periodo.ternos)}</strong>
        </div>
        <div class="memory-line">
          <span>Produção movimentada no período</span>
          <strong>${formatarNumero(periodo.producaoToneladas)} ${unidade.abreviacao}</strong>
        </div>
        ${periodo.custo.memoria.map((linha) => `
          <div class="memory-line">
            <span>${escapeHtml(linha.descricao)}</span>
            <strong>${formatarMoeda(linha.valor)}</strong>
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

/** Uma linha de memória é dinheiro salvo indicação em contrário. */
function valorDeMemoria(linha: LinhaDeMemoria): string {
  return linha.formato === 'QUANTIDADE' ? formatarNumero(linha.valor) : formatarMoeda(linha.valor);
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
  setText('#total-ternos', Number.isInteger(totalTernos) && totalTernos > 0 ? formatarNumero(totalTernos) : '—');
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

function valueOf<T extends HTMLInputElement | HTMLSelectElement>(selector: string): string {
  return document.querySelector<T>(selector)!.value;
}

function numberOf(selector: string): number { return Number(valueOf<HTMLInputElement>(selector)); }
function setText(selector: string, value: string): void { document.querySelector<HTMLElement>(selector)!.textContent = value; }
function normalizarBusca(value: string | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function updateOperationUnitLabels(): void {
  const faina = catalogoPortmac.obterFaina(fainaCodeInput.value);
  const unidade = rotuloDaUnidade(faina?.unidade);
  // Sem faina escolhida a unidade ainda não existe: dizer "un" seria inventá-la.
  const abreviacao = faina ? unidade.abreviacao : '';
  setText('#volume-field-label', faina ? unidade.grandeza : 'Quantidade do navio');
  setText('#volume-field-hint', faina
    ? `quantidade total a movimentar, em ${unidade.plural}`
    : 'selecione a faina para definir a unidade');
  // O campo é lido como produtividade por terno em todo o motor; chamá-lo de
  // "capacidade por período" fazia o rótulo contradizer a própria fórmula.
  setText('#productivity-field-hint', abreviacao
    ? `${abreviacao} por terno em um período de 6 h`
    : 'quantidade por terno em um período de 6 h');
}
function clearError(): void { errorBox.hidden = true; errorBox.textContent = ''; }
function showError(message: string): void { errorBox.textContent = message; errorBox.hidden = false; }
