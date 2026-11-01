import { useEffect, useState } from 'react'
import type { UpdateRun, UpdateStatus } from '@agilebox/contract'
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

export function UpdatesSection() {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [busy, setBusy] = useState<'check' | 'apply' | null>(null)
  const [lastRun, setLastRun] = useState<UpdateRun | null>(null)

  useEffect(() => {
    void window.agilebox.updates.lastRun().then(setLastRun)
  }, [])

  async function act(kind: 'check' | 'apply') {
    setBusy(kind)
    try {
      setStatus(
        await (kind === 'check'
          ? window.agilebox.updates.check()
          : window.agilebox.updates.apply()),
      )
    } catch (error) {
      setStatus({ state: 'error', message: error instanceof Error ? error.message : String(error) })
    } finally {
      setBusy(null)
    }
  }

  const started = status?.state === 'started'

  return (
    <GlassSurface variant="group" className={styles.section} aria-label={panelCopy.updates}>
      <h2 className={styles.sectionTitle}>{panelCopy.updates}</h2>
      <p className={styles.hint}>{panelCopy.updatesHint}</p>
      {status ? (
        <div role="status" className={styles.updateStatus}>
          <p className={styles.label}>{describe(status)}</p>
          {status.state === 'available' ? (
            <ul className={styles.commits}>
              {status.commits.map((commit, index) => (
                <li key={`${index}-${commit}`}>{commit}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className={styles.actions}>
        <Button type="button" disabled={busy !== null || started} onClick={() => void act('check')}>
          {busy === 'check' ? panelCopy.checkingUpdates : panelCopy.checkUpdates}
        </Button>
        {status?.state === 'available' ? (
          <Button
            type="button"
            variant="primary"
            disabled={busy !== null}
            onClick={() => void act('apply')}
          >
            {busy === 'apply' ? panelCopy.applyingUpdate : panelCopy.applyUpdate}
          </Button>
        ) : null}
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
