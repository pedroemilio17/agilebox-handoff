import { useEffect, useId, useState } from 'react'
import { AI_MODELS, DEFAULT_AI_MODEL, type AiConfigStatus, type AiModel } from '@agilebox/contract'
import { Button, GlassSurface } from '@agilebox/ui'
import { panelCopy } from '../copy'
import styles from './SettingsView.module.css'

export function KanAiSection() {
  const aiBridge = window.agilebox?.ai
  const [status, setStatus] = useState<AiConfigStatus>({
    configured: false,
    model: DEFAULT_AI_MODEL,
    encrypted: false,
  })
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [model, setModel] = useState<AiModel>(DEFAULT_AI_MODEL)
  const [busy, setBusy] = useState<'save' | 'test' | 'clear' | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const keyId = useId()
  const modelId = useId()
  const hintId = useId()

  useEffect(() => {
    if (!aiBridge) return
    let cancelled = false
    void aiBridge
      .getConfig()
      .then((loaded) => {
        if (cancelled) return
        setStatus(loaded)
        setModel(loaded.model)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [aiBridge])

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    if (!aiBridge || busy !== null) return
    setBusy('save')
    setFeedback(null)
    try {
      const trimmed = apiKeyInput.trim()
      const saved = await aiBridge.saveConfig(trimmed ? { apiKey: trimmed, model } : { model })
      setStatus(saved)
      setModel(saved.model)
      setApiKeyInput('')
      setFeedback(panelCopy.aiSavedNotice)
    } catch {
      setFeedback(panelCopy.aiErrorFallback)
    } finally {
      setBusy(null)
    }
  }

  async function handleTest() {
    if (!aiBridge || busy !== null) return
    setBusy('test')
    setFeedback(null)
    try {
      const result = await aiBridge.testConnection()
      setFeedback(result.ok ? panelCopy.aiConnectionOk(result.model) : result.message)
    } catch {
      setFeedback(panelCopy.aiErrorFallback)
    } finally {
      setBusy(null)
    }
  }

  async function handleClear() {
    if (!aiBridge || busy !== null) return
    setBusy('clear')
    setFeedback(null)
    try {
      const cleared = await aiBridge.clearKey()
      setStatus(cleared)
      setModel(cleared.model)
      setApiKeyInput('')
      setFeedback(panelCopy.aiClearedNotice)
    } catch {
      setFeedback(panelCopy.aiErrorFallback)
    } finally {
      setBusy(null)
    }
  }

  return (
    <GlassSurface variant="group" className={styles.section} aria-label={panelCopy.aiSectionTitle}>
      <div className={styles.statusRow}>
        <h2 className={styles.sectionTitle}>{panelCopy.aiSectionTitle}</h2>
        <span
          className={`${styles.statusBadge} ${status.configured ? styles.statusBadgeConnected : ''}`}
          role="status"
        >
          {status.configured ? panelCopy.aiStatusConnected(status.model) : panelCopy.aiStatusLocal}
        </span>
      </div>
      <p id={hintId} className={styles.hint}>
        {panelCopy.aiSectionHint}
      </p>
      {aiBridge ? (
        <form className={styles.fieldGrid} onSubmit={(event) => void handleSave(event)}>
          <div className={styles.fieldGrid}>
            <label htmlFor={keyId} className={styles.label}>
              {panelCopy.aiApiKeyLabel}
            </label>
            <input
              id={keyId}
              className={styles.textField}
              type="password"
              autoComplete="off"
              value={apiKeyInput}
              disabled={busy !== null}
              aria-describedby={hintId}
              placeholder={
                status.configured
                  ? panelCopy.aiApiKeyReplacePlaceholder
                  : panelCopy.aiApiKeyPlaceholder
              }
              onChange={(event) => setApiKeyInput(event.currentTarget.value)}
            />
          </div>
          <div className={styles.fieldGrid}>
            <label htmlFor={modelId} className={styles.label}>
              {panelCopy.aiModelLabel}
            </label>
            <select
              id={modelId}
              className={styles.selectField}
              value={model}
              disabled={busy !== null}
              onChange={(event) => setModel(event.currentTarget.value as AiModel)}
            >
              {AI_MODELS.map((option) => (
                <option key={option} value={option}>
                  {panelCopy.aiModelLabels[option]}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.actions}>
            <Button type="submit" variant="primary" disabled={busy !== null}>
              {busy === 'save' ? panelCopy.aiSavingConfig : panelCopy.aiSaveConfig}
            </Button>
            {status.configured ? (
              <>
                <Button type="button" disabled={busy !== null} onClick={() => void handleTest()}>
                  {busy === 'test' ? panelCopy.aiTestingConnection : panelCopy.aiTestConnection}
                </Button>
                <Button type="button" disabled={busy !== null} onClick={() => void handleClear()}>
                  {panelCopy.aiClearKey}
                </Button>
              </>
            ) : null}
          </div>
          {feedback ? (
            <p role="status" className={styles.hint}>
              {feedback}
            </p>
          ) : null}
          <p className={styles.hint}>{panelCopy.aiPrivacyHint(status.encrypted)}</p>
        </form>
      ) : (
        <p className={styles.hint}>{panelCopy.aiUnavailable}</p>
      )}
    </GlassSurface>
  )
}
