import { describe, expect, it } from 'vitest';
import { diaDaSemana, somarDias } from '../src/dominio/tempo.js';
import { ehFeriadoVilaVelha } from '../src/calendario/feriados.js';
import {
  dataDeReferenciaNeutra,
  DIAS_SEM_FERIADO_NA_REFERENCIA,
} from '../src/calendario/referencia.js';
import { calendarioOperacional } from '../src/calendario/operacional.js';
import { CatalogoPortmac, type RegistroDeFaina } from '../src/catalogo/portmac.js';
import { fainasActProvisorias } from '../src/catalogo/act-provisorio.js';
import { analisarFainaDeReferencia, volumeDeReferencia } from '../src/motor/referencia.js';

const granito = fainasActProvisorias.find((faina) => faina.codigoDaTabela === '3.1')!;
const peacao = fainasActProvisorias.find((faina) => faina.codigoDaTabela === '14.1.0')!;

function comPiso(base: RegistroDeFaina, piso: number): RegistroDeFaina {
  return { ...base, regraActProvisoria: { ...base.regraActProvisoria!, producaoMinimaPorTernoPorPeriodo: piso } };
}

function analisar(registro: RegistroDeFaina) {
  return analisarFainaDeReferencia(registro, new CatalogoPortmac([registro]), calendarioOperacional);
}

describe('calendário de referência', () => {
  it('é uma segunda-feira', () => {
    expect(diaDaSemana(dataDeReferenciaNeutra())).toBe('SEGUNDA');
  });

  it('não tem feriado na janela que a varredura alcança', () => {
    const inicio = dataDeReferenciaNeutra();
    for (let dia = 0; dia <= DIAS_SEM_FERIADO_NA_REFERENCIA; dia += 1) {
      expect(ehFeriadoVilaVelha(somarDias(inicio, dia))).toBe(false);
    }
  });

  it('é estável entre chamadas', () => {
    expect(dataDeReferenciaNeutra()).toEqual(dataDeReferenciaNeutra());
  });
});

describe('curva de referência da faina', () => {
  it('varre da operação mais longa à mais curta, sem repetir produtividade', () => {
    const referencia = analisar(granito);
    const produtividades = referencia.pontos.map((ponto) => ponto.produtividade);
    expect(produtividades.length).toBeGreaterThan(10);
    expect(new Set(produtividades).size).toBe(produtividades.length);
    // Nenhum candidato mais curto que um ciclo diário completo.
    expect(Math.min(...referencia.pontos.map((ponto) => ponto.periodos))).toBeGreaterThanOrEqual(4);
  });

  it('usa a unidade da faina para escolher o volume de referência', () => {
    expect(volumeDeReferencia('TON')).toBe(12000);
    expect(volumeDeReferencia('EQUIPE')).toBe(24);
    expect(analisar(granito).volumeDeReferencia).toBe(volumeDeReferencia('TON'));
    expect(analisar(peacao).volumeDeReferencia).toBe(volumeDeReferencia('EQUIPE'));
  });

  it('não inventa joelho em faina sem produção mínima', () => {
    // Sem piso, o que sobra é a oscilação do calendário: o mínimo cai no meio
    // da faixa, e apontá-lo como ótimo descreveria a semana, não a faina.
    const referencia = analisar(granito);
    expect(referencia.joelho).toBeUndefined();
    expect(referencia.forma).toBe('CALENDARIO');
  });

  it('reconhece que salário-dia sempre premia a operação mais curta', () => {
    const referencia = analisar(peacao);
    expect(referencia.forma).toBe('DECRESCENTE');
    expect(referencia.joelho).toBeUndefined();
    const ordenados = [...referencia.pontos].sort((a, b) => a.produtividade - b.produtividade);
    expect(referencia.maisBarato?.produtividade).toBe(ordenados[ordenados.length - 1]?.produtividade);
  });

  it('encontra o joelho onde a produção mínima deixa de valer', () => {
    // O piso é cobrado abaixo dele e a produção acima: o custo unitário cai
    // como 1/produtividade até o piso e fica plano depois.
    // O joelho cai no primeiro ponto da grade que encosta no patamar; com o
    // passo da varredura ele fica próximo do piso, nunca no extremo da faixa.
    for (const piso of [700, 900, 1200]) {
      const referencia = analisar(comPiso(granito, piso));
      expect(referencia.forma).toBe('JOELHO');
      expect(referencia.joelho!.produtividade).toBeGreaterThan(piso * 0.8);
      expect(referencia.joelho!.produtividade).toBeLessThan(piso * 1.25);
    }
  });

  it('ignora um piso que nunca chega a valer na faixa varrida', () => {
    const referencia = analisar(comPiso(granito, 1));
    expect(referencia.joelho).toBeUndefined();
    expect(referencia.forma).toBe(analisar(granito).forma);
  });

  it('o joelho acompanha o piso cadastrado', () => {
    const baixo = analisar(comPiso(granito, 800)).joelho!.produtividade;
    const alto = analisar(comPiso(granito, 1500)).joelho!.produtividade;
    expect(alto).toBeGreaterThan(baixo);
  });


  it('o produto custo × produtividade é plano no piso e cresce depois dele', () => {
    // É este o sinal que separa "estou pagando o piso" de "estou pagando a
    // produção": o produto é a quantidade efetivamente cobrada por período.
    const referencia = analisar(comPiso(granito, 1200));
    const ordenados = [...referencia.pontos].sort((a, b) => a.produtividade - b.produtividade);
    const produto = (indice: number) =>
      ordenados[indice]!.custoPorUnidade * ordenados[indice]!.produtividade;

    const noPiso = ordenados.filter((ponto) => ponto.produtividade < 1200);
    const acimaDoPiso = ordenados.filter((ponto) => ponto.produtividade > 1500);
    expect(noPiso.length).toBeGreaterThan(2);
    expect(acimaDoPiso.length).toBeGreaterThan(2);

    const produtosNoPiso = noPiso.map((ponto) => ponto.custoPorUnidade * ponto.produtividade);
    const variacaoNoPiso = (Math.max(...produtosNoPiso) - Math.min(...produtosNoPiso)) / Math.min(...produtosNoPiso);
    expect(variacaoNoPiso).toBeLessThan(0.1);
    expect(produto(ordenados.length - 1)).toBeGreaterThan(produto(0) * 1.5);
  });

  it('reproduz a forma da planilha legada quando o piso é cadastrado', () => {
    // A curva anexada pela PORTMAC cai de R$ 34,05 a ~R$ 26,50 entre 500 e
    // 700 t por terno e depois estabiliza. Essa razão de 1,28 na ponta baixa
    // implica um piso perto de 650 t; com ele cadastrado, o motor reencontra
    // o joelho na mesma faixa.
    const referencia = analisar(comPiso(granito, 650));
    expect(referencia.forma).toBe('JOELHO');
    expect(referencia.joelho!.produtividade).toBeGreaterThan(550);
    expect(referencia.joelho!.produtividade).toBeLessThan(800);

    const ordenados = [...referencia.pontos].sort((a, b) => a.produtividade - b.produtividade);
    const patamar = ordenados[ordenados.length - 1]!.custoPorUnidade;
    const razaoNaPontaBaixa = ordenados[0]!.custoPorUnidade / patamar;
    expect(razaoNaPontaBaixa).toBeGreaterThan(1.2);
    expect(razaoNaPontaBaixa).toBeLessThan(1.45);
  });
});
