import { useId, useState } from 'react'
import type { AppearanceMode } from '@agilebox/contract'
import { useTeamTools } from '../../shared/capabilities/use-team-tools'
import {
  readWindowOpacity,
  saveWindowOpacity,
  WINDOW_OPACITY_DEFAULT,
  WINDOW_OPACITY_MAX,
  WINDOW_OPACITY_MIN,
} from '../../shared/lib/window-opacity'
import { panelCopy } from '../copy'
import { TeamToolsSection } from '../team-tools/TeamToolsSection'
import { Badge, CleanList, CleanRow, PageHead, QuietToggle, Section, TopicLayout } from './clean-ui'
import type { RailGroup } from './clean-ui'
import cleanStyles from './clean-ui.module.css'
import { KanAiSection } from './KanAiSection'
import { MyRateSection } from './MyRateSection'
import { settingsCopy } from './settings-copy'
import { UpdatesSection } from './UpdatesSection'
import styles from './SettingsView.module.css'

const percent = (value: number) => Math.round(value * 100)

/** Ao recriar as janelas o painel volta aberto em Ajustes (ver App). */
export const REOPEN_SETTINGS_KEY = 'agilebox.reopenSettings'
const TOPIC_KEY = 'agilebox.settingsTopic'

type Topic = 'tools' | 'preferences' | 'updates'
const TOPICS: readonly Topic[] = ['tools', 'preferences', 'updates']

const currentAppearance = (): AppearanceMode =>
  document.documentElement.dataset.glass === 'opaque' ? 'opaque' : 'translucent'

function readTopic(): Topic {
  try {
    const saved = window.localStorage.getItem(TOPIC_KEY)
    return TOPICS.find((topic) => topic === saved) ?? 'tools'
  } catch {
    return 'tools'
  }
}

function Preferences() {
  const [opacity, setOpacity] = useState(readWindowOpacity)
  const [appearance, setAppearance] = useState<AppearanceMode>(currentAppearance)
  const sliderId = useId()

  return (
    <>
      <Section title={settingsCopy.preferencesTitle} meta={settingsCopy.preferencesMeta}>
        <CleanList>
          <CleanRow name={settingsCopy.surfaceName} description={settingsCopy.surfaceDesc}>
            <QuietToggle<AppearanceMode>
              ariaLabel={settingsCopy.surfaceGroup}
              value={appearance}
              onChange={(mode) => {
                if (mode === appearance) return
                setAppearance(mode)
                try {
                  window.localStorage.setItem(REOPEN_SETTINGS_KEY, '1')
                } catch {
                  // Sem armazenamento o painel reabre no quadro.
                }
                window.agilebox.shell.setAppearance({ mode })
              }}
              options={[
                { value: 'translucent', label: settingsCopy.glass },
                { value: 'opaque', label: settingsCopy.solid },
              ]}
            />
          </CleanRow>
          <CleanRow
            name={<label htmlFor={sliderId}>{settingsCopy.opacityName}</label>}
            description={
              appearance === 'opaque' ? settingsCopy.opacityOnlyGlass : settingsCopy.opacityDesc
            }
          >
            <div className={styles.sliderWrap}>
              <input
                id={sliderId}
                className={styles.slider}
                type="range"
                min={percent(WINDOW_OPACITY_MIN)}
                max={percent(WINDOW_OPACITY_MAX)}
                step={1}
                value={percent(opacity)}
                aria-valuetext={`${percent(opacity)}%`}
                disabled={appearance === 'opaque'}
                onChange={(event) =>
                  setOpacity(saveWindowOpacity(Number(event.currentTarget.value) / 100))
                }
              />
              <output htmlFor={sliderId} className={styles.sliderValue}>
                {percent(opacity)}%
              </output>
              <button
                type="button"
                className={cleanStyles.ghostBtn}
                disabled={appearance === 'opaque' || opacity === WINDOW_OPACITY_DEFAULT}
                onClick={() => setOpacity(saveWindowOpacity(WINDOW_OPACITY_DEFAULT))}
              >
                {panelCopy.restoreDefault}
              </button>
            </div>
          </CleanRow>
          <MyRateSection />
        </CleanList>
      </Section>
      <KanAiSection />
    </>
  )
}

export function SettingsView() {
  const [topic, setTopic] = useState<Topic>(readTopic)
  const tools = useTeamTools()
  const countable = (tools.data?.modules ?? []).filter((tool) => tool.id !== 'core')
  const toolsCount =
    countable.length > 0
      ? `${countable.filter((tool) => tool.state === 'active').length}/${countable.length}`
      : undefined

  const groups: readonly RailGroup<Topic>[] = [
    {
      label: settingsCopy.groupProject,
      items: [{ id: 'tools', label: settingsCopy.topicTools, count: toolsCount }],
    },
    {
      label: settingsCopy.groupApp,
      items: [
        { id: 'preferences', label: settingsCopy.topicPreferences },
        { id: 'updates', label: settingsCopy.topicUpdates },
      ],
    },
  ]

  return (
    <div className={styles.view}>
      <PageHead
        title={settingsCopy.pageTitle}
        subtitle={settingsCopy.pageSubtitle}
        actions={<Badge>{settingsCopy.savedBadge}</Badge>}
      />
      <TopicLayout
        ariaLabel={settingsCopy.railLabel}
        groups={groups}
        activeId={topic}
        onSelect={(next) => {
          setTopic(next)
          try {
            window.localStorage.setItem(TOPIC_KEY, next)
          } catch {
            // Só não lembra o tópico.
          }
        }}
      >
        {topic === 'tools' ? <TeamToolsSection /> : null}
        {topic === 'preferences' ? <Preferences /> : null}
        {topic === 'updates' ? <UpdatesSection /> : null}
      </TopicLayout>
    </div>
  )
}
