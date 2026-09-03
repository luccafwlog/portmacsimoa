import type { CatalogoOgmo } from '../catalogo/portas.js';
import type { PeriodoOgmo, ResultadoDeSimulacao } from '../dominio/tipos.js';
import { formatarDataPtBr } from '../dominio/tempo.js';
import { obterUnidade } from '../dominio/unidade.js';
import { distribuirTernos } from '../motor/simulador.js';
import { escapeHtml, money, number, quaseIgual, setText } from './formato.js';

export interface EditorPeriodosState {
  draftDistribution: readonly number[];
  draftProductivities: readonly number[];
}

export function volumeDistribuidoPorPeriodos(
  produtividades: readonly number[],
  ternos: readonly number[],
  volumeTotal: number,
): number {
  let restante = volumeTotal;
  let total = 0;
  produtividades.forEach((produtividade, indice) => {
    if (!Number.isFinite(produtividade) || produtividade <= 0) return;
    const quantidadeDeTernos = ternos[indice] ?? Number.NaN;
    if (!Number.isFinite(quantidadeDeTernos) || quantidadeDeTernos < 0) return;
    const capacidade = produtividade * quantidadeDeTernos;
    const producao = Math.min(capacidade, Math.max(0, restante));
    total += producao;
    restante -= producao;
  });
  return total;
}

export function renderDistributionTotals(
  produtividades: readonly number[],
  ternos: readonly number[],
  volume: number,
  totalTernosEsperado: number,
  unidadeAbreviacao: string,
): void {
  const volumeTotalEl = document.querySelector<HTMLElement>('#ternos-editor-volume-total');
  const volumeTargetEl = document.querySelector<HTMLElement>('#ternos-editor-volume-target');
  const ternosTotalEl = document.querySelector<HTMLElement>('#ternos-editor-ternos-total');
  const ternosTargetEl = document.querySelector<HTMLElement>('#ternos-editor-ternos-target');

  if (!volumeTotalEl || !volumeTargetEl || !ternosTotalEl || !ternosTargetEl) return;

  const totalVolume = volumeDistribuidoPorPeriodos(produtividades, ternos, volume);
  const totalTernos = ternos.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);

  volumeTotalEl.textContent = `${number(totalVolume)} ${unidadeAbreviacao}`;
  volumeTargetEl.textContent = `${number(volume)} ${unidadeAbreviacao}`;
  ternosTotalEl.textContent = number(totalTernos);
  ternosTargetEl.textContent = Number.isFinite(totalTernosEsperado) ? number(totalTernosEsperado) : '—';
  volumeTotalEl.parentElement?.classList.toggle('is-valid', quaseIgual(totalVolume, volume));
  ternosTotalEl.parentElement?.classList.toggle('is-valid', totalTernos === totalTernosEsperado);
}

export function showDistributionError(message: string): void {
  const ternosEditorStatus = document.querySelector<HTMLDivElement>('#ternos-editor-status');
  if (ternosEditorStatus) {
    ternosEditorStatus.textContent = message;
    ternosEditorStatus.hidden = false;
  }
}
