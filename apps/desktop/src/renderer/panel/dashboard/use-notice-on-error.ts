import { useEffect, useRef } from 'react'

export type NoticeHandler = (message: string, tone?: 'default' | 'warning') => void

/** Mostra um aviso curto uma vez quando a consulta falha (sem repetir a cada render). */
export function useNoticeOnError(failed: boolean, message: string, onNotice?: NoticeHandler) {
  const noticeRef = useRef(onNotice)
  useEffect(() => {
    noticeRef.current = onNotice
  })
  useEffect(() => {
    if (failed) noticeRef.current?.(message, 'warning')
  }, [failed, message])
}
