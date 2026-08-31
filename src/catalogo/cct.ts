import type { UnidadeDeMedida } from '../dominio/tipos.js';
import type { RegistroDeFaina } from './portmac.js';

type GrupoDaTabela =
  | 'COSTADO · ARRUMADORES'
  | 'PÁTIO · ARRUMADORES'
  | 'CONFERENTES'
  | 'ESTIVADORES'
  | 'SUPORT'
  | 'CAPATAZIA';

interface LinhaCct {
  readonly codigo: string;
  readonly descricao: string;
  readonly unidade: UnidadeDeMedida;
}

function linhas(
  grupo: GrupoDaTabela,
  pagina: number,
  entradas: readonly LinhaCct[],
): readonly RegistroDeFaina[] {
  const grupoSeguro = grupo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/gi, '_')
    .replace(/^_|_$/g, '')
    .toUpperCase();

  return entradas.map((entrada) => ({
    codigo: `CCT_${grupoSeguro}_${entrada.codigo.replace(/\./g, '_')}`,
    codigoDaTabela: entrada.codigo,
    grupoDaTabela: grupo,
    descricao: entrada.descricao,
    tipoDeCarga: entrada.descricao,
    unidade: entrada.unidade,
    fonte: 'CCT',
    status: 'PENDENTE_DE_VALIDACAO',
    vigencia: '2024/2026',
    referencia: `CCT 2024/2026 · tabela ${grupo.toLowerCase()} · faina ${entrada.codigo} · PDF p. ${pagina}`,
  }));
}

const fainasComuns = [
  { codigo: '1.1', descricao: 'Sacaria solta', unidade: 'TON' },
  { codigo: '1.2', descricao: 'Sacaria solta cáustica', unidade: 'TON' },
  { codigo: '2.1', descricao: 'Sacaria unificada', unidade: 'TON' },
  { codigo: '2.1.1', descricao: 'Açúcar marinado', unidade: 'TON' },
  { codigo: '2.1.2', descricao: 'Açúcar marinado - encher buraco', unidade: 'TON' },
  { codigo: '2.1.3', descricao: 'Açúcar marinado com barrote', unidade: 'TON' },
  { codigo: '2.2', descricao: 'Sacaria unificada cáustica', unidade: 'TON' },
  { codigo: '3.7', descricao: 'Embarque de granéis por transportador automático', unidade: 'TON' },
  { codigo: '3.8', descricao: 'Granéis ferro liga, minério e gusa - caçamba automática', unidade: 'TON' },
  { codigo: '3.8.1', descricao: 'Granéis ferro liga, minério e gusa - caçamba automática - rechego', unidade: 'TON' },
  { codigo: '3.8.2', descricao: 'Granéis ferro liga, minério e gusa - caçamba automática - rechego manual', unidade: 'TON' },
  { codigo: '4.1', descricao: 'Descarga de granéis por transportador automático - aparelho de sucção', unidade: 'TON' },
  { codigo: '4.1.1', descricao: 'Descarga de granéis por transportador automático - aparelho de sucção - rechego', unidade: 'TON' },
  { codigo: '4.1.2', descricao: 'Descarga de granéis por transportador automático - aparelho de sucção - rechego manual', unidade: 'TON' },
  { codigo: '4.2', descricao: 'Granéis - aparelhos mecânicos e transporte automático', unidade: 'TON' },
  { codigo: '4.2.1', descricao: 'Granéis - aparelhos mecânicos e transporte automático - rechego', unidade: 'TON' },
  { codigo: '4.2.2', descricao: 'Granéis - aparelhos mecânicos e transporte automático - rechego manual', unidade: 'TON' },
  { codigo: '4.3', descricao: 'Granéis - aparelhos mecânicos e transporte automático de fertilizante', unidade: 'TON' },
  { codigo: '4.3.1', descricao: 'Granéis - aparelhos mecânicos e transporte automático de fertilizante - rechego', unidade: 'TON' },
  { codigo: '4.3.2', descricao: 'Granéis - aparelhos mecânicos e transporte automático de fertilizante - rechego manual', unidade: 'TON' },
  { codigo: '4.7', descricao: 'Granéis - caçamba comum', unidade: 'TON' },
  { codigo: '5.1', descricao: 'Granito', unidade: 'TON' },
  { codigo: '5.9', descricao: 'Produto siderúrgico', unidade: 'TON' },
  { codigo: '6.0', descricao: 'Contêiner', unidade: 'CONTAINER' },
  { codigo: '6.1', descricao: 'Contêiner - remoção', unidade: 'CONTAINER' },
  { codigo: '7.0', descricao: 'Carga especial e carga indivisível', unidade: 'TON' },
  { codigo: '7.1', descricao: 'Algodão', unidade: 'TON' },
  { codigo: '7.2', descricao: 'Bobina de papel - HC convencional e especial', unidade: 'TON' },
  { codigo: '7.4', descricao: 'Bobina de papel - VC', unidade: 'TON' },
  { codigo: '8.2', descricao: 'Celulose convencional', unidade: 'TON' },
  { codigo: '8.3', descricao: 'Celulose semiautomática tipo Sanko', unidade: 'TON' },
  { codigo: '9.0', descricao: 'Carga frigorífica', unidade: 'TON' },
  { codigo: '10.0', descricao: 'Carga frigorífica unificada', unidade: 'TON' },
  { codigo: '11.0', descricao: 'Carga geral', unidade: 'TON' },
  { codigo: '11.1', descricao: 'Carga geral off-shore', unidade: 'TON' },
  { codigo: '12.0', descricao: 'Carga geral unificada', unidade: 'TON' },
  { codigo: '15.0', descricao: 'Big bag', unidade: 'TON' },
  { codigo: '15.1', descricao: 'Big bag cáustica', unidade: 'TON' },
  { codigo: '17.0', descricao: 'Embarque de celulose - navio especializado', unidade: 'TON' },
  { codigo: '18.0', descricao: 'Embarcações off-shore', unidade: 'TON' },
] as const satisfies readonly LinhaCct[];

