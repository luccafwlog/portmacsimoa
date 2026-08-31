import { describe, expect, it } from 'vitest';
import { instante } from '../src/dominio/tempo.js';
import { CatalogoEmMemoria } from '../src/catalogo/memoria.js';
import { CATALOGO_SEMENTE } from '../src/catalogo/semente.js';
import { calendarioProvisorio } from '../src/calendario/calendario.js';
import { comPoliticas } from '../src/motor/politicas.js';
import { CatalogoIncompleto, EntradaInvalida, simular } from '../src/motor/simulador.js';
import type { EntradaDeSimulacao } from '../src/dominio/tipos.js';

const catalogo = new CatalogoEmMemoria(CATALOGO_SEMENTE);
const calendario = calendarioProvisorio(2026, 2028);
/** 06/07/2026 é uma segunda-feira: período diurno comum, multiplicador 1,0. */
const SEGUNDA_DE_MANHA = instante(2026, 7, 6, 7, 0);

function granito(
  quantidade: number,
  produtividade: number,
  ternos: number,
): EntradaDeSimulacao {
  return {
    cargas: [
      { faina: '5.1', quantidade, produtividadePorTernoPorPeriodo: produtividade },
    ],
    ternos,
    inicio: SEGUNDA_DE_MANHA,
  };
}

/**
 * A conta feita à mão sobre o ANEXO I, num único período diurno comum.
 *
 * Estiva (taxa homem, R$ 0,99/ton): a equipe referência sem homens extras tem
 * contramestre (1,5) + 5 de porão (1,0 cada) + portaló (1,0) = 7,5 cotas.
 *   0,99 × 7,5 × 1000 = R$ 7.425,00
 *
 * Conferência (taxa equipe, R$ 3,01/ton): o bolo não depende da equipe.
 *   3,01 × 1000 = R$ 3.010,00
 *
 * Total de mão de obra: R$ 10.435,00. Se este teste quebrar, o motor deixou de
 * reproduzir o documento — não é refinamento, é regressão.
 */
describe('um período, um terno, granito', () => {
  const resultado = simular(granito(1000, 1000, 1), catalogo, calendario);

  it('consome exatamente um período', () => {
    expect(resultado.duracaoEmPeriodos).toBe(1);
    expect(resultado.periodos[0]?.multiplicador).toBe(1);
  });

  it('reproduz o custo de mão de obra do ANEXO I', () => {
    expect(resultado.custoMaoDeObra).toBeCloseTo(10_435, 6);
  });

  it('separa estiva e conferência na abertura por categoria', () => {
    const porCategoria = Object.fromEntries(
      resultado.porCategoria.map((c) => [c.categoria, c.custo]),
    );
    expect(porCategoria['ESTIVADORES']).toBeCloseTo(7_425, 6);
    expect(porCategoria['CONFERENTES']).toBeCloseTo(3_010, 6);
  });

  it('acrescenta o fundo indenizatório de 1% por fora do fator de encargos', () => {
    expect(resultado.custoDoFundoIndenizatorio).toBeCloseTo(104.35, 6);
    expect(resultado.custoTotal).toBeCloseTo(10_539.35, 6);
  });

  it('entrega o R$/ton como número-título', () => {
    expect(resultado.indicadorPrincipal?.rotulo).toBe('R$/ton');
    expect(resultado.indicadorPrincipal?.valor).toBeCloseTo(10.53935, 6);
  });
});

/**
 * A propriedade que o ACT afirma com todas as letras para o granito:
 * "independentemente da quantidade de ternos será remunerada por R$ 3,01 para
 * cada tonelada de granito movimentada".
 */
