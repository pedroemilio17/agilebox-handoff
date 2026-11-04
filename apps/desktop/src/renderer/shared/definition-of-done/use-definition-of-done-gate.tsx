import { useRef, useState } from 'react'
import { ApiError } from '@agilebox/contract'
import type { DefinitionOfDoneItemDto } from '@agilebox/contract'
import { useApi } from '../api/ApiProvider'
import { DefinitionOfDoneDialog } from './DefinitionOfDoneDialog'
import { isDefinitionOfDoneNotConfirmed } from './definition-of-done'

interface Item {
  readonly id: string
  readonly title: string
}

export interface ConcludeRequest {
  readonly projectId: string
  /** Itens do projeto já conhecidos (ex.: detalhe da tarefa). Sem eles, a conferência busca a lista. */
  readonly items?: readonly DefinitionOfDoneItemDto[]
  /** Quantos itens o projeto tem pelo último cache; zero conclui direto, sem conferência. */
  readonly definitionOfDoneCount: number
  /**
   * Faz a conclusão com os ids confirmados. Falhas que não sejam a conferência são
   * tratadas por quem chamou (desfazer a mudança otimista, aviso); aqui só são engolidas.
   */
  readonly complete: (confirmedDefinitionItemIds: readonly string[]) => Promise<unknown>
  /** Cancelar a conferência: a tela volta ao estado de antes. */
  readonly onCancel?: () => void
}

interface Opening {
  readonly request: ConcludeRequest
  /** Muda a cada abertura, para o diálogo começar sem marcações. */
  readonly seq: number
  readonly items: readonly Item[] | null
  readonly reopened: boolean
  readonly saving: boolean
}

/**
 * Conclusão de tarefa com a conferência da definição de pronto. Projeto sem itens conclui direto.
 * Quem chama decide o texto de erro; a conferência só abre quando o servidor exige.
 */
export function useDefinitionOfDoneGate() {
  const api = useApi()
  const [opening, setOpening] = useState<Opening | null>(null)
  const sequence = useRef(0)

  function show(request: ConcludeRequest, items: readonly Item[] | null, reopened: boolean) {
    sequence.current += 1
    setOpening({ request, seq: sequence.current, items, reopened, saving: false })
  }

  async function fetchItems(projectId: string): Promise<Item[] | null> {
    try {
      const list = await api.projects.definitionOfDone.list({ projectId })
      return list.map((item) => ({ id: item.id, title: item.title }))
    } catch {
      return null
    }
  }

  /** Conclui sem conferência; se o servidor exigir, abre a conferência com a lista atual. */
  async function attempt(request: ConcludeRequest): Promise<void> {
    try {
      await request.complete([])
    } catch (error) {
      if (isDefinitionOfDoneNotConfirmed(error)) await reopen(request, error)
    }
  }

  async function reopen(request: ConcludeRequest, error: ApiError): Promise<void> {
    const current = await fetchItems(request.projectId)
    if (current !== null && current.length === 0) {
      // Não há mais itens: a conclusão vale sem conferência.
      await request.complete([]).catch(() => undefined)
      return
    }
    const missing = error.missingItems.map((item) => ({ id: item.id, title: item.title }))
    show(request, current ?? (missing.length > 0 ? missing : null), true)
  }

  async function conclude(request: ConcludeRequest): Promise<void> {
    if (request.items !== undefined) {
      if (request.items.length > 0) {
        show(
          request,
          request.items.map((item) => ({ id: item.id, title: item.title })),
          false,
        )
        return
      }
      return attempt(request)
    }
    if (request.definitionOfDoneCount === 0) return attempt(request)
    const items = await fetchItems(request.projectId)
    if (items === null) {
      show(request, null, false)
      return
    }
    if (items.length === 0) return attempt(request)
    show(request, items, false)
  }

  async function confirm(): Promise<void> {
    if (!opening || opening.items === null) return
    const { request, items } = opening
    setOpening({ ...opening, saving: true })
    try {
      await request.complete(items.map((item) => item.id))
      setOpening(null)
    } catch (error) {
      setOpening(null)
      if (isDefinitionOfDoneNotConfirmed(error)) await reopen(request, error)
    }
  }

  function cancel(): void {
    const request = opening?.request
    setOpening(null)
    request?.onCancel?.()
  }

  const dialog = opening ? (
    <DefinitionOfDoneDialog
      key={opening.seq}
      items={opening.items}
      reopened={opening.reopened}
      saving={opening.saving}
      onConfirm={() => void confirm()}
      onCancel={cancel}
    />
  ) : null

  return {
    conclude: (request: ConcludeRequest) => void conclude(request),
    dialog,
    active: opening !== null,
  }
}
