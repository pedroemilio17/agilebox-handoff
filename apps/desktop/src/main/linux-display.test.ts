import { describe, expect, it } from 'vitest'
import { needsX11Relaunch, x11RelaunchOptions } from './linux-display'

describe('needsX11Relaunch', () => {
  it('reinicia em X11 só no Linux e uma única vez', () => {
    expect(needsX11Relaunch({ platform: 'linux', env: {}, ozonePlatform: '' })).toBe(true)
    expect(needsX11Relaunch({ platform: 'linux', env: {}, ozonePlatform: 'x11' })).toBe(false)
    expect(needsX11Relaunch({ platform: 'win32', env: {}, ozonePlatform: '' })).toBe(false)
    expect(needsX11Relaunch({ platform: 'darwin', env: {}, ozonePlatform: '' })).toBe(false)
  })

  it('reinicia também quando o Electron escolheu o Wayland sozinho', () => {
    expect(needsX11Relaunch({ platform: 'linux', env: {}, ozonePlatform: 'wayland' })).toBe(true)
  })

  it('AGILEBOX_WAYLAND=1 mantém o Wayland', () => {
    expect(
      needsX11Relaunch({
        platform: 'linux',
        env: { AGILEBOX_WAYLAND: '1' },
        ozonePlatform: '',
      }),
    ).toBe(false)
  })
})

describe('x11RelaunchOptions', () => {
  it('no AppImage reinicia pelo próprio arquivo .AppImage', () => {
    expect(
      x11RelaunchOptions({
        argv: ['/tmp/.mount_AgileBXYZ/agilebox', '--algo'],
        appImage: '/home/p/Downloads/AgileBox-0.2.1.AppImage',
      }),
    ).toEqual({
      execPath: '/home/p/Downloads/AgileBox-0.2.1.AppImage',
      args: ['--algo', '--ozone-platform=x11'],
    })
  })

  it('fora do AppImage reinicia o mesmo executável', () => {
    expect(x11RelaunchOptions({ argv: ['/opt/agilebox', '.'], appImage: undefined })).toEqual({
      args: ['.', '--ozone-platform=x11'],
    })
  })
})
