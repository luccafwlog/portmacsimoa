import { describe, expect, it } from 'vitest';
import { instante } from '../src/dominio/tempo.js';
import { CatalogoEmMemoria } from '../src/catalogo/memoria.js';
import { CATALOGO_SEMENTE } from '../src/catalogo/semente.js';
import { calendarioProvisorio } from '../src/calendario/calendario.js';
import { simular } from '../src/motor/simulador.js';

/**
 * Um navio plausível de ponta a ponta, imprimindo o resultado.
 *
 * Serve para ver a forma do output antes de existir tela — que é o insumo do
 * esboço de resultado (#15).
 */
describe('navio de exemplo', () => {
  it('atravessa o fim de semana e devolve um resultado completo', () => {
    const resultado = simular(
      {
        navio: 'Exemplo',
        cargas: [
          { faina: '5.1', quantidade: 12_000, produtividadePorTernoPorPeriodo: 450 },
        ],
        ternos: 2,
        inicio: instante(2026, 7, 11, 19, 0),
        custosOpcionais: [
          { descricao: 'Locação de empilhadeira', tipo: 'POR_PERIODO', valor: 1_800 },
        ],
      },
      new CatalogoEmMemoria(CATALOGO_SEMENTE),
      calendarioProvisorio(2026, 2028),
    );

    expect(resultado.duracaoEmPeriodos).toBe(14);
    expect(resultado.indicadorPrincipal?.rotulo).toBe('R$/ton');
    expect(resultado.custoTotal).toBeGreaterThan(0);
    expect(resultado.porClasseDeDia.length).toBeGreaterThan(1);
    expect(resultado.premissas.length).toBeGreaterThan(0);

    if (process.env['MOSTRAR_RESULTADO'] === '1') {
      console.log(JSON.stringify({
        titulo: resultado.indicadorPrincipal,
        custoTotal: resultado.custoTotal,
        regime: resultado.regimeDominante,
        termino: resultado.terminoPrevisto,
        porClasseDeDia: resultado.porClasseDeDia,
        porCategoria: resultado.porCategoria,
        premissas: resultado.premissas.map((p) => `#${p.issue} ${p.codigo}`),
      }, null, 2));
    }
  });
});
