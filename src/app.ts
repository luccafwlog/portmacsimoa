import './styles.css';
import { data, formatarDataPtBr } from './dominio/tempo.js';
import { calendarioDemo } from './calendario/demo.js';
import type { CatalogoOgmo } from './catalogo/portas.js';
import type { EntradaDeSimulacao, ResultadoDeSimulacao } from './dominio/tipos.js';
import { simular } from './motor/simulador.js';

const demoCatalogo: CatalogoOgmo = {
  obterFaina(codigo) {
    return codigo === 'GRANITO' ? { codigo, descricao: 'Granito', unidade: 'TON' } : undefined;
  },
  calcularCustoDoPeriodo({ producaoToneladas, ternos, periodo }) {
    const custo = producaoToneladas * 10 + ternos * 100 * periodo.multiplicador;
    return {
      total: custo,
      memoria: [{ descricao: 'Custo fictício do catálogo de demonstração', valor: custo }],
    };
  },
};

const form = document.querySelector<HTMLFormElement>('#simulation-form')!;
const errorBox = document.querySelector<HTMLDivElement>('#error')!;
const emptyState = document.querySelector<HTMLElement>('#empty-state')!;
const resultState = document.querySelector<HTMLElement>('#result-state')!;
const distributionStatus = document.querySelector<HTMLDivElement>('#distribution-status')!;
const volumeInput = document.querySelector<HTMLInputElement>('#volume')!;
const productivityInput = document.querySelector<HTMLInputElement>('#produtividade')!;
let currentResult: ResultadoDeSimulacao | undefined;

form.addEventListener('submit', (event) => {
  event.preventDefault();
  recalculate();
});
volumeInput.addEventListener('input', updateCalculatedPeriods);
productivityInput.addEventListener('input', updateCalculatedPeriods);
updateCalculatedPeriods();

function recalculate(distribution?: readonly number[]): void {
  clearError();
  try {
    const entrada = readInput(distribution);
    currentResult = simular(entrada, demoCatalogo, calendarioDemo);
    render(currentResult);
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Não foi possível calcular este cenário.');
  }
}

function readInput(distribution?: readonly number[]): EntradaDeSimulacao {
  const dateValue = valueOf<HTMLInputElement>('#data');
  const [ano, mes, dia] = dateValue.split('-').map(Number);
  const cliente = valueOf<HTMLInputElement>('#cliente').trim();
  return {
    ...(cliente ? { cliente } : {}),
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
  setText('#result-faina', resultado.entrada.faina === 'GRANITO' ? 'Granito' : resultado.entrada.faina);
  setText('#result-client', resultado.entrada.cliente ? `Cliente: ${resultado.entrada.cliente}` : 'Cliente não informado');
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
          <input class="ternos-input" data-period-index="${periodo.periodo.indice}" type="range" min="1" max="3" step="1" value="${periodo.ternos}" aria-label="Ternos no ${periodo.periodo.identificador}" />
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
  if (values.some((value) => !Number.isInteger(value) || value < 1 || value > 3)) {
    showDistributionError('Cada período deve ter entre 1 e 3 ternos.');
    return;
  }
  if (total !== currentResult.entrada.totalDeTernos) {
    showDistributionError(`A soma atual é ${total}; ela precisa permanecer em ${currentResult.entrada.totalDeTernos}.`);
    return;
  }
  recalculate(values);
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
