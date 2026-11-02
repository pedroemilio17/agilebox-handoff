import { z } from 'zod'
import { experienceLevelSchema } from './team-modules'

/** Nível do time (M2.9b). Qualquer integrante lê; só o gestor grava. */
export const getTeamLevelInputSchema = z.undefined()
export const getTeamLevelOutputSchema = experienceLevelSchema

export const setTeamLevelInputSchema = z.object({
  level: experienceLevelSchema,
})
export const setTeamLevelOutputSchema = experienceLevelSchema
