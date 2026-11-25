import { useEffect, useId, useState } from 'react'
import { AI_MODELS, DEFAULT_AI_MODEL, type AiConfigStatus, type AiModel } from '@agilebox/contract'
import { Button } from '@agilebox/ui'
import { panelCopy } from '../copy'
import { CleanList, CleanRow, Section } from './clean-ui'
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

  const statusLabel = status.configured
    ? panelCopy.aiStatusConnected(status.model)
    : panelCopy.aiStatusLocal

  return (
    <Section
      title={panelCopy.aiSectionTitle}
      ariaLabel={panelCopy.aiSectionTitle}
      meta={
        <span role="status" className={status.configured ? undefined : styles.statusBadge}>
          {statusLabel}
        </span>
      }
    >
      <p id={hintId} className={styles.hint}>
        {panelCopy.aiSectionHint}
      </p>
      {aiBridge ? (
        <form onSubmit={(event) => void handleSave(event)}>
          <CleanList>
            <CleanRow name={<label htmlFor={keyId}>{panelCopy.aiApiKeyLabel}</label>}>
              <input
                id={keyId}
                className={`${styles.fieldInput} ${styles.wideInput}`}
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
            </CleanRow>
            <CleanRow name={<label htmlFor={modelId}>{panelCopy.aiModelLabel}</label>}>
              <select
                id={modelId}
                className={`${styles.fieldInput} ${styles.wideInput}`}
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
            </CleanRow>
            <CleanRow
              name=""
              extra={
                <>
                  {feedback ? (
                    <p role="status" className={styles.hint}>
                      {feedback}
                    </p>
                  ) : null}
                  <p className={styles.hint}>{panelCopy.aiPrivacyHint(status.encrypted)}</p>
                </>
              }
            >
              <Button type="submit" variant="primary" size="sm" disabled={busy !== null}>
                {busy === 'save' ? panelCopy.aiSavingConfig : panelCopy.aiSaveConfig}
              </Button>
              {status.configured ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => void handleTest()}
                  >
                    {busy === 'test' ? panelCopy.aiTestingConnection : panelCopy.aiTestConnection}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => void handleClear()}
                  >
                    {panelCopy.aiClearKey}
                  </Button>
                </>
              ) : null}
            </CleanRow>
          </CleanList>
        </form>
      ) : (
        <p className={styles.hint}>{panelCopy.aiUnavailable}</p>
      )}
    </Section>
  )
}
