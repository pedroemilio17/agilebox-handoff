import type { AnimationAction, AnimationMixer, MeshStandardMaterial, Object3D } from 'three'
import { KAN_GLB_B64 } from './kan-model-data'

interface MaterialTween {
  readonly t0: number
  readonly t1: number
  readonly from: readonly [number, number, number]
  readonly to: readonly [number, number, number]
}

const MAT_TWEENS: Readonly<Record<string, MaterialTween>> = {
  MAT_AgileBox_Esquerda: {
    t0: 7 / 24,
    t1: 25 / 24,
    from: [0x1d1c23, 0.58, 1.0],
    to: [0x17161c, 0.28, 0.78],
  },
  MAT_AgileBox_Direita: {
    t0: 9 / 24,
    t1: 27 / 24,
    from: [0x1d1c23, 0.58, 1.0],
    to: [0xc8f03c, 0.42, 1.0],
  },
}

export interface Kan3DOptions {
  readonly view?: 'closed' | 'open'
  readonly follow?: boolean
  readonly fps?: number
  readonly closedImgSrc: string
  readonly openImgSrc: string
  readonly onReady?: (controller: Kan3DController) => void
  readonly onFallback?: (reason: string) => void
}

export interface Kan3DController {
  readonly ready: boolean
  readonly fallback: boolean
  play: (name: 'Open' | 'Spin_360' | 'Idle_Float', params?: { readonly reverse?: boolean }) => void
  setOpen: (open: boolean) => void
  dispose: () => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

function smooth(value: number): number {
  return value * value * (3 - 2 * value)
}

function prefersReducedMotion(): boolean {
  try {
    return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  } catch {
    return false
  }
}

function glbBufferFromBase64(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i)
  }
  return out.buffer
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(
      typeof window !== 'undefined' &&
      'WebGLRenderingContext' in window &&
      (canvas.getContext('webgl2') ?? canvas.getContext('webgl')),
    )
  } catch {
    return false
  }
}

/**
 * Monta o mascote 3D do Kan dentro de `container`, usando Three.js local empacotado.
 * Quando WebGL não está disponível (ex.: ambiente headless/testes ou GPU sem suporte),
 * mantém suavemente o fallback em imagem PNG com acompanhamento de ponteiro via CSS.
 */
