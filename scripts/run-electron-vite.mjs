import { spawn } from 'node:child_process'
import console from 'node:console'
import process from 'node:process'

// Terminais de editores baseados em Electron (como o VS Code) herdam ELECTRON_RUN_AS_NODE=1,
// o que faz o Electron rodar como Node puro e abrir nenhuma janela.
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn('pnpm', ['exec', 'electron-vite', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
})
child.on('error', (error) => {
  console.error(error.message)
  process.exit(1)
})
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