const fainasAutomoveisEMaquinas = [
  { codigo: '14.1.1', descricao: 'Automóveis até 150 unidades', unidade: 'UNIDADE' },
  { codigo: '14.1.2', descricao: 'Automóveis de 151 a 300 unidades', unidade: 'UNIDADE' },
  { codigo: '14.1.3', descricao: 'Automóveis de 301 a 450 unidades', unidade: 'UNIDADE' },
  { codigo: '14.1.4', descricao: 'Automóveis de 451 a 600 unidades', unidade: 'UNIDADE' },
  { codigo: '14.1.5', descricao: 'Automóveis de 601 a 800 unidades', unidade: 'UNIDADE' },
  { codigo: '14.1.6', descricao: 'Automóveis de 801 a 1.000 unidades', unidade: 'UNIDADE' },
  { codigo: '14.1.7', descricao: 'Automóveis de 1.001 a 1.500 unidades', unidade: 'UNIDADE' },
  { codigo: '14.1.8', descricao: 'Automóveis acima de 1.500 unidades', unidade: 'UNIDADE' },
  { codigo: '14.2', descricao: 'Roll-on-roll-off', unidade: 'UNIDADE' },
  { codigo: '14.3.1', descricao: 'Máquinas e equipamentos até 6 unidades', unidade: 'UNIDADE' },
  { codigo: '14.3.2', descricao: 'Máquinas e equipamentos de 7 a 12 unidades', unidade: 'UNIDADE' },
  { codigo: '14.3.3', descricao: 'Máquinas e equipamentos de 13 a 20 unidades', unidade: 'UNIDADE' },
  { codigo: '14.3.4', descricao: 'Máquinas e equipamentos de 21 a 30 unidades', unidade: 'UNIDADE' },
  { codigo: '14.3.5', descricao: 'Máquinas e equipamentos acima de 30 unidades', unidade: 'UNIDADE' },
] as const satisfies readonly LinhaCct[];

