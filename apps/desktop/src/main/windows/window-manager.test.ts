import { beforeEach, describe, expect, it, vi } from 'vitest'

const WORK_AREA = { x: 0, y: 0, width: 1920, height: 1040 }

function makeTrayStub() {
  let bounds = { x: 1580, y: 952, width: 340, height: 88 }
  return {
    on: vi.fn(),
    isDestroyed: () => false,
    isVisible: () => false,
    getBounds: () => bounds,
    setBounds: vi.fn((next: typeof bounds) => {
      bounds = next
    }),
    show: vi.fn(),
    focus: vi.fn(),
    hide: vi.fn(),
    destroy: vi.fn(),
  }
}

let trayStub = makeTrayStub()

vi.mock('electron', () => ({
  BrowserWindow: class {},
  screen: {
    getPrimaryDisplay: () => ({ workArea: WORK_AREA }),
    getDisplayNearestPoint: () => ({ workArea: WORK_AREA }),
  },
}))

vi.mock('./panel-window', () => ({
  createPanelWindow: vi.fn(),
}))

vi.mock('./tray-window', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tray-window')>()
  return {
    ...actual,
    createTrayWindow: vi.fn((_glass, pos: { x: number; y: number }) => {
      trayStub.setBounds({
        x: pos.x,
        y: pos.y,
        width: actual.TRAY_COMPACT_SIZE.width,
        height: actual.TRAY_COMPACT_SIZE.height,
      })
      return trayStub
    }),
  }
})

const { WindowManager } = await import('./window-manager')

describe('WindowManager · tamanho e ancoragem da bandeja', () => {
  beforeEach(() => {
    trayStub = makeTrayStub()
  })

  it('nasce compacta (340×88) e mantém o canto inferior direito ao expandir para 430×630', () => {
    const manager = new WindowManager('opaque')
    manager.createTray()

    expect(trayStub.getBounds()).toEqual({ x: 1580, y: 952, width: 340, height: 88 })

    manager.setTrayHeight(630, 430)

    const expanded = trayStub.getBounds()
    expect(expanded).toEqual({ x: 1490, y: 410, width: 430, height: 630 })
    expect(expanded.x + expanded.width).toBe(1920)
    expect(expanded.y + expanded.height).toBe(1040)
  })
})
