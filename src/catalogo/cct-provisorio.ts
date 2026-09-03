import type {
  BaseDeCalculoProvisoria,
  ComposicaoCctProvisoria,
  RegimeRemuneratorio,
  UnidadeDeMedida,
} from '../dominio/tipos.js';
import type { RegistroDeFaina } from './portmac.js';

interface DefinicaoCctProvisoria {
  readonly codigo: string;
  readonly descricao: string;
  readonly grupo: string;
  readonly unidade: UnidadeDeMedida;
  readonly regime: RegimeRemuneratorio;
  readonly taxaBase: number;
  readonly observacao: string;
}

const ENCARGOS_E_CONTRIBUICOES = 1.152877;

const COMPOSICAO_PADRAO: readonly ComposicaoCctProvisoria[] = [
  { categoria: 'Conferentes', funcoes: ['Conferente-Chefe', 'Conferente de Lingada'], homens: 2, cotas: 3.5 },
  { categoria: 'Estivadores', funcoes: ['Contramestre de Porão', 'Estivador de Porão', 'Guincheiro / Sinaleiro'], homens: 7, cotas: 8.1 },
  { categoria: 'Arrumadores', funcoes: ['Arrumador de Costado/Pátio'], homens: 2, cotas: 2 },
  { categoria: 'SUPORT (Capatazia)', funcoes: ['Encarregado de Capatazia', 'Operador de Empilhadeira/Trator', 'Trabalhador de Capatazia'], homens: 4, cotas: 4.8 },
  { categoria: 'Vigias', funcoes: ['Vigia de Portaló / Convés'], homens: 1, cotas: 1 },
];

const COMPOSICAO_SALARIO_DIA: readonly ComposicaoCctProvisoria[] = [
  COMPOSICAO_PADRAO[0]!,
  { categoria: 'Estivadores', funcoes: ['Contramestre de Porão', 'Motorista / Operador'], homens: 5, cotas: 5.5 },
  COMPOSICAO_PADRAO[2]!,
  COMPOSICAO_PADRAO[3]!,
  COMPOSICAO_PADRAO[4]!,
];

