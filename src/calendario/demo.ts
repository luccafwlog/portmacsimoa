import { somarDias } from '../dominio/tempo.js';
import type { CalendarioOgmo } from './portas.js';
import type { PeriodoOgmo } from '../dominio/tipos.js';

const FAIXAS_DO_DIA = [
  { codigo: '01-07', multiplicador: 1 },
  { codigo: '07-13', multiplicador: 1.25 },
  { codigo: '13-19', multiplicador: 1.5 },
  { codigo: '19-01', multiplicador: 1.75 },
] as const;

/** Calendário fictício para a tela; os valores do OGMO ainda serão conectados. */
export const calendarioDemo: CalendarioOgmo = {
  projetar(inicio, quantidade) {
    const indiceInicial = FAIXAS_DO_DIA.findIndex(({ codigo }) => codigo === inicio.periodo);
    if (indiceInicial < 0) throw new Error(`Período de início desconhecido: ${inicio.periodo}`);

    return Array.from({ length: quantidade }, (_, indice): PeriodoOgmo => {
      const indiceDoDia = indiceInicial + indice;
      const faixa = FAIXAS_DO_DIA[indiceDoDia % FAIXAS_DO_DIA.length]!;
      const diasDepois = Math.floor(indiceDoDia / FAIXAS_DO_DIA.length);

      return {
        indice,
        data: somarDias(inicio.data, diasDepois),
        identificador: faixa.codigo,
        multiplicador: faixa.multiplicador,
      };
    });
  },
};
