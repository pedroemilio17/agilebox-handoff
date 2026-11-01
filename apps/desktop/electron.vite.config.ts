import react from '@vitejs/plugin-react'

const internalPackages = [
  '@agilebox/application',
  '@agilebox/contract',
  '@agilebox/core',
  '@agilebox/infra-sqlite',
  '@agilebox/ui',
]

export default {
  main: {
    build: {
      externalizeDeps: { exclude: internalPackages },
      rollupOptions: { input: 'src/main/index.ts' },
    },
  },
  preload: {
    build: {
      externalizeDeps: { exclude: internalPackages },
      // O preload de uma janela com sandbox (padrão do Electron) precisa ser CommonJS.
      rollupOptions: {
        input: 'src/preload/index.ts',
        output: { format: 'cjs', entryFileNames: 'index.cjs' },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          panel: 'panel/index.html',
          tray: 'tray/index.html',
        },
      },
    },
  },
}