const DEFINICOES: readonly DefinicaoCctProvisoria[] = [
  { codigo: '1.1', descricao: 'Sacaria Solta em Geral', grupo: 'Estiva / Arrumadores / Suport', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 1.0265, observacao: 'Terno padrão de sacaria solta' },
  { codigo: '1.2', descricao: 'Sacaria Solta com Produto Cáustico', grupo: 'Estiva / Arrumadores / Suport', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 1.3343, observacao: 'Taxa majorada por agressividade' },
  { codigo: '2.1', descricao: 'Sacaria Paletizada / Unitizada', grupo: 'Estiva / Arrumadores / Suport', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.5702, observacao: 'Mecanizada' },
  { codigo: '2.1.1', descricao: 'Açúcar Marinado em Slings', grupo: 'Estiva / Arrumadores / Suport', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.5731, observacao: 'Slings prontos para içamento' },
  { codigo: '2.1.2', descricao: 'Açúcar Marinado - Nivelamento', grupo: 'Estiva / Arrumadores / Suport', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 1.4766, observacao: 'Abertura de slings para nivelamento' },
  { codigo: '2.1.3', descricao: 'Açúcar Marinado com Estivagem de Barrote', grupo: 'Estiva / Arrumadores / Suport', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.917, observacao: 'Suporte de barrotes' },
  { codigo: '2.2', descricao: 'Sacaria Unificada Cáustica', grupo: 'Estiva / Arrumadores / Suport', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.7413, observacao: 'Unitizada com produto cáustico' },
  { codigo: '3.7', descricao: 'Granéis por Esteiras/Correias (Trigo/Soja/Milho)', grupo: 'Granéis', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.2523, observacao: 'Silos e correias transportadoras' },
  { codigo: '3.8', descricao: 'Ferroliga e Minérios via Caçamba Automática', grupo: 'Granéis', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.2292, observacao: 'Caçamba de acionamento automático' },
  { codigo: '3.8.1', descricao: 'Ferroliga - Rechego Mecanizado', grupo: 'Granéis', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.2225, observacao: 'Uso de máquinas de porão' },
  { codigo: '3.8.2', descricao: 'Ferroliga - Rechego Manual', grupo: 'Granéis', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.2225, observacao: 'Limpeza final manual' },
  { codigo: '4.1', descricao: 'Sucção / Tromba (Trigo, Milho, Soja)', grupo: 'Granéis', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.1949, observacao: 'Sugador pneumático' },
  { codigo: '4.1.1', descricao: 'Sucção - Rechego Mecanizado', grupo: 'Granéis', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.1949, observacao: 'Apoio com mini-carregadeira' },
  { codigo: '4.1.2', descricao: 'Sucção - Rechego Manual', grupo: 'Granéis', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.1949, observacao: 'Pá manual no porão' },
  { codigo: '4.2', descricao: 'Granéis Agrícolas via Grab/Caçamba', grupo: 'Granéis', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.1949, observacao: 'Grabs em guindaste de bordo/terra' },
  { codigo: '4.2.1', descricao: 'Granéis Agrícolas Rechego', grupo: 'Granéis', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.1949, observacao: 'Rechego no porão' },
  { codigo: '4.2.2', descricao: 'Granéis Agrícolas Rechego Manual', grupo: 'Granéis', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.1949, observacao: 'Rechego manual' },
  { codigo: '4.3', descricao: 'Fertilizantes, Carvão e Sal via Grab', grupo: 'Granéis', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.2177, observacao: 'Cargas minerais e agressivas' },
  { codigo: '4.3.1', descricao: 'Granéis Minerais Rechego', grupo: 'Granéis', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.2113, observacao: 'Rechego de adubo/carvão' },
  { codigo: '4.3.2', descricao: 'Granéis Minerais Rechego Manual', grupo: 'Granéis', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.2113, observacao: 'Rechego manual' },
  { codigo: '4.7', descricao: 'Caçamba Não-Automática', grupo: 'Granéis', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.5339, observacao: 'Operação convencional' },
  { codigo: '5.1', descricao: 'Blocos de Granito / Mármore', grupo: 'Carga Pesada', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.4474, observacao: 'Içamento de grandes blocos' },
  { codigo: '5.9', descricao: 'Bobinas de Aço, Chapas e Fio Máquina', grupo: 'Siderurgia', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.3426, observacao: 'Material siderúrgico' },
  { codigo: '6.0', descricao: 'Movimentação de Contêineres (Cheio/Vazio)', grupo: 'Contêiner', unidade: 'UNIDADE', regime: 'PRODUCAO', taxaBase: 0.9625, observacao: 'Taxa cobrada por unidade de TEU/FEU' },
  { codigo: '6.1', descricao: 'Remoção de Contêiner a Bordo/Pátio', grupo: 'Contêiner', unidade: 'UNIDADE', regime: 'PRODUCAO', taxaBase: 1.155, observacao: 'Movimentação interna/shift' },
  { codigo: '7.0', descricao: 'Peças Pesadas, Máquinas e Caixaria', grupo: 'Carga Especial', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.9135, observacao: 'Sob medida' },
  { codigo: '7.1', descricao: 'Fardos de Algodão', grupo: 'Carga Geral', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 1.0265, observacao: 'Unitizada/Fardos' },
  { codigo: '7.2', descricao: 'Bobinas de Papel HC Convencional/Especial', grupo: 'Papel e Celulose', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.9123, observacao: 'Manuseio com garra de papel' },
  { codigo: '7.4', descricao: 'Bobinas de Papel VC', grupo: 'Papel e Celulose', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.8326, observacao: 'Operação verticalizada' },
  { codigo: '8.2', descricao: 'Fardos de Celulose Convencional', grupo: 'Papel e Celulose', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.7413, observacao: 'Fardos consolidados' },
  { codigo: '8.3', descricao: 'Celulose via Dispositivo Semi-Automático', grupo: 'Papel e Celulose', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.6272, observacao: 'Dispositivo Sanko' },
  { codigo: '9.0', descricao: 'Carnes e Alimentos Congelados', grupo: 'Frigorificada', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.8353, observacao: 'Controle de temperatura' },
  { codigo: '10.0', descricao: 'Paletes Frigorificados', grupo: 'Frigorificada', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 0.8353, observacao: 'Paletizada' },
  { codigo: '11.0', descricao: 'Carga Geral Diversa em Caixas/Sacos', grupo: 'Carga Geral', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 1.0246, observacao: 'Operação padrão' },
  { codigo: '11.1', descricao: 'Suprimentos e Equipamentos Off-Shore', grupo: 'Off-Shore', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 1.0246, observacao: 'Apoio marítimo e plataformas' },
  { codigo: '12.0', descricao: 'Carga Geral Paletizada', grupo: 'Carga Geral', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 1.0278, observacao: 'Unitizada' },
  { codigo: '14.1.1', descricao: 'Veículos Leves Ro-Ro', grupo: 'Automóveis', unidade: 'UNIDADE', regime: 'SALARIO_DIA', taxaBase: 179.21, observacao: 'Dirigidos a bordo/pátio' },
  { codigo: '14.2', descricao: 'Carga Rolante (Carretas/Pranchas)', grupo: 'Ro-Ro', unidade: 'TON', regime: 'SALARIO_DIA', taxaBase: 179.21, observacao: 'Rampa ro-ro' },
  { codigo: '14.3.1', descricao: 'Máquinas Pesadas / Tratores', grupo: 'Carga Pesada', unidade: 'UNIDADE', regime: 'SALARIO_DIA', taxaBase: 179.21, observacao: 'Operador habilitado' },
  { codigo: '16.0', descricao: 'Fixação e Peação de Carga a Bordo', grupo: 'Apoio Estiva', unidade: 'EQUIPE', regime: 'SALARIO_DIA', taxaBase: 179.21, observacao: 'Serviço exclusivo por salário-dia' },
  { codigo: '18.0', descricao: 'Operação Exclusiva Off-Shore', grupo: 'Off-Shore', unidade: 'TON', regime: 'PRODUCAO', taxaBase: 1.0246, observacao: 'Apoio a plataformas' },
];

