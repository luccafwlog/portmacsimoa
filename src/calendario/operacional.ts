import { somarDias } from '../dominio/tempo.js';
import type { CalendarioOgmo } from './portas.js';
import type { PeriodoOgmo } from '../dominio/tipos.js';

const FAIXAS_DO_DIA = [
  '01-07',
  '07-13',
  '13-19',
  '19-01',
] as const;

/** Calendário operacional mínimo; tarifas e adicionais pertencem ao catálogo. */
export const calendarioOperacional: CalendarioOgmo = {
  projetar(inicio, quantidade) {
    const indiceInicial = FAIXAS_DO_DIA.findIndex((codigo) => codigo === inicio.periodo);
    if (indiceInicial < 0) throw new Error(`Período de início desconhecido: ${inicio.periodo}`);

    return Array.from({ length: quantidade }, (_, indice): PeriodoOgmo => {
      const indiceDoDia = indiceInicial + indice;
      const identificador = FAIXAS_DO_DIA[indiceDoDia % FAIXAS_DO_DIA.length]!;
      const diasDepois = Math.floor(indiceDoDia / FAIXAS_DO_DIA.length);

      return {
        indice,
        data: somarDias(inicio.data, diasDepois),
        identificador,
      };
    });
  },
};
