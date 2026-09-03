export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

export function number(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

export function money(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function normalizarBusca(value: string | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function formatarValorEixo(value: number): string {
  if (value >= 1000) return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(value).toLocaleString('pt-BR')}`;
}

export function formatarDataHora(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function setText(selector: string, value: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  if (el) el.textContent = value;
}

export function valueOf<T extends HTMLInputElement | HTMLSelectElement>(selector: string): string {
  return document.querySelector<T>(selector)!.value;
}

export function numberOf(selector: string): number {
  return Number(valueOf<HTMLInputElement>(selector));
}

export function quaseIgual(a: number, b: number, epsilon = 0.0001): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon;
}