function codigoInterno(codigo: string): string {
  return `CCT_PROVISORIA_${codigo.replace(/\./g, '_')}`;
}

export const fainasCctProvisorias: readonly RegistroDeFaina[] = DEFINICOES.map((definicao) => {
  const regra = {
    taxaBase: definicao.taxaBase,
    baseDeCalculo: (definicao.regime === 'PRODUCAO' ? 'TARIFA_UNITARIA' : 'COTAS_DA_EQUIPE') as BaseDeCalculoProvisoria,
    regime: definicao.regime,
    unidade: definicao.unidade,
    encargosContribuicaoAdicional: ENCARGOS_E_CONTRIBUICOES,
    composicao: definicao.codigo === '14.1.1' || definicao.codigo === '14.3.1' || definicao.codigo === '16.0'
      ? COMPOSICAO_SALARIO_DIA
      : COMPOSICAO_PADRAO,
  };
  return {
    codigo: codigoInterno(definicao.codigo),
    codigoDaTabela: definicao.codigo,
    grupoDaTabela: `CCT PROVISÓRIA · ${definicao.grupo}`,
    descricao: definicao.descricao,
    tipoDeCarga: definicao.descricao,
    unidade: definicao.unidade,
    fonte: 'CCT',
    status: 'PROVISORIA',
    vigencia: '2024/2026',
    referencia: `Mapeamento provisório · Analise_CCT_Calculadora_Terno_Portuario (1).xlsx · ${definicao.codigo} · ${definicao.observacao}`,
    regra,
    regraCctProvisoria: regra,
  };
});