const fainasPatioArrumadores = [
  { codigo: '1.1', descricao: 'Carga ou descarga - manuseada', unidade: 'VOLUME' },
  { codigo: '1.2', descricao: 'Carga ou descarga - mecanizada', unidade: 'TON' },
  { codigo: '2.1', descricao: 'Desova ou ovacão manual - contêiner de 20 pés', unidade: 'CONTAINER' },
  { codigo: '2.2', descricao: 'Desova ou ovacão manual - contêiner de 40 pés', unidade: 'CONTAINER' },
  { codigo: '2.3', descricao: 'Desova com ovacão manual - contêiner de 20 pés', unidade: 'CONTAINER' },
  { codigo: '2.4', descricao: 'Desova com ovacão manual - contêiner de 40 pés', unidade: 'CONTAINER' },
  { codigo: '2.5', descricao: 'Desova parcial', unidade: 'CONTAINER' },
  { codigo: '3.1', descricao: 'Nivelamento em vagões, caminhões ou assemelhados', unidade: 'TON' },
  { codigo: '3.2', descricao: 'Carga ou descarga de silo, moega ou assemelhados - malte e start', unidade: 'TON' },
  { codigo: '3.3', descricao: 'Carga ou descarga de silo, moega ou assemelhados', unidade: 'TON' },
  { codigo: '3.4', descricao: 'Ensaque e costura à máquina com arrumação em caminhão ou assemelhados', unidade: 'VOLUME' },
  { codigo: '4.1', descricao: 'Recebimento - abrir e fechar carroceria', unidade: 'TON' },
  { codigo: '4.2', descricao: 'Recebimento - forrar piso de armazém', unidade: 'TON' },
  { codigo: '4.3', descricao: 'Transporte para costado - recolher forro do piso', unidade: 'TON' },
  { codigo: '4.4', descricao: 'Marinação de bobina de papel', unidade: 'TON' },
  { codigo: '5.1', descricao: 'Carga ou descarga de caminhão baú ou assemelhado - carne', unidade: 'TON' },
  { codigo: '5.2', descricao: 'Carga ou descarga de caminhão baú ou assemelhado - caixas de peixe', unidade: 'TON' },
  { codigo: '6.1', descricao: 'Veículos e vans até 150 unidades', unidade: 'UNIDADE' },
  { codigo: '6.2', descricao: 'Veículos e vans de 151 a 300 unidades', unidade: 'UNIDADE' },
  { codigo: '6.3', descricao: 'Veículos e vans acima de 300 unidades', unidade: 'UNIDADE' },
  { codigo: '7.1', descricao: 'Veículos até 50 unidades', unidade: 'UNIDADE' },
  { codigo: '7.2', descricao: 'Veículos de 51 a 100 unidades', unidade: 'UNIDADE' },
  { codigo: '7.3', descricao: 'Veículos de 101 a 300 unidades', unidade: 'UNIDADE' },
  { codigo: '7.4', descricao: 'Veículos de 301 a 600 unidades', unidade: 'UNIDADE' },
  { codigo: '8.1', descricao: 'Máquinas até 15 unidades', unidade: 'UNIDADE' },
  { codigo: '8.2', descricao: 'Máquinas acima de 15 unidades', unidade: 'UNIDADE' },
  { codigo: '9.1', descricao: 'Carga geral até 150 toneladas', unidade: 'TON' },
  { codigo: '9.2', descricao: 'Carga geral acima de 150 toneladas', unidade: 'TON' },
] as const satisfies readonly LinhaCct[];

const fainasPeacao = [
  { codigo: '19.0', descricao: 'Peação e despeação', unidade: 'UNIDADE' },
  { codigo: '19.1.1', descricao: 'Peação e despeação de automóveis e máquinas até 150 unidades', unidade: 'UNIDADE' },
  { codigo: '19.1.2', descricao: 'Peação e despeação de automóveis e máquinas de 151 a 300 unidades', unidade: 'UNIDADE' },
  { codigo: '19.1.3', descricao: 'Peação e despeação de automóveis e máquinas de 301 a 450 unidades', unidade: 'UNIDADE' },
  { codigo: '19.1.4', descricao: 'Peação e despeação de automóveis e máquinas de 451 a 600 unidades', unidade: 'UNIDADE' },
  { codigo: '19.1.5', descricao: 'Peação e despeação de automóveis e máquinas de 601 a 800 unidades', unidade: 'UNIDADE' },
  { codigo: '19.1.6', descricao: 'Peação e despeação de automóveis e máquinas de 801 a 1.000 unidades', unidade: 'UNIDADE' },
  { codigo: '19.1.7', descricao: 'Peação e despeação de automóveis e máquinas de 1.001 a 1.500 unidades', unidade: 'UNIDADE' },
  { codigo: '19.1.8', descricao: 'Peação e despeação de automóveis e máquinas acima de 1.500 unidades', unidade: 'UNIDADE' },
  { codigo: '19.2', descricao: 'Peação e despeação de roll-on-roll-off', unidade: 'UNIDADE' },
] as const satisfies readonly LinhaCct[];