describe('taxa equipe não depende da quantidade de ternos', () => {
  it('conferência custa o mesmo com 1 e com 2 ternos, à mesma produção', () => {
    const umTerno = simular(granito(10_000, 1000, 1), catalogo, calendario);
    const doisTernos = simular(granito(10_000, 500, 2), catalogo, calendario);

    const conferencia = (r: typeof umTerno) =>
      r.porCategoria.find((c) => c.categoria === 'CONFERENTES')?.custo ?? 0;

    expect(umTerno.duracaoEmPeriodos).toBe(doisTernos.duracaoEmPeriodos);
    expect(conferencia(doisTernos)).toBeCloseTo(conferencia(umTerno), 6);
  });

  it('a equipe de conferência cresce só no que escala por terno', () => {
    const umTerno = simular(granito(1000, 1000, 1), catalogo, calendario);
    const tresTernos = simular(granito(3000, 1000, 3), catalogo, calendario);

    const trabalhadores = (r: typeof umTerno) =>
      r.periodos[0]?.porCategoria.find((c) => c.categoria === 'CONFERENTES')
        ?.trabalhadores ?? 0;

    // chefe + ajudante (por navio) + 1 lingada por terno.
    expect(trabalhadores(umTerno)).toBe(3);
    expect(trabalhadores(tresTernos)).toBe(5);
  });
});

/**
 * A consequência que inverte a intuição comercial (#8).
 *
 * Navio produtivo: manda a produção, e o R$/ton é aproximadamente a taxa.
 * Navio lento ou pequeno: manda o piso de salário-dia, e o R$/ton dispara.
 */
describe('os dois regimes', () => {
  const produtivo = simular(granito(10_000, 1000, 1), catalogo, calendario);
  const lento = simular(granito(100, 50, 1), catalogo, calendario);

  it('reconhece o regime de produção no navio produtivo', () => {
    expect(produtivo.regimeDominante).toBe('PRODUCAO');
  });

  it('reconhece o regime de piso no navio pequeno e lento', () => {
    expect(lento.regimeDominante).toBe('PISO');
    expect(lento.periodos[0]?.porCategoria.every((c) => c.regime === 'PISO')).toBe(
      true,
    );
  });

  it('o R$/ton do navio lento é uma ordem de grandeza maior', () => {
    const a = produtivo.indicadorPrincipal?.valor ?? 0;
    const b = lento.indicadorPrincipal?.valor ?? 0;
    expect(b).toBeGreaterThan(a * 5);
  });

  it('no regime de piso, mais ternos diluem o custo por tonelada', () => {
    const umTerno = simular(granito(200, 50, 1), catalogo, calendario);
    const doisTernos = simular(granito(200, 50, 2), catalogo, calendario);
    expect(doisTernos.indicadorPrincipal?.valor).toBeLessThan(
      umTerno.indicadorPrincipal?.valor ?? 0,
    );
  });
});

describe('períodos requisitados e não realizados', () => {
  it('o período de sobra é cobrado inteiro e carrega o piso', () => {
    // 1.100 ton a 1.000 ton/período: dois períodos, o segundo com 100 ton.
    const resultado = simular(granito(1100, 1000, 1), catalogo, calendario);
    expect(resultado.duracaoEmPeriodos).toBe(2);

    const sobra = resultado.periodos[1];
    expect(sobra?.producao).toBeCloseTo(100, 6);
    expect(sobra?.fracaoRequisitada).toBe(1);
    expect(
      sobra?.porCategoria.every((c) => c.trabalhadoresNoPiso === c.trabalhadores),
    ).toBe(true);
  });

  it('a política EXATO cobra a fração e derruba o custo — é a comparação, não o default', () => {
    const inteiro = simular(granito(1100, 1000, 1), catalogo, calendario);
    const exato = simular(
      granito(1100, 1000, 1),
      catalogo,
      calendario,
      comPoliticas({ arredondamentoDePeriodos: 'EXATO' }),
    );
    expect(exato.custoMaoDeObra).toBeLessThan(inteiro.custoMaoDeObra);
  });
});

/**
 * A agregação por categoria conta em homens-período, não em trabalhadores.
 *
 * Uma equipe de 7 ao longo de 2 períodos são 14 homens-período. Se só o período
 * de sobra cair no piso, são 7 no piso de 14 — e não "7 de 7", que faria a
 * operação inteira parecer no piso.
 */