export function mountKan3D(container: HTMLElement, options: Kan3DOptions): Kan3DController {
  const view = options.view ?? 'closed'
  const follow = options.follow ?? true
  const fps = options.fps ?? 30

  let ready = false
  let fallback = false
  let openness = view === 'open' ? 1 : 0
  let isOpenPose = view === 'open'
  let alive = true
  let initialOpen: boolean | undefined = view === 'open' ? true : undefined
  let initialClip: { name: 'Open' | 'Spin_360' | 'Idle_Float'; reverse?: boolean } | null = null

  let play3D: ((name: string, params?: { readonly reverse?: boolean }) => void) | null = null
  let setOpen3D: ((open: boolean) => void) | null = null
  let dispose3D: (() => void) | null = null

  const fallbackImg = container.querySelector<HTMLImageElement>('[data-kan-fallback]')
  const lookTarget = { x: 0, y: 0 }
  const lookCurrent = { x: 0, y: 0 }

  function updateFallbackVisual(open: boolean) {
    isOpenPose = open
    if (fallbackImg) {
      fallbackImg.src = open ? options.openImgSrc : options.closedImgSrc
    }
    container.dataset.kanOpen = open ? 'true' : 'false'
  }

  function computeLookFromEvent(ev: PointerEvent) {
    if (!follow) return
    const rect = container.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const cx = rect.left + rect.width * 0.5
    const cy = rect.top + rect.height * 0.5
    const scaleX = Math.max(240, window.innerWidth * 0.48)
    const scaleY = Math.max(200, window.innerHeight * 0.48)
    lookTarget.x = clamp((ev.clientX - cx) / scaleX, -1, 1)
    lookTarget.y = clamp(-(ev.clientY - cy) / scaleY, -1, 1)
  }

  function resetLook() {
    lookTarget.x = 0
    lookTarget.y = 0
  }

  window.addEventListener('pointermove', computeLookFromEvent, { passive: true })
  document.addEventListener('pointerleave', resetLook)

  let fallbackRaf = 0
  function tickFallback() {
    if (!alive || ready) return
    fallbackRaf = window.requestAnimationFrame(tickFallback)
    lookCurrent.x += (lookTarget.x - lookCurrent.x) * 0.14
    lookCurrent.y += (lookTarget.y - lookCurrent.y) * 0.14
    if (fallbackImg && !prefersReducedMotion()) {
      const rx = (-lookCurrent.y * 7).toFixed(2)
      const ry = (lookCurrent.x * 9).toFixed(2)
      const tx = (lookCurrent.x * 2.5).toFixed(2)
      const ty = (-lookCurrent.y * 2).toFixed(2)
      fallbackImg.style.transform = `perspective(260px) translate3d(${tx}px,${ty}px,0) rotateX(${rx}deg) rotateY(${ry}deg)`
    }
  }
  fallbackRaf = window.requestAnimationFrame(tickFallback)

  const controller: Kan3DController = {
    get ready() {
      return ready
    },
    get fallback() {
      return fallback
    },
    play(name, params) {
      if (name === 'Open') {
        updateFallbackVisual(!params?.reverse)
      }
      if (!ready) {
        initialClip = params?.reverse !== undefined ? { name, reverse: params.reverse } : { name }
        if (name === 'Spin_360' && fallbackImg && !prefersReducedMotion()) {
          container.dataset.kanSpinning = 'false'
          void container.offsetWidth
          container.dataset.kanSpinning = 'true'
          window.setTimeout(() => {
            if (alive) container.dataset.kanSpinning = 'false'
          }, 640)
        }
        return
      }
      play3D?.(name, params)
    },
    setOpen(open) {
      updateFallbackVisual(open)
      if (setOpen3D) {
        setOpen3D(open)
      } else {
        initialOpen = open
      }
    },
    dispose() {
      alive = false
      window.cancelAnimationFrame(fallbackRaf)
      window.removeEventListener('pointermove', computeLookFromEvent)
      document.removeEventListener('pointerleave', resetLook)
      dispose3D?.()
    },
  }

  function activateFallback(reason: string) {
    fallback = true
    container.dataset.kan3dState = 'fallback'
    container.dataset.kan3dReason = reason
    options.onFallback?.(reason)
  }

  updateFallbackVisual(view === 'open')

  if (!KAN_GLB_B64 || !hasWebGL()) {
    activateFallback(!KAN_GLB_B64 ? 'missing-glb' : 'no-webgl')
    return controller
  }

  void Promise.all([
    import('three'),
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/environments/RoomEnvironment.js'),
  ])
    .then(([THREE, { GLTFLoader }, { RoomEnvironment }]) => {
      if (!alive) return

      const width = () => container.clientWidth || 112
      const height = () => container.clientHeight || 112

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setClearColor(0x000000, 0)
      renderer.setSize(width(), height())
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.15
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.domElement.style.cssText =
        'display:block;width:100%;height:100%;background:transparent;outline:none;pointer-events:none;'
      container.appendChild(renderer.domElement)

      const scene = new THREE.Scene()
      const pmrem = new THREE.PMREMGenerator(renderer)
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.35)
      keyLight.position.set(-4, 5, 6)
      scene.add(keyLight)

      const rimLight = new THREE.DirectionalLight(0xd6cfff, 0.85)
      rimLight.position.set(5, 3, -5)
      scene.add(rimLight)

      const camera = new THREE.PerspectiveCamera(
        view === 'closed' ? 28 : 30,
        width() / height(),
        0.1,
        100,
      )
      const target = new THREE.Vector3(0, -0.02, 0)
      const dist = view === 'closed' ? 9.0 : 10.4
      camera.position.set(dist * 0.16, dist * 0.12 + target.y, dist * 0.98)
      camera.lookAt(target)

      let mixer: AnimationMixer | null = null
      const actions: Record<string, AnimationAction> = {}
      let eyes: Object3D | null = null
      let rootModel: Object3D | null = null
      const mats: Record<string, MeshStandardMaterial> = {}
      let raf = 0
      let last = 0
      let visible = true
      const lookVec = new THREE.Vector2(0, 0)
      const lookTargetVec = new THREE.Vector2(0, 0)

      new GLTFLoader().parse(
        glbBufferFromBase64(KAN_GLB_B64),
        '',
        (gltf) => {
          if (!alive) {
            renderer.dispose()
            pmrem.dispose()
            return
          }
          rootModel = gltf.scene
          scene.add(rootModel)
          rootModel.traverse((node) => {
            if (node.name === 'Olhos_LED') eyes = node
            if ('isMesh' in node && node.isMesh && 'material' in node) {
              const material = node.material as MeshStandardMaterial | undefined
              if (!material) return
              if (MAT_TWEENS[material.name]) {
                material.transparent = material.name === 'MAT_AgileBox_Esquerda'
                mats[material.name] = material
              }
              if (material.name === 'MAT_AgileBox_LED') {
                material.emissive = new THREE.Color(0xf2f0f6)
                material.emissiveIntensity = 2.5
              }
            }
          })

          mixer = new THREE.AnimationMixer(rootModel)
          for (const clip of gltf.animations) {
            actions[clip.name] = mixer.clipAction(clip)
          }

          for (const name of ['Spin_360', 'Open']) {
            const action = actions[name]
            if (action) {
              action.setLoop(THREE.LoopOnce, 1)
              action.clampWhenFinished = true
            }
          }

          if (actions.Idle_Float && !prefersReducedMotion()) {
            actions.Idle_Float.play()
          }

          mixer.addEventListener('finished', (ev) => {
            if (ev.action.getClip().name === 'Spin_360') ev.action.stop()
          })

          play3D = (name, params) => {
            if (name === 'Idle_Float') return
            const action = actions[name]
            if (!action) return
            action.enabled = true
            action.paused = false
            if (params?.reverse) {
              action.timeScale = -1
              if (!action.isRunning() && action.time === 0) {
                action.time = action.getClip().duration
              }
              action.play()
            } else {
              action.reset()
              action.timeScale = 1
              action.play()
            }
          }

          setOpen3D = (open) => {
            const action = actions.Open
            if (!action) return
            action.enabled = true
            action.reset()
            action.play()
            action.paused = true
            action.time = open ? action.getClip().duration : 0
          }

          ready = true
          window.cancelAnimationFrame(fallbackRaf)
          if (fallbackImg) fallbackImg.style.display = 'none'
          container.dataset.kan3dState = 'webgl'

          if (typeof initialOpen === 'boolean') {
            setOpen3D(initialOpen)
          } else if (initialClip) {
            play3D(
              initialClip.name,
              initialClip.reverse !== undefined ? { reverse: initialClip.reverse } : undefined,
            )
          }

          options.onReady?.(controller)
        },
        () => {
          if (!alive) return
          renderer.domElement.remove()
          renderer.dispose()
          pmrem.dispose()
          activateFallback('gltf-parse-error')
        },
      )

      function applyMaterials() {
        const openAction = actions.Open
        const t = openAction && openAction.enabled ? openAction.time : 0
        openness =
          openAction && openAction.getClip().duration
            ? clamp01(t / openAction.getClip().duration)
            : isOpenPose
              ? 1
              : 0

        for (const [key, material] of Object.entries(mats)) {
          const tween = MAT_TWEENS[key]
          if (!tween) continue
          const progress = smooth(clamp01((t - tween.t0) / (tween.t1 - tween.t0)))
          material.color.setHex(tween.from[0]).lerp(new THREE.Color(tween.to[0]), progress)
          material.roughness = tween.from[1] + (tween.to[1] - tween.from[1]) * progress
          material.opacity = tween.from[2] + (tween.to[2] - tween.from[2]) * progress
        }
      }

      function applyEyes(dt: number) {
        if (!eyes) return
        lookTargetVec.set(lookTarget.x, lookTarget.y)
        lookVec.lerp(lookTargetVec, 1 - Math.exp(-dt * 9))
        const rx = 0.05 + (0.33 - 0.05) * openness
        const zUp = 0.25 + (0.035 - 0.25) * openness
        const zDn = 0.3 + (0.035 - 0.3) * openness
        eyes.position.x = lookVec.x * rx
        eyes.position.y = lookVec.y > 0 ? lookVec.y * zUp : lookVec.y * zDn
        if (rootModel && !prefersReducedMotion()) {
          const targetRotY = lookVec.x * 0.22
          const targetRotX = -lookVec.y * 0.14
          rootModel.rotation.y += (targetRotY - rootModel.rotation.y) * Math.min(1, dt * 6)
          rootModel.rotation.x += (targetRotX - rootModel.rotation.x) * Math.min(1, dt * 6)
        }
      }

      const io =
        'IntersectionObserver' in window
          ? new IntersectionObserver((entries) => {
              const first = entries[0]
              if (first) visible = first.isIntersecting
            })
          : null
      io?.observe(container)

      const ro =
        'ResizeObserver' in window
          ? new ResizeObserver(() => {
              renderer.setSize(width(), height())
              camera.aspect = width() / height()
              camera.updateProjectionMatrix()
            })
          : null
      ro?.observe(container)

      const clock = new THREE.Clock()
      function tick(now: number) {
        if (!alive) return
        raf = window.requestAnimationFrame(tick)
        if (!visible || document.hidden) {
          clock.getDelta()
          return
        }
        if (now - last < 1000 / fps - 1) return
        last = now
        const dt = Math.min(clock.getDelta(), 0.1)
        mixer?.update(dt)
        applyMaterials()
        applyEyes(dt)
        renderer.render(scene, camera)
      }
      raf = window.requestAnimationFrame(tick)

      dispose3D = () => {
        window.cancelAnimationFrame(raf)
        io?.disconnect()
        ro?.disconnect()
        renderer.dispose()
        pmrem.dispose()
        renderer.domElement.remove()
      }
    })
    .catch(() => {
      if (!alive) return
      activateFallback('three-load-error')
    })

  return controller
}
