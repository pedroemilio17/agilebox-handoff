/*
 * Kan 3D Engine (Protótipo UX)
 * Baseado em design/kan/src/kan3d.reference.js usando o GLB embutido (window.KAN_GLB_B64).
 * Suporta Three.js via import() dinâmico com fallback suave em imagem + CSS quando offline/sem WebGL.
 */
(function () {
  'use strict';

  var MAT_TWEENS = {
    MAT_AgileBox_Esquerda: { t0: 7 / 24, t1: 25 / 24, from: [0x1d1c23, 0.58, 1.0], to: [0x17161c, 0.28, 0.78] },
    MAT_AgileBox_Direita: { t0: 9 / 24, t1: 27 / 24, from: [0x1d1c23, 0.58, 1.0], to: [0xc8f03c, 0.42, 1.0] }
  };

  function clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
  }

  function clamp01(x) {
    return clamp(x, 0, 1);
  }

  function smooth(x) {
    return x * x * (3 - 2 * x);
  }

  function prefersReducedMotion() {
    try {
      return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) {
      return false;
    }
  }

  function glbBufferFromBase64(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out.buffer;
  }

  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) {
      return false;
    }
  }

  function mount(container, opts) {
    var o = Object.assign({ view: 'closed', follow: true, fps: 30, onReady: null, onFallback: null }, opts || {});
    var api = {
      ready: false,
      fallback: false,
      current: 'Idle_Float',
      openness: 0,
      _isOpen: false,
      _fin: []
    };

    var fallbackImg = container.querySelector('.ab-kan-fab-fallback');
    var lookTarget = { x: 0, y: 0 };
    var lookCurrent = { x: 0, y: 0 };
    var alive = true;

    function updateFallbackVisual(isOpen) {
      api._isOpen = Boolean(isOpen);
      if (fallbackImg) {
        fallbackImg.src = isOpen ? 'assets/img/kan_aberto.png' : 'assets/img/kan_fechado.png';
      }
      container.classList.toggle('is-open-pose', Boolean(isOpen));
    }

    function computeLookFromEvent(ev) {
      if (!o.follow) return;
      var rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var cx = rect.left + rect.width * 0.5;
      var cy = rect.top + rect.height * 0.5;
      var scaleX = Math.max(240, window.innerWidth * 0.48);
      var scaleY = Math.max(200, window.innerHeight * 0.48);
      lookTarget.x = clamp((ev.clientX - cx) / scaleX, -1, 1);
      lookTarget.y = clamp(-(ev.clientY - cy) / scaleY, -1, 1);
    }

    function resetLook() {
      lookTarget.x = 0;
      lookTarget.y = 0;
    }

    window.addEventListener('pointermove', computeLookFromEvent, { passive: true });
    document.addEventListener('pointerleave', resetLook);

    // Fallback tracking suavizado (usado enquanto WebGL carrega ou se estiver em fallback)
    var fallbackRaf = 0;
    function tickFallback() {
      if (!alive || api.ready) return;
      fallbackRaf = requestAnimationFrame(tickFallback);
      lookCurrent.x += (lookTarget.x - lookCurrent.x) * 0.14;
      lookCurrent.y += (lookTarget.y - lookCurrent.y) * 0.14;
      if (fallbackImg && !prefersReducedMotion()) {
        var rx = (-lookCurrent.y * 7).toFixed(2);
        var ry = (lookCurrent.x * 9).toFixed(2);
        var tx = (lookCurrent.x * 2.5).toFixed(2);
        var ty = (-lookCurrent.y * 2).toFixed(2);
        fallbackImg.style.transform =
          'perspective(260px) translate3d(' + tx + 'px,' + ty + 'px,0) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
      }
    }
    fallbackRaf = requestAnimationFrame(tickFallback);

    api.play = function (name, params) {
      var p = params || {};
      if (name === 'Open') {
        updateFallbackVisual(!p.reverse);
      }
      if (!api.ready) {
        o.initialClip = { name: name, params: p };
        if (name === 'Spin_360' && fallbackImg && !prefersReducedMotion()) {
          container.classList.remove('is-spinning');
          void container.offsetWidth;
          container.classList.add('is-spinning');
        }
        return;
      }
      if (api._play3D) api._play3D(name, p);
    };

    api.setOpen = function (v) {
      updateFallbackVisual(v);
      if (api._setOpen3D) api._setOpen3D(v);
      else o.initialOpen = Boolean(v);
    };

    api.onFinished = function (cb) {
      if (typeof cb === 'function') api._fin.push(cb);
    };

    api.dispose = function () {
      alive = false;
      cancelAnimationFrame(fallbackRaf);
      window.removeEventListener('pointermove', computeLookFromEvent);
      document.removeEventListener('pointerleave', resetLook);
      if (api._dispose3D) api._dispose3D();
    };

    function activateFallback(reason) {
      api.fallback = true;
      container.setAttribute('data-kan3d-state', 'fallback');
      container.setAttribute('data-kan3d-reason', reason || 'unavailable');
      if (o.onFallback) o.onFallback(reason);
    }

    if (!window.KAN_GLB_B64 || !hasWebGL()) {
      activateFallback(!window.KAN_GLB_B64 ? 'missing-glb' : 'no-webgl');
      return api;
    }

    // Carrega Three.js sob demanda (ESM CDN). Em caso de rede indisponível, permanece silenciosamente no fallback.
    var THREE_URL = 'https://esm.sh/three@0.170.0';
    var GLTF_URL = 'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js';
    var ENV_URL = 'https://esm.sh/three@0.170.0/examples/jsm/environments/RoomEnvironment.js';

    Promise.all([import(THREE_URL), import(GLTF_URL), import(ENV_URL)])
      .then(function (mods) {
        if (!alive) return;
        var THREE = mods[0];
        var GLTFLoader = mods[1].GLTFLoader;
        var RoomEnvironment = mods[2].RoomEnvironment;

        var w = function () { return container.clientWidth || 112; };
        var h = function () { return container.clientHeight || 112; };

        var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(w(), h());
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.15;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.className = 'ab-kan-canvas';
        renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;background:transparent;outline:none;pointer-events:none;';
        container.appendChild(renderer.domElement);

        var scene = new THREE.Scene();
        var pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

        var keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
        keyLight.position.set(-4, 5, 6);
        scene.add(keyLight);

        var rimLight = new THREE.DirectionalLight(0xd6cfff, 0.85);
        rimLight.position.set(5, 3, -5);
        scene.add(rimLight);

        var camera = new THREE.PerspectiveCamera(o.view === 'closed' ? 28 : 30, w() / h(), 0.1, 100);
        var target = new THREE.Vector3(0, -0.02, 0);
        var dist = o.view === 'closed' ? 9.0 : 10.4;
        camera.position.set(dist * 0.16, dist * 0.12 + target.y, dist * 0.98);
        camera.lookAt(target);

        var mixer = null;
        var actions = {};
        var eyes = null;
        var rootModel = null;
        var mats = {};
        var raf = 0;
        var last = 0;
        var visible = true;
        var lookVec = new THREE.Vector2(0, 0);
        var lookTargetVec = new THREE.Vector2(0, 0);

        new GLTFLoader().parse(
          glbBufferFromBase64(window.KAN_GLB_B64),
          '',
          function (gltf) {
            if (!alive) {
              renderer.dispose();
              pmrem.dispose();
              return;
            }
            rootModel = gltf.scene;
            scene.add(rootModel);
            rootModel.traverse(function (n) {
              if (n.name === 'Olhos_LED') eyes = n;
              if (n.isMesh && n.material) {
                var m = n.material;
                if (MAT_TWEENS[m.name]) {
                  m.transparent = m.name === 'MAT_AgileBox_Esquerda';
                  mats[m.name] = m;
                }
                if (m.name === 'MAT_AgileBox_LED') {
                  m.emissive = new THREE.Color(0xf2f0f6);
                  m.emissiveIntensity = 2.5;
                }
              }
            });

            mixer = new THREE.AnimationMixer(rootModel);
            (gltf.animations || []).forEach(function (clip) {
              actions[clip.name] = mixer.clipAction(clip);
            });

            ['Spin_360', 'Open'].forEach(function (name) {
              var a = actions[name];
              if (a) {
                a.setLoop(THREE.LoopOnce, 1);
                a.clampWhenFinished = true;
              }
            });

            if (actions.Idle_Float && !prefersReducedMotion()) {
              actions.Idle_Float.play();
            }

            mixer.addEventListener('finished', function (ev) {
              var clipName = ev.action.getClip().name;
              if (clipName === 'Spin_360') ev.action.stop();
              api._fin.forEach(function (cb) {
                cb(clipName, ev.action.timeScale < 0);
              });
            });

            api._play3D = function (name, p) {
              if (name === 'Idle_Float') {
                api.current = name;
                return;
              }
              var a = actions[name];
              if (!a) return;
              api.current = p && p.reverse ? name + ' (reverso)' : name;
              a.enabled = true;
              a.paused = false;
              if (p && p.reverse) {
                a.timeScale = -1;
                if (!a.isRunning() && a.time === 0) a.time = a.getClip().duration;
                a.play();
              } else {
                a.reset();
                a.timeScale = 1;
                a.play();
              }
            };

            api._setOpen3D = function (v) {
              var a = actions.Open;
              if (!a) return;
              a.enabled = true;
              a.reset();
              a.play();
              a.paused = true;
              a.time = v ? a.getClip().duration : 0;
            };

            api.ready = true;
            cancelAnimationFrame(fallbackRaf);
            if (fallbackImg) fallbackImg.style.display = 'none';
            container.setAttribute('data-kan3d-state', 'webgl');

            if (typeof o.initialOpen === 'boolean') {
              api._setOpen3D(o.initialOpen);
            } else if (o.initialClip) {
              api._play3D(o.initialClip.name, o.initialClip.params);
            }

            if (o.onReady) o.onReady(api);
          },
          function () {
            if (!alive) return;
            if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
            renderer.dispose();
            pmrem.dispose();
            activateFallback('gltf-parse-error');
          }
        );

        function applyMaterials() {
          var a = actions.Open;
          var t = a && a.enabled ? a.time : 0;
          api.openness = a && a.getClip().duration ? clamp01(t / a.getClip().duration) : (api._isOpen ? 1 : 0);
          for (var k in mats) {
            if (!Object.prototype.hasOwnProperty.call(mats, k)) continue;
            var tw = MAT_TWEENS[k];
            var m = mats[k];
            var p = smooth(clamp01((t - tw.t0) / (tw.t1 - tw.t0)));
            m.color.setHex(tw.from[0]).lerp(new THREE.Color(tw.to[0]), p);
            m.roughness = tw.from[1] + (tw.to[1] - tw.from[1]) * p;
            m.opacity = tw.from[2] + (tw.to[2] - tw.from[2]) * p;
          }
        }

        function applyEyes(dt) {
          if (!eyes) return;
          lookTargetVec.set(lookTarget.x, lookTarget.y);
          lookVec.lerp(lookTargetVec, 1 - Math.exp(-dt * 9));
          var op = api.openness;
          var rx = 0.05 + (0.33 - 0.05) * op;
          var zUp = 0.25 + (0.035 - 0.25) * op;
          var zDn = 0.30 + (0.035 - 0.30) * op;
          eyes.position.x = lookVec.x * rx;
          eyes.position.y = lookVec.y > 0 ? lookVec.y * zUp : lookVec.y * zDn;
          if (rootModel && !prefersReducedMotion()) {
            var targetRotY = lookVec.x * 0.22;
            var targetRotX = -lookVec.y * 0.14;
            rootModel.rotation.y += (targetRotY - rootModel.rotation.y) * Math.min(1, dt * 6);
            rootModel.rotation.x += (targetRotX - rootModel.rotation.x) * Math.min(1, dt * 6);
          }
        }

        var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
          visible = es[0].isIntersecting;
        }) : null;
        if (io) io.observe(container);

        var ro = 'ResizeObserver' in window ? new ResizeObserver(function () {
          renderer.setSize(w(), h());
          camera.aspect = w() / h();
          camera.updateProjectionMatrix();
        }) : null;
        if (ro) ro.observe(container);

        var clock = new THREE.Clock();
        function tick(now) {
          if (!alive) return;
          raf = requestAnimationFrame(tick);
          if (!visible || document.hidden) {
            clock.getDelta();
            return;
          }
          if (now - last < 1000 / o.fps - 1) return;
          last = now;
          var dt = Math.min(clock.getDelta(), 0.1);
          if (mixer) mixer.update(dt);
          applyMaterials();
          applyEyes(dt);
          renderer.render(scene, camera);
        }
        raf = requestAnimationFrame(tick);

        api._dispose3D = function () {
          cancelAnimationFrame(raf);
          if (io) io.disconnect();
          if (ro) ro.disconnect();
          renderer.dispose();
          pmrem.dispose();
          if (renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          }
        };
      })
      .catch(function () {
        if (!alive) return;
        activateFallback('esm-cdn-unavailable');
      });

    return api;
  }

  window.KAN3D = { mount: mount };
})();
