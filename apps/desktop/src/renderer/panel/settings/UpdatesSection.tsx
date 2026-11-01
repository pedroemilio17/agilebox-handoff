import { useEffect, useState } from 'react'
import type { UpdateInfo, UpdateRun, UpdateStatus, UpdateStep } from '@agilebox/contract'
import { Button, GlassSurface } from '@agilebox/ui'
import { panelCopy } from '../copy'
import styles from './SettingsView.module.css'

function describe(status: UpdateStatus): string {
  switch (status.state) {
    case 'unsupported':
      return status.reason
    case 'dirty':
      return panelCopy.updateDirty(status.files)
    case 'up-to-date':
      return panelCopy.updateUpToDate(status.commit)
    case 'available':
      return panelCopy.updateAvailable(status.behind)
    case 'ready':
      return panelCopy.updateReady
    case 'started':
      return panelCopy.updateStarted
    case 'done-dev':
      return panelCopy.updateDoneDev
    case 'error':
      return panelCopy.updateError(status.message)
  }
}

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

  return (
    <GlassSurface variant="group" className={styles.section} aria-label={panelCopy.updates}>
      <h2 className={styles.sectionTitle}>{panelCopy.updates}</h2>
      {info ? (
        <p className={styles.label}>{panelCopy.installedVersion(info.version, info.mode)}</p>
      ) : null}
      <p className={styles.hint}>
        {info?.mode === 'release' ? panelCopy.updatesHintRelease : panelCopy.updatesHint}
      </p>
      <div role="status" className={styles.updateStatus}>
        {working ? (
          <p className={styles.label}>
            {step ? panelCopy.updateSteps[step] : panelCopy.applyingUpdate}
          </p>
        ) : status ? (
          <>
            <p className={styles.label}>{describe(status)}</p>
            {status.state === 'available' ? (
              <ul className={styles.commits}>
                {status.commits.map((commit, index) => (
                  <li key={`${index}-${commit}`}>{commit}</li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
      <div className={styles.actions}>
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
              {busy === 'check' ? panelCopy.checkingUpdates : panelCopy.checkUpdates}
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
      </div>
      {lastRun ? (
        <p className={styles.hint}>
          {panelCopy.lastUpdate(formatWhen(lastRun.at), lastRun.ok)}{' '}
          {lastRun.ok ? null : (
            <>
              {lastRun.message}. {panelCopy.updateLog} <code>{lastRun.logPath}</code>
            </>
          )}
        </p>
      ) : null}
    </GlassSurface>
  )
}
