import { describe, expect, it } from 'vitest';
import { data } from '../src/dominio/tempo.js';
import type { PeriodoOgmo } from '../src/dominio/tipos.js';
import {
  CatalogoPortmac,
  cotasDaCategoria,
  fainasAct,
  producaoQueIgualaOPiso,
  type RegistroDeFaina,
} from '../src/catalogo/portmac.js';
import {
  COTAS_DA_ESTIVA_DE_TESTE,
  PISO_DA_ESTIVA_DE_TESTE,
  TAXA_DA_ESTIVA_DE_TESTE,
  fainaComConferentes,
  fainaDeProducao,
  fainaDeSalarioDia,
} from './fainas-de-teste.js';

const diaNormal: PeriodoOgmo = {
  indice: 0,
  data: data(2026, 9, 8),
  identificador: '07-13',
};

function custoDe(registro: RegistroDeFaina, producao: number, ternos: number) {
  return new CatalogoPortmac([registro]).calcularCustoDoPeriodo({
    faina: registro,
    periodo: diaNormal,
    producaoToneladas: producao,
    ternos,
  });
}

describe('custo de um período', () => {
  it('cobra a produção quando ela supera o salário-dia', () => {
    // 900 t em 1 terno: 2 × 900 = 1.800 por cota, acima do piso de 1.000.
    const custo = custoDe(fainaDeProducao, 900, 1);

    expect(custo.total).toBeCloseTo(COTAS_DA_ESTIVA_DE_TESTE * TAXA_DA_ESTIVA_DE_TESTE * 900, 6);
    expect(custo.memoria[0]?.descricao).toContain('por unidade e por cota');
  });

  it('cobra o salário-dia quando a produção não o alcança', () => {
    // 100 t em 1 terno: 2 × 100 = 200 por cota, abaixo do piso de 1.000.
    const custo = custoDe(fainaDeProducao, 100, 1);

    expect(custo.total).toBeCloseTo(COTAS_DA_ESTIVA_DE_TESTE * PISO_DA_ESTIVA_DE_TESTE, 6);
    expect(custo.memoria[0]?.descricao).toContain('salário-dia');
  });

  it('compara o piso terno a terno, não sobre a produção agregada', () => {
    // A mesma tonelagem em dois ternos dá metade da produção em cada um: cada
    // terno cai no piso e o período custa o dobro do que custaria com um terno.
    const umTerno = custoDe(fainaDeProducao, 800, 1).total;
    const doisTernos = custoDe(fainaDeProducao, 800, 2).total;

    expect(umTerno).toBeCloseTo(COTAS_DA_ESTIVA_DE_TESTE * 2 * 800, 6);
    expect(doisTernos).toBeCloseTo(2 * COTAS_DA_ESTIVA_DE_TESTE * PISO_DA_ESTIVA_DE_TESTE, 6);
    expect(doisTernos).toBeGreaterThan(umTerno);
  });

  it('não muda o custo ao dividir em ternos enquanto todos ficam acima do piso', () => {
    // 4.000 t: 2.000 por terno, muito acima do piso. A taxa é por cota e a
    // produção total é a mesma, então o número de ternos não altera o preço.
    expect(custoDe(fainaDeProducao, 4000, 2).total)
      .toBeCloseTo(custoDe(fainaDeProducao, 4000, 1).total, 6);
  });

  it('paga o salário-dia por terno na faina sem produção', () => {
    expect(custoDe(fainaDeSalarioDia, 0, 1).total).toBeCloseTo(5 * 500, 6);
    expect(custoDe(fainaDeSalarioDia, 9999, 2).total).toBeCloseTo(2 * 5 * 500, 6);
  });

  it('soma estiva e conferentes', () => {
    const comConferentes = custoDe(fainaComConferentes, 4000, 1).total;
    const soEstiva = custoDe(fainaDeProducao, 4000, 1).total;

    // Conferentes: taxa da equipe, 5 × 4.000 = 20.000, acima do piso.
    expect(comConferentes - soEstiva).toBeCloseTo(5 * 4000, 6);
  });

  it('não multiplica a taxa de equipe dos conferentes pelas cotas nem pelos ternos', () => {
    const custo = custoDe(fainaComConferentes, 4000, 3);
    const conferentes = custo.memoria[1]!;

    expect(conferentes.descricao).toContain('para a equipe');
    expect(conferentes.valor).toBeCloseTo(5 * 4000, 6);
  });

  it('conta o chefe uma vez por navio e a lingada em cada terno', () => {
    const conferentes = fainaComConferentes.regra!.conferentes!;

    expect(cotasDaCategoria(conferentes, 1)).toBe(3);
    expect(cotasDaCategoria(conferentes, 3)).toBe(5);
  });

  it('aplica a majoração do período sobre as duas categorias', () => {
    const domingo = new CatalogoPortmac([fainaComConferentes]).calcularCustoDoPeriodo({
      faina: fainaComConferentes,
      periodo: { ...diaNormal, data: data(2026, 9, 6) },
      producaoToneladas: 4000,
      ternos: 1,
    });

    expect(domingo.majoracao?.adicionalPercentual).toBe(87.5);
    expect(domingo.total).toBeCloseTo(custoDe(fainaComConferentes, 4000, 1).total * 1.875, 6);
  });

  it('recusa uma faina que não está no catálogo', () => {
    const catalogo = new CatalogoPortmac([fainaDeProducao]);

    expect(() => catalogo.calcularCustoDoPeriodo({
      faina: fainaDeSalarioDia,
      periodo: diaNormal,
      producaoToneladas: 10,
      ternos: 1,
    })).toThrow(/não está no catálogo/);
  });
});