describe('unidade da abertura por categoria', () => {
  it('conta homens-período e não confunde o período de sobra com a operação', () => {
    const resultado = simular(granito(1100, 1000, 1), catalogo, calendario);
    const estiva = resultado.porCategoria.find((c) => c.categoria === 'ESTIVADORES');

    expect(estiva?.trabalhadores).toBe(7);
    expect(estiva?.homensPeriodo).toBe(14);
    expect(estiva?.homensPeriodoNoPiso).toBe(7);
    expect(estiva?.regime).toBe('MISTO');
  });
});

describe('multiplicadores de período no custo', () => {
  it('o mesmo navio custa mais começando no sábado à noite', () => {
    const comum = simular(granito(2000, 1000, 1), catalogo, calendario);
    const fimDeSemana = simular(
      { ...granito(2000, 1000, 1), inicio: instante(2026, 7, 11, 19, 0) },
      catalogo,
      calendario,
    );
    // Sábado noturno (1,875) + domingo diurno (1,875) contra comum + noturno.
    expect(fimDeSemana.custoMaoDeObra).toBeGreaterThan(comum.custoMaoDeObra);
    expect(fimDeSemana.porClasseDeDia.map((l) => l.classe).sort()).toEqual([
      'DOMINGO',
      'SABADO',
    ]);
  });
});

describe('premissas visíveis no resultado', () => {
  const resultado = simular(granito(1000, 1000, 1), catalogo, calendario);
  const codigos = resultado.premissas.map((p) => p.codigo);

  it('avisa que o calendário é provisório', () => {
    expect(codigos).toContain('CALENDARIO_PROVISORIO');
  });

  it('avisa que a taxa de administração do OGMO foi assumida como zero', () => {
    expect(codigos).toContain('TAXA_OGMO_ZERO');
  });

  it('avisa que homens extras não foram requisitados', () => {
    expect(codigos).toContain('SEM_HOMENS_EXTRAS');
  });

  it('avisa que o salário-dia dos conferentes ainda não foi conferido', () => {
    expect(
      codigos.some((c) => c.startsWith('CATALOGO_PENDENTE:5.1:CONFERENTES')),
    ).toBe(true);
  });

  it('toda premissa aponta a issue que a fecha', () => {
    expect(resultado.premissas.every((p) => p.issue > 0)).toBe(true);
  });
});

describe('recusas', () => {
  it('recusa faina fora do catálogo em vez de devolver um número', () => {
    expect(() =>
      simular(
        {
          cargas: [
            { faina: '99.9', quantidade: 100, produtividadePorTernoPorPeriodo: 10 },
          ],
          ternos: 1,
          inicio: SEGUNDA_DE_MANHA,
        },
        catalogo,
        calendario,
      ),
    ).toThrow(CatalogoIncompleto);
  });

  it('recusa produtividade zero', () => {
    expect(() => simular(granito(100, 0, 1), catalogo, calendario)).toThrow(
      EntradaInvalida,
    );
  });

  it('recusa meio terno', () => {
    expect(() => simular(granito(100, 10, 0), catalogo, calendario)).toThrow(
      EntradaInvalida,
    );
  });
});

describe('homens extras', () => {
  it('incluí-los aumenta o custo da estiva — o default subestima de propósito', () => {
    const sem = simular(granito(1000, 1000, 1), catalogo, calendario);
    const com = simular(
      granito(1000, 1000, 1),
      catalogo,
      calendario,
      comPoliticas({ incluirHomensExtras: true }),
    );
    const estiva = (r: typeof sem) =>
      r.porCategoria.find((c) => c.categoria === 'ESTIVADORES')?.custo ?? 0;
    // +3 homens extras a cota 1,3 = +3,9 cotas sobre as 7,5 da equipe referência.
    expect(estiva(com)).toBeCloseTo(estiva(sem) * (11.4 / 7.5), 6);
  });
});
