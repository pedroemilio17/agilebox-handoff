import { spawn } from 'node:child_process'
import console from 'node:console'
import process from 'node:process'

// Terminais de editores baseados em Electron (como o VS Code) herdam ELECTRON_RUN_AS_NODE=1,
// o que faz o Electron rodar como Node puro e abrir nenhuma janela.
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

// No Wayland o aplicativo não pode posicionar a própria janela: a bandeja não fica ancorada no canto
// e cresce para baixo. No Linux usamos X11 (XWayland); AGILEBOX_WAYLAND=1 mantém o Wayland.
// A plataforma precisa ser escolhida na linha de comando do Electron, antes de o main executar.
const args = process.argv.slice(2)
const runsElectron = args[0] === 'dev' || args[0] === 'preview'
if (runsElectron && process.platform === 'linux' && env.AGILEBOX_WAYLAND !== '1') {
  args.push('--', '--ozone-platform=x11')
}

const child = spawn('pnpm', ['exec', 'electron-vite', ...args], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
})
child.on('error', (error) => {
  console.error(error.message)
  process.exit(1)
})
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
