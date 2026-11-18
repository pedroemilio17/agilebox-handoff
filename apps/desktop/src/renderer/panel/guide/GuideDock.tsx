import type { PanelView } from '../layout/PanelShell'
import { useGuide } from '../hooks/use-guide'
import { GuideCard } from './GuideCard'
import { guideMayShowOn, guideOnScreen } from './guide-card-state'

export interface GuideDockProps {
  /** Projeto selecionado. Sem projeto, o guia não aparece em nenhuma tela. */
  readonly projectId: string | null
  /** Tela atual do painel. O cartão só aparece nas telas do fluxo (ver `guideOnScreen`). */
  readonly view: PanelView
  readonly onNavigate: (view: PanelView) => void
  readonly onOpenTray?: (() => void) | undefined
  /** Contador de pedidos para abrir o cartão (ex.: "Ver a trilha" da janela de boas-vindas). */
  readonly openRequest?: number | undefined
}

/**
 * Cartão "Primeiros passos" como faixa do painel: aparece no topo de cada tela do fluxo do projeto,
 * não só no quadro (ADR-10, 3.8.1). Reinicia a cada tela (chave pela tela), para abrir ou recolher
 * conforme o passo atual. Não bloqueia nada: sem projeto, ou sem trilha, não renderiza.
 */
export function GuideDock({
  projectId,
  view,
  onNavigate,
  onOpenTray,
  openRequest,
}: GuideDockProps) {
  // Telas fora do fluxo nem consultam o guia.
  if (projectId === null || !guideMayShowOn(view)) return null
  return (
    <GuideDockOnScreen
      projectId={projectId}
      view={view}
      onNavigate={onNavigate}
      onOpenTray={onOpenTray}
      openRequest={openRequest}
    />
  )
}

/** Decide com a trilha em mãos (a agenda depende dela) e monta o cartão da tela. */
function GuideDockOnScreen({
  projectId,
  view,
  onNavigate,
  onOpenTray,
  openRequest,
}: Required<Pick<GuideDockProps, 'projectId' | 'view' | 'onNavigate'>> &
  Pick<GuideDockProps, 'onOpenTray' | 'openRequest'>) {
  const guide = useGuide(projectId)
  if (!guideOnScreen(view, guide.data)) return null
  return (
    <GuideCard
      key={view}
      projectId={projectId}
      view={view}
      onNavigate={onNavigate}
      onOpenTray={onOpenTray}
      openRequest={openRequest}
    />
  )
}
