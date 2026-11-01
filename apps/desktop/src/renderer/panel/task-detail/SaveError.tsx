import { ApiError } from '@agilebox/contract'
import { Toast } from '@agilebox/ui'
import { panelCopy } from '../copy'

export interface SaveErrorProps {
  readonly error: unknown
}

/** Permissão negada vira aviso curto (toast); qualquer outra falha, um alerta de texto. */
export function SaveError({ error }: SaveErrorProps) {
  if (!error) return null
  if (error instanceof ApiError && error.code === 'FORBIDDEN') {
    return <Toast message={panelCopy.forbidden} />
  }
  return <p role="alert">{panelCopy.saveError}</p>
}
