import { z } from 'zod'
import { projectPresetKeySchema } from './projects'
import { ulidSchema } from './shared-schemas'

/**
 * Guia de alimentação (ADR-10). A trilha vem dos módulos ativos do projeto; o progresso é da pessoa
 * que lê. O passo se conclui sozinho quando a pessoa faz a ação: não existe "marcar como feito".
 */

export const guideExperienceSchema = z.enum(['never', 'sometimes', 'always'])

export const guideIntensitySchema = z.object({
  firstStepsCard: z.enum(['open', 'collapsed', 'hidden']),
  emptyState: z.enum(['full', 'short']),
  firstTimeHints: z.boolean(),
  explainJargon: z.boolean(),
})

/** Um passo da trilha, com o que a pessoa já fez nele. */
export const guideStepDtoSchema = z.object({
  key: z.string(),
  title: z.string(),
  why: z.string(),
  moduleId: z.string(),
  moduleName: z.string(),
  /** Título do passo seguinte, o "O que vem depois". `null` no último. */
  next: z.string().nullable(),
  /** Evento que conclui o passo (ex.: `task.created`). */
  doneWhen: z.string(),
  done: z.boolean(),
})

export const getGuideInputSchema = z.object({ projectId: ulidSchema })

/**
 * Janela de boas-vindas (ADR-10): aparece para quem entrou num projeto já em andamento. `welcome`
 * traz o que a janela mostra; é nulo quando `showWelcome` é falso.
 */
export const guideWelcomeDtoSchema = z.object({
  projectName: z.string(),
  /** Preset de partida do projeto (assistente), ou nulo quando ele não usou o assistente. */
  presetKey: projectPresetKeySchema.nullable(),
  /** Nome do preset na interface ("Ágil"), ou nulo junto com `presetKey`. */
  presetLabel: z.string().nullable(),
  /** Módulos ligados no projeto, sem o núcleo. */
  moduleCount: z.number().int().nonnegative(),
})

export const guideViewDtoSchema = z.object({
  projectId: ulidSchema,
  trail: z.array(guideStepDtoSchema),
  done: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  /** Primeiro passo ainda não concluído, na ordem da trilha. */
  currentKey: z.string().nullable(),
  experience: guideExperienceSchema,
  intensity: guideIntensitySchema,
  /** A pessoa dispensou o cartão "Primeiros passos" neste projeto. */
  cardDismissed: z.boolean(),
  /** Mostrar a janela de boas-vindas agora (ver `isWelcomeDue` no domínio). */
  showWelcome: z.boolean(),
  welcome: guideWelcomeDtoSchema.nullable(),
})

export const dismissGuideCardInputSchema = z.object({ projectId: ulidSchema })
export const dismissGuideCardOutputSchema = z.void()

export const resolveGuideWelcomeInputSchema = z.object({ projectId: ulidSchema })
export const resolveGuideWelcomeOutputSchema = z.void()

export type GetGuideInput = z.infer<typeof getGuideInputSchema>
export type GuideStepDto = z.infer<typeof guideStepDtoSchema>
export type GuideViewDto = z.infer<typeof guideViewDtoSchema>
export type GuideWelcomeDto = z.infer<typeof guideWelcomeDtoSchema>
export type ResolveGuideWelcomeInput = z.infer<typeof resolveGuideWelcomeInputSchema>
export type DismissGuideCardInput = z.infer<typeof dismissGuideCardInputSchema>
