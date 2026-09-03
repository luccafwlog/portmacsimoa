import type { CatalogoPortmac, RegistroDeFaina } from '../catalogo/portmac.js';
import type { RegraDeComposicaoProvisoria } from '../dominio/tipos.js';
import { escapeHtml, money, normalizarBusca, number, setText } from './formato.js';

export function renderCatalogPage(
  catalogo: CatalogoPortmac,
  termoBusca: string,
  catalogSourceFilter: 'TODAS' | 'ACT' | 'CCT',
): void {
  const registros = catalogo.listarRegistros();
  const tableBody = document.querySelector<HTMLTableSectionElement>('#catalog-table-body');
  if (!tableBody) return;

  const actCount = registros.filter((registro) => registro.fonte === 'ACT').length;
  const cctCount = registros.filter((registro) => registro.fonte === 'CCT').length;
  const termo = normalizarBusca(termoBusca);
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
  setText('#catalog-total-fainas', String(registros.length));
  setText('#catalog-act-count', String(actCount));
  setText('#catalog-total-act', String(actCount));
  setText('#catalog-cct-count', String(cctCount));
  setText('#catalog-total-cct', String(cctCount));
  setText('#catalog-visible-count', `${filtrados.length} ${filtrados.length === 1 ? 'faina encontrada' : 'fainas encontradas'}`);

  tableBody.innerHTML = filtrados.length ? filtrados.map((registro) => {
    const regraPlanilha = registro.regra ?? registro.regraActProvisoria ?? registro.regraCctProvisoria;
    const status = registro.status === 'PENDENTE_DE_VALIDACAO' || !regraPlanilha
      ? '<span class="pending-pill">Pendente</span><small>aguarda validação</small>'
      : registro.status === 'PROVISORIA'
        ? '<span class="pending-pill">Provisória</span><small>aguarda documento oficial</small>'
        : '<span class="ready-pill">Disponível</span><small>regra habilitada</small>';
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
      <td>${regraPlanilha ? `<span class="rule-value">${money(regraPlanilha.taxaBase)}</span><small>${regraPlanilha.baseDeCalculo === 'TARIFA_UNITARIA' ? 'tarifa unitária; não multiplicada por cotas' : 'cotas da equipe'} · ${regraPlanilha.regime === 'PRODUCAO' ? 'produção' : 'salário-dia'} · +${number(regraPlanilha.encargosContribuicaoAdicional * 100)}% encargos</small>` : '<span class="pending-rule">Regra não habilitada</span><small>transcrição documental</small>'}</td>
    </tr>
    <tr id="${detailsId}" class="catalog-details-row" hidden>
      <td colspan="5">${regraPlanilha ? renderCatalogMethod(registro, regraPlanilha) : '<div class="catalog-method-body"><p>Esta faina ainda não possui uma regra de custo habilitada.</p></div>'}</td>
    </tr>
  `;
  }).join('') : '<tr><td colspan="5" class="catalog-empty-result">Nenhuma faina corresponde aos filtros atuais.</td></tr>';
}

export function renderCatalogMethod(
  registro: RegistroDeFaina,
  regra: RegraDeComposicaoProvisoria,
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
    <p class="catalog-method-note">${regra.regime === 'PRODUCAO'
      ? 'A produtividade informada é por terno; a produção do período já representa a soma da produtividade dos ternos alocados e não é multiplicada novamente.'
      : 'A remuneração é calculada por terno e multiplicada pela quantidade de ternos do período.'}</p>
    <ul>${composition}</ul>
  </div>`;
}
