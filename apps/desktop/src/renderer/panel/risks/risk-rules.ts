import { riskBand, riskScore, type RiskBand, type RiskLevel, type RiskStatus } from '@agilebox/core'
import {
  RISK_DESCRIPTION_INPUT_MAX,
  RISK_RESPONSE_INPUT_MAX,
  RISK_TITLE_INPUT_MAX,
} from '@agilebox/contract'

/**
 * Regras puras da tela Riscos: faixa e pontuação em texto, rótulos e validação do formulário. A faixa
 * sempre sai com texto ("Alto"), além da cor, para não depender só de cor.
 */

export const riskCopy = {
  title: 'Riscos',
  noProject: 'Escolha um projeto para ver os riscos.',
  listLabel: 'Lista de riscos',
  loading: 'Carregando os riscos…',
  loadError: 'Não foi possível carregar os riscos deste projeto.',
  retry: 'Tentar de novo',
  readOnly: 'Só o gestor ou quem criou o projeto edita os riscos.',
  newRisk: 'Novo risco',
  save: 'Salvar',
  cancel: 'Cancelar',
  edit: 'Editar',
  remove: 'Remover',
  confirmRemove: 'Confirmar remoção',
  formTitleNew: 'Novo risco',
  formTitleEdit: 'Editar risco',
  titleLabel: 'Título do risco',
  descriptionLabel: 'Descrição (opcional)',
  probabilityLabel: 'Probabilidade',
  impactLabel: 'Impacto',
  responseLabel: 'Resposta (opcional)',
  ownerLabel: 'Dono',
  noOwner: 'Sem dono',
  deliverableLabel: 'Entrega',
  noDeliverable: 'Sem entrega',
  statusLabel: 'Situação',
  ownerText: 'Dono',
  deliverableText: 'Entrega',
  responseText: 'Resposta',
  titleRequired: 'Dê um título ao risco.',
  titleTooLong: `O título pode ter até ${RISK_TITLE_INPUT_MAX} caracteres.`,
  descriptionTooLong: `A descrição pode ter até ${RISK_DESCRIPTION_INPUT_MAX} caracteres.`,
  responseTooLong: `A resposta pode ter até ${RISK_RESPONSE_INPUT_MAX} caracteres.`,
} as const

const BAND_LABEL: Record<RiskBand, string> = { low: 'Baixo', medium: 'Médio', high: 'Alto' }

const LEVEL_LABEL: Record<RiskLevel, string> = { 1: 'Baixa', 2: 'Média', 3: 'Alta' }

const STATUS_LABEL: Record<RiskStatus, string> = {
  open: 'Aberto',
  mitigated: 'Mitigado',
  occurred: 'Ocorreu',
  closed: 'Encerrado',
}

export const RISK_LEVEL_OPTIONS: readonly RiskLevel[] = [1, 2, 3]
export const RISK_STATUS_OPTIONS: readonly RiskStatus[] = [
  'open',
  'mitigated',
  'occurred',
  'closed',
]

export function levelLabel(level: RiskLevel): string {
  return LEVEL_LABEL[level]
}

export function statusLabel(status: RiskStatus): string {
  return STATUS_LABEL[status]
}

/** Faixa e pontuação de um risco: "Alto · 9". O texto da faixa é o que leitores de tela leem. */
export function riskSummary(
  probability: RiskLevel,
  impact: RiskLevel,
): {
  readonly score: number
  readonly band: RiskBand
  readonly bandLabel: string
  readonly text: string
} {
  const score = riskScore(probability, impact)
  const band = riskBand(score)
  const bandLabel = BAND_LABEL[band]
  return { score, band, bandLabel, text: `${bandLabel} · pontuação ${score}` }
}

export interface RiskFormValues {
  readonly title: string
  readonly description: string
  readonly probability: RiskLevel
  readonly impact: RiskLevel
  readonly response: string
  readonly ownerId: string
  readonly deliverableId: string
  readonly status: RiskStatus
}

export interface RiskFormErrors {
  readonly title?: string
  readonly description?: string
  readonly response?: string
}

/** Validação do formulário antes de enviar. O servidor confere de novo e a recusa aparece na tela. */
export function validateRiskForm(values: RiskFormValues): RiskFormErrors {
  const errors: { title?: string; description?: string; response?: string } = {}
  const title = values.title.trim()
  if (title === '') errors.title = riskCopy.titleRequired
  else if (Array.from(title).length > RISK_TITLE_INPUT_MAX) errors.title = riskCopy.titleTooLong
  if (Array.from(values.description.trim()).length > RISK_DESCRIPTION_INPUT_MAX)
    errors.description = riskCopy.descriptionTooLong
  if (Array.from(values.response.trim()).length > RISK_RESPONSE_INPUT_MAX)
    errors.response = riskCopy.responseTooLong
  return errors
}

/** Texto vazio vira nulo no envio (descrição, resposta). */
export function textOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Seletor vazio vira nulo (dono e entrega). */
export function idOrNull(value: string): string | null {
  return value === '' ? null : value
}
