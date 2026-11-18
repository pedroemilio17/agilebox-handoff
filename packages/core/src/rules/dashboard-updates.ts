import type { TimelineEvent } from '../entities/timeline-event'

/** Categoria de um movimento da linha do tempo, para o filtro "Tipo de atualização". */
export type UpdateCategory = 'status' | 'estimate' | 'deadline' | 'comment' | 'other'

/** Agrupa os tipos de evento em categorias de tela. Só categorias que têm dado na linha do tempo. */
export function updateCategoryOf(event: TimelineEvent): UpdateCategory {
  switch (event.type) {
    case 'status_changed':
      return 'status'
    case 'estimate_changed':
    case 'hours_changed':
    case 'rate_changed':
      return 'estimate'
    case 'deadline_changed':
    case 'start_changed':
      return 'deadline'
    case 'comment_added':
    case 'comment_removed':
      return 'comment'
    default:
      return 'other'
  }
}
