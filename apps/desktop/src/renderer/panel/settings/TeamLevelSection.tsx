import { LEVEL_LABELS, TEAM_SCOPE_NOTICE } from '@agilebox/core'
import type { ExperienceLevel } from '@agilebox/core'
import { GlassSurface, SegmentedControl } from '@agilebox/ui'
import type { SegmentedOption } from '@agilebox/ui'
import { panelCopy } from '../copy'
import { useTeamCapabilities } from '../hooks/use-team-capabilities'
import { useSetTeamLevel } from './use-set-team-level'
import styles from './SettingsView.module.css'

const LEVEL_OPTIONS: readonly [
  SegmentedOption<ExperienceLevel>,
  SegmentedOption<ExperienceLevel>,
  SegmentedOption<ExperienceLevel>,
] = [
  { value: 'basic', label: LEVEL_LABELS.basic.name },
  { value: 'intermediate', label: LEVEL_LABELS.intermediate.name },
  { value: 'advanced', label: LEVEL_LABELS.advanced.name },
]

/**
 * Nível do time (quadro 07). Visível só para o gestor: quem decide o nível é quem vê o
 * dashboard. Trocar o nível não muda ferramentas ligadas nem apaga dados.
 */
export function TeamLevelSection() {
  const capabilities = useTeamCapabilities()
  const setLevel = useSetTeamLevel()
  const level = capabilities.data?.level

  return (
    <GlassSurface variant="group" className={styles.section} aria-label={panelCopy.teamLevel}>
      <h2 className={styles.sectionTitle}>{panelCopy.teamLevel}</h2>
      {level ? (
        <>
          <SegmentedControl<ExperienceLevel>
            aria-label={panelCopy.teamLevelOptions}
            value={level}
            options={LEVEL_OPTIONS}
            onChange={(next) => {
              if (next === level || setLevel.isPending) return
              setLevel.mutate(next)
            }}
          />
          <p className={styles.hint}>{LEVEL_LABELS[level].description}</p>
        </>
      ) : null}
      <p className={styles.hint}>{TEAM_SCOPE_NOTICE}</p>
      {setLevel.isError ? <p role="alert">{panelCopy.teamLevelError}</p> : null}
    </GlassSurface>
  )
}
