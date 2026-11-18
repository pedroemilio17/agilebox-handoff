import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Avatar, ProjectSwatch, Skeleton } from '@agilebox/ui'
import { useApi } from '../../shared/api/ApiProvider'
import { useCapabilities } from '../../shared/capabilities/capabilities-context'
import { queryKeys } from '../../shared/query/keys'
import { swatchIndexOf } from '../../shared/lib/project-swatch'
import { panelCopy } from '../copy'
import { METHOD_NAMES } from './dashboard-format'
import type { DashboardInsights } from './dashboard-format'
import { buildFeed, FEED_FILTER_LABELS, FEED_FILTER_ORDER, runFeedAction } from './updates-feed'
import type { FeedActionHandlers, FeedEntry, FeedFilter, FeedTone, FeedView } from './updates-feed'
import styles from './Updates.module.css'

const VIEWS: readonly { id: FeedView; label: string }[] = [
  { id: 'exige', label: 'Exige ação' },
  { id: 'hoje', label: 'Tudo de hoje' },
  { id: 'marcos', label: 'Marcos e prazos' },
]

const VIEW_LABEL: Readonly<Record<FeedView, string>> = {
  exige: 'Exige ação',
  hoje: 'Tudo de hoje',
  marcos: 'Marcos e prazos',
}

/**
 * Tipos desmarcados ao abrir (desenho, tela 20): "Mudança de estado" e "Comentários" começam de fora.
 * "Outras edições" não existe no desenho; começa de fora junto, como o resto do dia a dia.
 */
const DEFAULT_HIDDEN_TYPES: ReadonlySet<FeedFilter> = new Set<FeedFilter>([
  'status',
  'comment',
  'other',
])

const TONE_CLASS: Record<FeedTone, string | undefined> = {
  danger: styles.toneDanger,
  warning: styles.toneWarning,
  neutral: styles.toneNeutral,
}

/** Texto de apoio da visão Exige ação (copiado do desenho; o termo em negrito vem antes). */
const EXIGE_NOTE =
  ' junta o que só você resolve: aceite pendente, marco em risco, item fora da entrega, proposta aguardando, commit sem tarefa, WIP acima do limite, tarefa parada há 3 dias e diária sem resposta. Movimentos comuns ficam em “Tudo de hoje”.'

function timeOf(at: string | null): string {
  return at ? format(parseISO(at), 'HH:mm') : '—'
}

interface FeedRowProps extends FeedActionHandlers {
  readonly item: { readonly head: FeedEntry; readonly rest: readonly FeedEntry[] }
  readonly projectSwatch: (projectId: string) => number
}

