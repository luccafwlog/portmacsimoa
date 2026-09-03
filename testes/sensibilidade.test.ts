import { describe, expect, it } from 'vitest';
import { data } from '../src/dominio/tempo.js';
import {
  CURVA_OTIMO_FERTILIZANTES,
  gerarGradePorPeriodos,
  obterAnaliseDeSensibilidade,
} from '../src/motor/sensibilidade.js';
import { simular } from '../src/motor/simulador.js';
import { catalogoPortmac } from '../src/catalogo/portmac.js';
import { calendarioOperacional } from '../src/calendario/operacional.js';
import { fainasActProvisorias } from '../src/catalogo/act-provisorio.js';

describe('módulo de sensibilidade e otimização', () => {
  it('contém a série de referência de fertilizantes', () => {
    expect(CURVA_OTIMO_FERTILIZANTES.length).toBeGreaterThan(30);
    expect(CURVA_OTIMO_FERTILIZANTES[0]).toEqual([500, 34.05]);
  });

  it('gera grade proporcional a períodos de 1 a 36', () => {
    const grade = gerarGradePorPeriodos({
      faina: 'TESTE',
      inicio: { data: data(2026, 9, 4), periodo: '07-13' },
      volumeToneladas: 360,
      produtividadeToneladasPorPeriodo: 10,
      ternosPorPeriodoPadrao: 1,
      totalDeTernos: 36,
    });

    expect(grade).toHaveLength(36);
    expect(grade[0]).toBe(360); // 1 período: 360 / 1
    expect(grade[35]).toBe(10); // 36 períodos: 360 / 36
  });

  it('calcula a análise de sensibilidade para uma simulação real', () => {
    const entrada = {
      faina: fainasActProvisorias[0]!.codigo,
      inicio: { data: data(2026, 9, 7), periodo: '07-13' },
      volumeToneladas: 100,
      produtividadeToneladasPorPeriodo: 50,
      ternosPorPeriodoPadrao: 1,
      totalDeTernos: 2,
    };

    const resultado = simular(entrada, catalogoPortmac, calendarioOperacional);
    const analise = obterAnaliseDeSensibilidade(resultado, catalogoPortmac, calendarioOperacional);

    expect(analise.pontos.length).toBeGreaterThan(0);
    expect(analise.otimizacao.melhor).toBeDefined();
    expect(analise.otimizacao.melhor?.resultado.custoPorTonelada).toBeGreaterThan(0);
  });
});
