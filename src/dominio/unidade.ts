import type { UnidadeDeMedida } from './tipos.js';

export interface UnidadeInfo {
  readonly singular: string;
  readonly plural: string;
  readonly abreviacao: string;
}

export const DESCRITORES_DE_UNIDADE: Readonly<Record<UnidadeDeMedida, UnidadeInfo>> = {
  TON: { singular: 'tonelada', plural: 'toneladas', abreviacao: 'ton' },
  UNIDADE: { singular: 'unidade', plural: 'unidades', abreviacao: 'unid.' },
  CONTAINER: { singular: 'container', plural: 'contêineres', abreviacao: 'contêiner(es)' },
  EQUIPE: { singular: 'equipe', plural: 'equipes', abreviacao: 'equipe(s)' },
  VOLUME: { singular: 'volume', plural: 'volumes', abreviacao: 'volume(s)' },
  INDEFINIDA: { singular: 'unidade', plural: 'unidades', abreviacao: 'unid.' },
};

export function obterUnidade(unidade?: string): UnidadeInfo {
  if (unidade && unidade in DESCRITORES_DE_UNIDADE) {
    return DESCRITORES_DE_UNIDADE[unidade as UnidadeDeMedida];
  }
  return DESCRITORES_DE_UNIDADE.TON;
}
