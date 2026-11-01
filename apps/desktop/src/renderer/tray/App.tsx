import { WindowControls } from '@agilebox/ui'
import styles from './App.module.css'

// Casca da bandeja: a tela inicial e a edição de tarefas chegam no M9.
export function App() {
  return (
    <main className={styles.window} aria-label="Bandeja do AgileBox">
      <header className={styles.header}>
        <h1>AgileBox</h1>
        <WindowControls
          expanded={false}
          onMinimize={() => window.agilebox.shell.minimize()}
          onToggleExpand={() => window.agilebox.shell.openPanel()}
          onClose={() => window.agilebox.shell.close()}
        />
      </header>
    </main>
  )
}