const fainasSuport = [
  ...fainasComuns.filter((faina) => !['5.1', '5.9', '6.0', '6.1'].includes(faina.codigo)),
  { codigo: '5.1', descricao: 'Granito - função: encarregado, empilhadeirista e balanceiro', unidade: 'TON' },
  { codigo: '5.2', descricao: 'Granito - função: guindasteiro', unidade: 'TON' },
  { codigo: '5.3', descricao: 'Granito - função: capatazia', unidade: 'TON' },
  { codigo: '5.9', descricao: 'Produto siderúrgico', unidade: 'TON' },
  { codigo: '6.0', descricao: 'Contêiner', unidade: 'CONTAINER' },
  { codigo: '14.1.1', descricao: 'Automóvel até 300 unidades', unidade: 'UNIDADE' },
  { codigo: '14.1.2', descricao: 'Automóvel de 301 a 600 unidades', unidade: 'UNIDADE' },
  { codigo: '14.1.3', descricao: 'Automóvel de 601 a 1.000 unidades', unidade: 'UNIDADE' },
  { codigo: '14.1.4', descricao: 'Automóvel de 1.001 a 1.500 unidades', unidade: 'UNIDADE' },
  { codigo: '14.1.5', descricao: 'Automóvel acima de 1.500 unidades', unidade: 'UNIDADE' },
  { codigo: '14.2', descricao: 'Roll-on-roll-off', unidade: 'UNIDADE' },
  { codigo: '14.3', descricao: 'Máquinas e equipamentos', unidade: 'UNIDADE' },
] as const satisfies readonly LinhaCct[];

const fainasCapatazia = [
  { codigo: '2.0', descricao: 'Carga geral', unidade: 'TON' },
  { codigo: '2.1', descricao: 'Produto siderúrgico', unidade: 'TON' },
  { codigo: '2.2', descricao: 'Sacaria', unidade: 'TON' },
  { codigo: '2.3', descricao: 'Granito', unidade: 'TON' },
  { codigo: '2.4', descricao: 'Remoção de embarque de veículo montado', unidade: 'UNIDADE' },
  { codigo: '2.4.1', descricao: 'Máquina e equipamento', unidade: 'UNIDADE' },
  { codigo: '2.5', descricao: 'Consolidação e desconsolidação de TEUs', unidade: 'CONTAINER' },
  { codigo: '2.6', descricao: 'Embarque, descarga e remoção de contêiner', unidade: 'CONTAINER' },
  { codigo: '2.6.1', descricao: 'Com empilhadeira ou equipamento similar', unidade: 'CONTAINER' },
  { codigo: '2.7', descricao: 'Com transteiner', unidade: 'CONTAINER' },
  { codigo: '2.8', descricao: 'Fardos de celulose e bobinas de papel', unidade: 'TON' },
  { codigo: '2.9', descricao: 'Bobina de papel - descarga e embarque', unidade: 'TON' },
  { codigo: '2.10', descricao: 'Remoção de celulose e bobina', unidade: 'TON' },
  { codigo: '2.11', descricao: 'Marinação de bobina', unidade: 'TON' },
  { codigo: '2.12', descricao: 'Com aparelho automático', unidade: 'TON' },
  { codigo: '2.13', descricao: 'Com aparelho mecânico', unidade: 'TON' },
  { codigo: '2.14', descricao: 'Com aparelho de secção', unidade: 'TON' },
  { codigo: '2.15', descricao: 'Granéis PMODAL rodoviário com aparelho automático', unidade: 'TON' },
  { codigo: '2.16', descricao: 'Granéis PMODAL rodoviário com aparelho mecânico', unidade: 'TON' },
  { codigo: '2.17', descricao: 'Granéis PMODAL rodoviário com aparelho de secção', unidade: 'TON' },
  { codigo: '2.17.1', descricao: 'Ferro liga com aparelho mecânico', unidade: 'TON' },
  { codigo: '2.18', descricao: 'Transilagem', unidade: 'TON' },
  { codigo: '2.19', descricao: 'Lonamento e deslonamento, limpeza e abertura de contêiner', unidade: 'CONTAINER' },
  { codigo: '2.20', descricao: 'Amarração de veículo', unidade: 'UNIDADE' },
] as const satisfies readonly LinhaCct[];

/**
 * Levantamento documental das linhas de faina encontradas na CCT 2024/2026.
 *
 * Estas linhas não têm regra de cálculo habilitada de propósito. A CCT separa
 * salário-dia, salário-produção, taxa por homem/terno e composição por equipe;
 * a substituição do catálogo deverá validar como essas partes entram no SCO.
 */
export const fainasCctIniciais: readonly RegistroDeFaina[] = [
  ...linhas('COSTADO · ARRUMADORES', 48, fainasComuns),
  ...linhas('PÁTIO · ARRUMADORES', 49, fainasPatioArrumadores),
  ...linhas('CONFERENTES', 50, [...fainasComuns, ...fainasAutomoveisEMaquinas]),
  ...linhas('ESTIVADORES', 51, [...fainasComuns, ...fainasAutomoveisEMaquinas, ...fainasPeacao]),
  ...linhas('SUPORT', 52, fainasSuport),
  ...linhas('CAPATAZIA', 53, fainasCapatazia),
];
