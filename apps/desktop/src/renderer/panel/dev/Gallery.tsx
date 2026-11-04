import { useState } from 'react'
import type { TaskStatus } from '@agilebox/core'
import {
  Avatar,
  Kbd,
  TaskKey,
  Eyebrow,
  SignalBadge,
  ProjectSwatch,
  MetricTile,
  WipMeter,
  ChecklistProgress,
  ProgressBar,
  Sparkline,
  BarChart,
  Drawer,
  Button,
  DateField,
  EmptyState,
  FieldRow,
  GlassSurface,
  GroupedList,
  IconButton,
  Modal,
  NumberField,
  ReadOnlyBadge,
  SegmentedControl,
  Skeleton,
  StatusChip,
  StatusMenu,
  TextArea,
  TextField,
  Toast,
  Tooltip,
  WindowControls,
} from '@agilebox/ui'
import styles from './Gallery.module.css'

const statuses: readonly TaskStatus[] = ['planning', 'todo', 'in_progress', 'review', 'done']
const views = [
  { value: 'board', label: 'Quadro' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'list', label: 'Lista' },
] as const
const displayOptions = [
  { value: 'compact', label: 'Compacta' },
  { value: 'comfortable', label: 'Confortável' },
] as const

export function Gallery() {
  const [view, setView] = useState<(typeof views)[number]['value']>('board')
  const [display, setDisplay] = useState<(typeof displayOptions)[number]['value']>('compact')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  return (
    <main className={styles.gallery} aria-label="Galeria de componentes">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>AGILEBOX · DESENVOLVIMENTO</p>
          <h1>Galeria de componentes</h1>
          <p className={styles.intro}>Componentes base, variantes e estados da interface.</p>
        </div>
        <WindowControls
          expanded={expanded}
          onMinimize={() => undefined}
          onToggleExpand={() => setExpanded((current) => !current)}
          onClose={() => undefined}
        />
      </header>

      <div className={styles.sections}>
        <section className={styles.section} aria-label="Componentes v2">
          <Eyebrow>Componentes v2 · dados de demonstração</Eyebrow>
          <div className={styles.row}>
            <Kbd>Ctrl K</Kbd>
            <TaskKey value="AB-118" />
            <ProjectSwatch index={0} name="AgileBox" />
            <SignalBadge variant="aging">Parada há 5 dias</SignalBadge>
            <SignalBadge variant="overdue">Vencida há 2 dias</SignalBadge>
            <SignalBadge variant="priority">Alta</SignalBadge>
            <SignalBadge variant="blocked">Bloqueada</SignalBadge>
            <WipMeter count={2} capacity={3} />
            <ChecklistProgress done={2} total={5} />
            <span style={{ width: 160 }}>
              <ProgressBar done={2} total={5} label="Progresso das subtarefas" />
            </span>
            <MetricTile
              label="Paradas"
              value={0}
              caption="Sem ocorrências"
              onClick={() => undefined}
            />
          </div>
          <Sparkline
            label="Exemplo de fluxo"
            data={[
              { label: 'S44', value: 2 },
              { label: 'S45', value: 3 },
            ]}
          />
          <BarChart
            label="Exemplo de vazão"
            data={[
              { label: 'S44', value: 2 },
              { label: 'S45', value: 3 },
            ]}
          />
          <Button onClick={() => setDrawerOpen(true)}>Abrir painel de exemplo</Button>
          <Drawer
            open={drawerOpen}
            title="Exemplo de painel lateral"
            onClose={() => setDrawerOpen(false)}
          >
            <Button onClick={() => setDrawerOpen(false)}>Fechar painel</Button>
          </Drawer>
        </section>
        <section className={styles.section} aria-labelledby="gallery-surfaces">
          <h2 id="gallery-surfaces">Superfícies</h2>
          <div className={styles.surfaceGrid}>
            {(['window', 'group', 'control', 'popover'] as const).map((variant) => (
              <GlassSurface className={styles.surface} key={variant} variant={variant}>
                <span>{variant}</span>
              </GlassSurface>
            ))}
          </div>
          <GroupedList aria-label="Linha de exemplo">
            <FieldRow label="Responsável">
              <span>Pedro</span>
            </FieldRow>
            <FieldRow label="Acesso">
              <ReadOnlyBadge />
            </FieldRow>
          </GroupedList>
        </section>

        <section className={styles.section} aria-labelledby="gallery-controls">
          <h2 id="gallery-controls">Controles</h2>
          <SegmentedControl
            aria-label="Visualização de demonstração"
            options={views}
            value={view}
            onChange={setView}
          />
          <SegmentedControl
            aria-label="Opções de demonstração"
            options={displayOptions}
            value={display}
            onChange={setDisplay}
          />
          <div className={styles.row}>
            <Button variant="primary" shortcut="Ctrl Enter">
              Salvar alterações
            </Button>
            <Button variant="secondary">Cancelar</Button>
            <Button disabled>Indisponível</Button>
            <IconButton aria-label="Adicionar tarefa" type="button">
              +
            </IconButton>
            <Tooltip content="Dica de exemplo" visible>
              <Button>Com dica</Button>
            </Tooltip>
          </div>
          <div className={styles.row}>
            <Avatar name="Pedro Almeida" />
            <Avatar name="Equipe AgileBox" />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="gallery-fields">
          <h2 id="gallery-fields">Campos</h2>
          <div className={styles.fieldGrid}>
            <TextField label="Título" defaultValue="Revisar fluxo de tarefas" />
            <TextField label="Campo desabilitado" defaultValue="Somente leitura" disabled />
            <DateField label="Prazo" defaultValue="2026-11-05" />
            <NumberField label="Horas estimadas" defaultValue="2,50" />
            <TextArea label="Descrição" defaultValue="Descrição de exemplo para a tarefa." />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="gallery-states">
          <h2 id="gallery-states">Estados e feedback</h2>
          <div className={styles.row}>
            {statuses.map((item) => (
              <StatusChip key={item} status={item} />
            ))}
          </div>
          <div className={styles.row}>
            <Skeleton aria-label="Carregando tarefas" />
            <EmptyState
              title="Nenhuma tarefa"
              description="Crie uma tarefa para começar."
              action={<Button variant="primary">Nova tarefa</Button>}
            />
            <Toast message="Alterações salvas" duration={60_000} />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="gallery-menus">
          <h2 id="gallery-menus">Diálogos e menus</h2>
          <div className={styles.row}>
            <StatusMenu value={status} onChange={setStatus} />
            <Button variant="primary" onClick={() => setModalOpen(true)}>
              Abrir modal de exemplo
            </Button>
          </div>
          <Modal open={modalOpen} title="Exemplo de modal" onClose={() => setModalOpen(false)}>
            <div className={styles.modalContent}>
              <h3>Exemplo de modal</h3>
              <p>O foco fica preso neste diálogo até ele ser fechado.</p>
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Fechar modal
              </Button>
            </div>
          </Modal>
        </section>
      </div>
    </main>
  )
}