/** Uma linha do feed: tipo e hora, texto, projeto, quem fez e o botão. Tarefa agrupada mostra as outras. */
function FeedRow({ item, projectSwatch, ...handlers }: FeedRowProps) {
  const { head, rest } = item
  return (
    <article className={styles.item}>
      <div className={styles.itemType}>
        <span className={`${styles.typeLine} ${TONE_CLASS[head.tone]}`}>
          <span className={styles.dot} />
          {head.typeLabel}
        </span>
        <span className={styles.time}>{timeOf(head.at)}</span>
      </div>
      <div className={styles.body}>
        <span className={styles.headline}>{head.headline}</span>
        {head.detail ? <span className={styles.detail}>{head.detail}</span> : null}
        <span className={styles.meta}>
          <span className={styles.via}>
            <ProjectSwatch index={projectSwatch(head.projectId)} name={head.projectName} />
            {head.projectName}
          </span>
          {head.projectMethod ? (
            <span className={styles.tag}>{METHOD_NAMES[head.projectMethod]}</span>
          ) : null}
          {head.actorName ? (
            <span className={styles.via}>
              <Avatar name={head.actorName} className={styles.miniAvatar} />
              {head.actorName}
              {head.asManager ? <span className={styles.tag}>Gestor</span> : null}
            </span>
          ) : null}
        </span>
        {rest.length > 0 ? (
          <div className={styles.sub}>
            {rest.map((entry) => (
              <span className={styles.subLine} key={entry.key}>
                <span className={styles.subTime}>{timeOf(entry.at)}</span> · {entry.detail}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className={styles.button}
        onClick={() => runFeedAction(head.action, handlers)}
      >
        {head.actionLabel}
      </button>
    </article>
  )
}

/**
 * Atualizações (design, tela 20): o dashboard com o filtro de atualizações aplicado. Visões, tipos,
 * projetos e pessoas filtram a linha do tempo dos últimos sete dias e os sinais "Precisa de você".
 */
export function UpdatesView(props: FeedActionHandlers) {
  const api = useApi()
  const dashboard = useQuery({
    queryKey: queryKeys.dashboard.all,
    queryFn: () => api.dashboard.get(),
  })
  const capabilities = useCapabilities()
  const wipVisible = capabilities.can('wip:passive')
  const [view, setView] = useState<FeedView>('exige')
  const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<FeedFilter>>(DEFAULT_HIDDEN_TYPES)
  const [hiddenProjects, setHiddenProjects] = useState<ReadonlySet<string>>(new Set())
  const [hiddenPeople, setHiddenPeople] = useState<ReadonlySet<string>>(new Set())
  const [groupByTask, setGroupByTask] = useState(true)
  const [showOwn, setShowOwn] = useState(false)
  if (dashboard.isPending)
    return (
      <div className={styles.view} role="status" aria-label={panelCopy.dashboardLoading}>
        <Skeleton />
      </div>
    )
  if (dashboard.isError || !dashboard.data.insights)
    return <p role="alert">{panelCopy.dashboardError}</p>
  const data: DashboardInsights = dashboard.data.insights
  // Sinal de WIP só aparece com a ferramenta de WIP ligada no nível (o painel faz o mesmo).
  const feedInsights: DashboardInsights = wipVisible
    ? data
    : { ...data, needs: data.needs.filter((need) => need.kind !== 'wip') }
  const projectIds = data.projects.map((project) => project.id)
  const model = buildFeed(
    feedInsights,
    {
      view,
      types: new Set(FEED_FILTER_ORDER.filter((type) => !hiddenTypes.has(type))),
      projects: new Set(projectIds.filter((id) => !hiddenProjects.has(id))),
      people: new Set(data.team.map((m) => m.user.id).filter((id) => !hiddenPeople.has(id))),
      groupByTask,
      showOwn,
    },
    data.updatedAt,
  )
  const toggle = <T,>(set: ReadonlySet<T>, value: T): ReadonlySet<T> => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  }
  const projectSwatch = swatchIndexOf
  const typeTone: Record<FeedFilter, FeedTone> = {
    acceptance: 'warning',
    deadline: 'warning',
    estimate: 'warning',
    wip: 'danger',
    status: 'neutral',
    comment: 'neutral',
    other: 'neutral',
  }
  return (
    <div className={styles.view}>
      <aside aria-label="Filtros" className={styles.aside}>
        <div className={styles.fieldset}>
          <span className={styles.eyebrow}>Visões</span>
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.viewButton}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => setView(item.id)}
            >
              <span className={styles.grow}>{item.label}</span>
              <span className={styles.subtle}>{model.viewCounts[item.id]}</span>
            </button>
          ))}
        </div>

        <fieldset className={styles.fieldset}>
          <legend className={styles.eyebrow}>Tipo de atualização</legend>
          {FEED_FILTER_ORDER.map((type) => (
            <label className={styles.check} key={type}>
              <input
                type="checkbox"
                checked={!hiddenTypes.has(type)}
                onChange={() => setHiddenTypes((set) => toggle(set, type))}
              />
              <span className={`${styles.dot} ${TONE_CLASS[typeTone[type]]}`} />
              <span className={styles.grow}>{FEED_FILTER_LABELS[type]}</span>
              <span className={styles.subtle}>{model.typeCounts[type]}</span>
            </label>
          ))}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.eyebrow}>Projeto</legend>
          {data.projects.map((project) => (
            <label className={styles.check} key={project.id}>
              <input
                type="checkbox"
                checked={!hiddenProjects.has(project.id)}
                onChange={() => setHiddenProjects((set) => toggle(set, project.id))}
              />
              <ProjectSwatch index={projectSwatch(project.id)} name={project.name} />
              <span className={styles.grow}>{project.name}</span>
              {project.method ? (
                <span className={styles.subtle}>{METHOD_NAMES[project.method]}</span>
              ) : null}
            </label>
          ))}
        </fieldset>

        <div className={styles.fieldset}>
          <span className={styles.eyebrow}>Pessoa</span>
          <div className={styles.people}>
            {data.team.map((member) => {
              const pressed = !hiddenPeople.has(member.user.id)
              return (
                <button
                  key={member.user.id}
                  type="button"
                  aria-pressed={pressed}
                  aria-label={member.user.name}
                  className={`${styles.person} ${pressed ? styles.personOn : ''}`}
                  onClick={() => setHiddenPeople((set) => toggle(set, member.user.id))}
                >
                  {member.user.initials}
                </button>
              )
            })}
          </div>
        </div>

        <div className={styles.fieldset}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={groupByTask}
              onChange={() => setGroupByTask((value) => !value)}
            />
            <span className={styles.grow}>Agrupar por tarefa</span>
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={showOwn}
              onChange={() => setShowOwn((value) => !value)}
            />
            <span className={styles.grow}>Mostrar minhas edições</span>
          </label>
        </div>
        <span className={styles.grow} />
        {/* Visões salvas ainda não existem no backend: botão do desenho, desabilitado. */}
        <button type="button" className={styles.asideButton} disabled>
          Salvar como visão
        </button>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>Atualizações</h1>
          <span className={styles.subtle}>
            {model.visible} de {model.total} nesta semana · visão {VIEW_LABEL[view]}
          </span>
          <span className={styles.grow} />
          {/* Sem dado de "vista" por pessoa no backend: o botão fica no desenho, desabilitado. */}
          <button type="button" className={styles.button} disabled>
            Marcar como vistas
          </button>
        </header>

        {view === 'exige' ? (
          <div className={styles.banner}>
            <span>
              <strong>Exige ação</strong>
              {EXIGE_NOTE}
            </span>
          </div>
        ) : null}

        {model.open.length > 0 ? (
          <section aria-label="Em aberto" className={styles.day}>
            <h2 className={styles.dayTitle}>Em aberto</h2>
            {model.open.map((item) => (
              <FeedRow key={item.head.key} item={item} projectSwatch={projectSwatch} {...props} />
            ))}
          </section>
        ) : null}

        {model.days.map((group) => (
          <section aria-label={group.label} className={styles.day} key={group.key}>
            <h2 className={styles.dayTitle}>{group.label}</h2>
            {group.items.map((item) => (
              <FeedRow key={item.key} item={item} projectSwatch={projectSwatch} {...props} />
            ))}
          </section>
        ))}
      </main>
    </div>
  )
}
