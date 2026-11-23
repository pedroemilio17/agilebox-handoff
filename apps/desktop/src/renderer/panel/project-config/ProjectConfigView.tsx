import { useEffect, useState } from 'react'
import { EmptyState } from '@agilebox/ui'
import type { ProjectDto } from '@agilebox/contract'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { panelCopy } from '../copy'
import { DefinitionOfDoneEditor } from '../board/DefinitionOfDoneEditor'
import { ModulesView } from '../modules/ModulesView'
import type { PanelView } from '../layout/PanelShell'
import { TopicTabs } from '../layout/TopicTabs'
import type { TopicTabItem } from '../layout/project-nav'
import { ProjectMembersSection } from './ProjectMembersSection'
import { ProjectGeneralSection } from './ProjectGeneralSection'
import styles from './ProjectConfigView.module.css'

export type ProjectConfigTab = 'modules' | 'members' | 'definitionOfDone' | 'general'

export interface ProjectConfigViewProps {
  readonly project: ProjectDto | null
  readonly projects: readonly ProjectDto[]
  readonly canManage: boolean
  readonly onNavigate?: (view: PanelView) => void
}

/**
 * Configurações do projeto selecionado: consolida Módulos, Membros, Definição de pronto e Dados
 * gerais em abas internas, substituindo os controles antes espalhados no seletor do topo.
 */
export function ProjectConfigView({
  project,
  projects,
  canManage,
  onNavigate,
}: ProjectConfigViewProps) {
  const capabilities = useCapabilities()
  const definitionVisible = capabilities.showScreen('definitionOfDone')
  const [tab, setTab] = useState<ProjectConfigTab>('modules')
  const projectId = project?.id ?? null

  useEffect(() => {
    setTab('modules')
  }, [projectId])

  useEffect(() => {
    if (tab === 'definitionOfDone' && !definitionVisible) {
      setTab('modules')
    }
  }, [tab, definitionVisible])

  if (project === null) {
    return (
      <section aria-label="Configurações do projeto" className={styles.empty}>
        <EmptyState title="Escolha um projeto para ver as configurações." />
      </section>
    )
  }

  const tabs: readonly TopicTabItem<ProjectConfigTab>[] = [
    { id: 'modules', label: 'Módulos' },
    { id: 'members', label: panelCopy.members },
    ...(definitionVisible
      ? [{ id: 'definitionOfDone' as const, label: panelCopy.definitionTitle }]
      : []),
    { id: 'general', label: 'Geral' },
  ]
  const activeTab: ProjectConfigTab =
    tab === 'definitionOfDone' && !definitionVisible ? 'modules' : tab

  return (
    <div className={styles.view}>
      <TopicTabs
        ariaLabel="Seções de Configurações do projeto"
        items={tabs}
        activeId={activeTab}
        onSelect={setTab}
      />
      {activeTab === 'modules' ? (
        <ModulesView
          projectId={project.id}
          projectName={project.name}
          startedFromPreset={project.startedFromPreset ?? null}
          archived={project.archivedAt != null}
          {...(onNavigate ? { onNavigate } : {})}
        />
      ) : (
        <div className={styles.scrollStage}>
          {activeTab === 'members' ? (
            <ProjectMembersSection key={project.id} project={project} canManage={canManage} />
          ) : activeTab === 'definitionOfDone' ? (
            <DefinitionOfDoneEditor key={project.id} projectId={project.id} canEdit={canManage} />
          ) : (
            <ProjectGeneralSection
              key={project.id}
              project={project}
              projects={projects}
              canManage={canManage}
            />
          )}
        </div>
      )}
    </div>
  )
}