describe('catálogo da ACT 2026/2028', () => {
  it('cadastra as doze fainas do acordo', () => {
    expect(fainasAct).toHaveLength(12);
    expect(new Set(fainasAct.map((faina) => faina.codigo)).size).toBe(12);
    expect(fainasAct.every((faina) => faina.fonte === 'ACT')).toBe(true);
    expect(fainasAct.every((faina) => faina.vigencia === '2026/2028')).toBe(true);
  });

  it('traz as cinco composições de granéis com a mesma taxa', () => {
    const graneis = fainasAct.filter((faina) => faina.codigo.startsWith('ACT_GRANEIS_'));
    expect(graneis).toHaveLength(5);
    expect(new Set(graneis.map((faina) => faina.regra!.estiva.taxa))).toEqual(new Set([0.48]));
    expect(graneis.map((faina) => cotasDaCategoria(faina.regra!.estiva, 1)))
      .toEqual([3.5, 3.5, 5.5, 7.5, 11.5]);
  });

  it('reencontra o joelho de 640 t dos granéis a partir do salário-dia', () => {
    // A curva legada da PORTMAC estabilizava perto de 650 t por terno e o
    // projeto tratava isso como uma produção mínima não documentada. O que
    // dobra a curva é salário-dia ÷ taxa, e o número sai do próprio Anexo I.
    const graneis = fainasAct.find((faina) => faina.codigo === 'ACT_GRANEIS_1')!;
    expect(producaoQueIgualaOPiso(graneis.regra!.estiva)).toBeCloseTo(306.97 / 0.48, 6);
    expect(producaoQueIgualaOPiso(graneis.regra!.estiva)).toBeGreaterThan(600);
    expect(producaoQueIgualaOPiso(graneis.regra!.estiva)).toBeLessThan(680);
  });

  it('cobra a taxa dos conferentes de granito sem multiplicar pelas cotas', () => {
    const granito = fainasAct.find((faina) => faina.codigo === 'ACT_5_1_GRANITO')!;
    // 4.000 t em 1 terno: conferentes 3,01 × 4.000 = 12.040, acima do piso de
    // 4,15 cotas × 410,14. Multiplicar pelas cotas cobraria 15× a mais.
    const custo = custoDe(granito, 4000, 1);
    const conferentes = custo.memoria[1]!;

    expect(conferentes.valor).toBeCloseTo(3.01 * 4000, 6);
  });

  it('cobra a peação como salário-dia por terno, sem produção', () => {
    const peacao = fainasAct.find((faina) => faina.codigo === 'ACT_19_3_PEACAO')!;

    expect(peacao.regra!.estiva.taxa).toBeUndefined();
    expect(peacao.regra!.conferentes).toBeUndefined();
    expect(custoDe(peacao, 0, 2).total).toBeCloseTo(2 * 5.5 * 515.20, 6);
  });

  it('mantém o chefe de conferentes fora da multiplicação por ternos', () => {
    const granito = fainasAct.find((faina) => faina.codigo === 'ACT_5_1_GRANITO')!;
    const conferentes = granito.regra!.conferentes!;

    // chefe 2,0 + ajudante 1,15 por navio; lingada 1,0 em cada terno.
    expect(cotasDaCategoria(conferentes, 1)).toBeCloseTo(4.15, 6);
    expect(cotasDaCategoria(conferentes, 4)).toBeCloseTo(7.15, 6);
  });
});
