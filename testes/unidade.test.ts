import { describe, expect, it } from 'vitest';
import { DESCRITORES_DE_UNIDADE, obterUnidade } from '../src/dominio/unidade.js';

describe('descritores de unidades', () => {
  it('retorna os metadados corretos para TON', () => {
    const info = obterUnidade('TON');
    expect(info.singular).toBe('tonelada');
    expect(info.plural).toBe('toneladas');
    expect(info.abreviacao).toBe('ton');
  });

  it('retorna os metadados corretos para CONTAINER', () => {
    const info = obterUnidade('CONTAINER');
    expect(info.singular).toBe('container');
    expect(info.plural).toBe('contêineres');
    expect(info.abreviacao).toBe('contêiner(es)');
  });

  it('retorna os metadados corretos para EQUIPE', () => {
    const info = obterUnidade('EQUIPE');
    expect(info.singular).toBe('equipe');
    expect(info.plural).toBe('equipes');
    expect(info.abreviacao).toBe('equipe(s)');
  });

  it('retorna os metadados corretos para UNIDADE', () => {
    const info = obterUnidade('UNIDADE');
    expect(info.singular).toBe('unidade');
    expect(info.plural).toBe('unidades');
    expect(info.abreviacao).toBe('unid.');
  });

  it('retorna TON como fallback para unidade desconhecida ou indefinida', () => {
    expect(obterUnidade(undefined)).toEqual(DESCRITORES_DE_UNIDADE.TON);
    expect(obterUnidade('DESCONHECIDA')).toEqual(DESCRITORES_DE_UNIDADE.TON);
  });
});
