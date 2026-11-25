import { useEffect, useState } from 'react'
import type { UpdateInfo, UpdateRun, UpdateStatus, UpdateStep } from '@agilebox/contract'
import { Button } from '@agilebox/ui'
import { panelCopy } from '../copy'
import { CleanList, CleanRow, Section } from './clean-ui'
import cleanStyles from './clean-ui.module.css'
import { settingsCopy } from './settings-copy'
import styles from './SettingsView.module.css'

function describe(status: UpdateStatus): string {
  switch (status.state) {
    case 'unsupported':
      return status.reason
    case 'dirty':
      return settingsCopy.updateDirty
    case 'up-to-date':
      return settingsCopy.upToDate
    case 'available':
      return settingsCopy.updateAvailable
    case 'ready':
      return settingsCopy.updateReady
    case 'started':
      return settingsCopy.updateRestarting
    case 'done-dev':
      return settingsCopy.updateDoneDev
    case 'error':
      return settingsCopy.updateFailed
  }
}

/** Etapas em linguagem comum: nada de git, pnpm ou compilação na tela. */
const stepText = (step: UpdateStep) =>
  step === 'download' || step === 'pull' ? 'Baixando a atualização…' : 'Preparando a atualização…'

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))

type Action = 'check' | 'apply' | 'restart'

export function UpdatesSection() {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [busy, setBusy] = useState<Action | null>(null)
  const [step, setStep] = useState<UpdateStep | null>(null)
  const [lastRun, setLastRun] = useState<UpdateRun | null>(null)
  const [info, setInfo] = useState<UpdateInfo | null>(null)

  useEffect(() => {
    void window.agilebox.updates.lastRun().then(setLastRun)
    void window.agilebox.updates.info().then(setInfo)
    return window.agilebox.updates.onProgress(setStep)
  }, [])

  async function act(action: Action) {
    setBusy(action)
    setStep(null)
    try {
      const { updates } = window.agilebox
      setStatus(
        await (action === 'check'
          ? updates.check()
          : action === 'apply'
            ? updates.apply()
            : updates.restart()),
      )
    } catch (error) {
      setStatus({ state: 'error', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(null)
      setStep(null)
    }
  }

  const finished = status?.state === 'started'
  const working = busy === 'apply'

  const statusText = working
    ? step
      ? stepText(step)
      : settingsCopy.updateInstalling
    : status
      ? describe(status)
      : settingsCopy.autoCheck
  const title = info ? `AgileBox Desktop ${info.version}` : settingsCopy.updatesTitle

  return (
    <Section
      title={settingsCopy.updatesTitle}
      ariaLabel={panelCopy.updates}
      meta={
        info?.mode === 'release' ? (
          <>
            <span className={cleanStyles.dotOk} aria-hidden="true" />
            <span>{settingsCopy.stableChannel}</span>
          </>
        ) : undefined
      }
    >
      <CleanList>
        <CleanRow
          name={title}
          description={<span role="status">{statusText}</span>}
          extra={
            lastRun ? (
              <p className={styles.hint}>
                {panelCopy.lastUpdate(formatWhen(lastRun.at), lastRun.ok)}
              </p>
            ) : null
          }
        >
          {status?.state === 'ready' ? (
            <Button
              type="button"
              variant="primary"
              disabled={busy !== null}
              onClick={() => void act('restart')}
            >
              {panelCopy.restartNow}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                disabled={busy !== null || finished}
                onClick={() => void act('check')}
              >
                {busy === 'check' ? settingsCopy.checking : settingsCopy.checkUpdates}
              </Button>
              {status?.state === 'available' || working ? (
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy !== null}
                  onClick={() => void act('apply')}
                >
                  {working ? panelCopy.applyingUpdate : panelCopy.applyUpdate}
                </Button>
              ) : null}
            </>
          )}
        </CleanRow>
      </CleanList>
    </Section>
  )
}
