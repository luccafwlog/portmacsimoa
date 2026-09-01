import type { RegistroDeFaina } from './portmac.js';
import { fainasCctProvisorias } from './cct-provisorio.js';

/**
 * Cadastro CCT provisório em uso no simulador.
 *
 * A fonte autorizada para esta versão é exclusivamente o mapeamento da
 * planilha Analise_CCT_Calculadora_Terno_Portuario (1).xlsx. O levantamento
 * adicional das tabelas do PDF fica fora do catálogo até ser validado e
 * incorporado ao mesmo padrão de dados.
 */
export const fainasCctIniciais: readonly RegistroDeFaina[] = fainasCctProvisorias;
