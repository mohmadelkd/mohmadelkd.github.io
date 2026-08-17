import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

(function () {
  'use strict';

  function extOf(url) {
    var m = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(url || '');
    return m ? m[1].toLowerCase() : '';
  }

  function makeLoader(ext) {
    if (ext === 'stl') return new STLLoader();
    if (ext === '3mf') return new ThreeMFLoader();
    if (ext === 'obj') return new OBJLoader();
    if (ext === 'glb' || ext === 'gltf') return new GLTFLoader();
    return null;
  }

  function initViewer(mount) {
    if (mount.dataset.modelInit) return;
    mount.dataset.modelInit = '1';
    var statusEl, renderer, scene, camera, controls;
    var modelGroup = null;
    var homeState = null;

    var width = mount.clientWidth || 480;
    var height = Math.max(300, Math.min(560, Math.round(width * 0.6)));
    mount.style.height = height + 'px';

    statusEl = document.createElement('span');
    statusEl.className = 'model3d-status';
    statusEl.hidden = true;
    mount.parentNode.insertBefore(statusEl, mount.nextSibling);
    function setStatus(text) {
      statusEl.hidden = false;
      statusEl.textContent = text;
    }
    function showLoading(text) {
      mount.classList.add('loading');
      mount.classList.remove('error');
      setStatus(text);
    }

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (e) {
      setStatus('WebGL is not available on this device.');
      mount.classList.add('error');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 2000);
    camera.position.set(4, 4.5, 5.5);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2;
    controls.maxDistance = 40;

    // Matcap studio lighting, like Printables' viewer: a lit-sphere image is
    // baked into the material, so every face shades by its own direction.
    // No scene lights or shadows needed - each face stays distinct as you rotate.
    function makeMatcap() {
      var size = 256;
      var canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      var ctx = canvas.getContext('2d');
      var img = ctx.createImageData(size, size);
      var d = img.data;
      var c = size / 2, r = size / 2;
      // Light direction (from upper-left) as a unit vector.
      var lx = -0.45, ly = -0.6, lz = 0.66;
      for (var y = 0; y < size; y++) {
        for (var x = 0; x < size; x++) {
          var i = (y * size + x) * 4;
          var nx = (x - c) / r, ny = (y - c) / r;
          var nz2 = 1 - nx * nx - ny * ny;
          var shade;
          if (nz2 <= 0) {
            shade = 0.28; // outside the sphere: flat dark blue-gray
          } else {
            var nz = Math.sqrt(nz2);
            var v = nx * lx + ny * ly + nz * lz;
            shade = 0.32 + Math.max(0, v) * 0.95; // ambient + diffuse
            if (v > 0.55) shade += Math.pow(v - 0.55, 2) * 2.2; // soft hot spot
            if (shade > 1) shade = 1;
          }
          // Neutral gray sphere (color comes from the material tint).
          d[i]     = Math.round(255 * shade);
          d[i + 1] = Math.round(255 * shade);
          d[i + 2] = Math.round(255 * shade);
          d[i + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      var tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }
    var matcap = makeMatcap();

    function makeMat(mc) {
      return new THREE.MeshMatcapMaterial({
        matcap: mc, color: 0x90a6ff, side: THREE.DoubleSide, flatShading: true
      });
    }

    function setModelMaterial(object) {
      object.traverse(function (child) {
        if (child.isMesh && child.material) {
          child.material = makeMat(matcap);
        }
      });
    }

    var grid = new THREE.GridHelper(20, 20, 0xffffff, 0x8b93a3);
    grid.material.transparent = true;
    grid.material.opacity = 0.22;
    grid.position.y = 0.03;
    grid.visible = false; // off by default, toggled via the toolbar
    scene.add(grid);

    // Smooth camera flight for toolbar actions (home / zoom).
    var tween = null;

    function easeOutCubic(k) {
      return 1 - Math.pow(1 - k, 3);
    }

    function flyTo(pos, tgt, dur) {
      tween = {
        p0: camera.position.clone(),
        p1: pos.clone(),
        t0: controls.target.clone(),
        t1: tgt.clone(),
        start: performance.now(),
        dur: dur || 650
      };
    }

    function updateTween(now) {
      if (!tween) return;
      var k = Math.min(1, (now - tween.start) / tween.dur);
      var e = easeOutCubic(k);
      camera.position.lerpVectors(tween.p0, tween.p1, e);
      controls.target.lerpVectors(tween.t0, tween.t1, e);
      if (k >= 1) tween = null;
    }

    controls.addEventListener('start', function () { tween = null; });

    function rememberHome() {
      homeState = { position: camera.position.clone(), target: controls.target.clone() };
    }

    function fit(object) {
      var box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) return 0;
      var size = new THREE.Vector3(), center = new THREE.Vector3();
      box.getSize(size); box.getCenter(center);
      var span = Math.max(size.x, Math.max(size.y, size.z)) || 1;
      var s = 4 / span;
      object.scale.set(s, s, s);
      // Place the model correctly on the base: scale around the origin, then
      // shift it so its bottom sits exactly on the ground plane (y=0) and it
      // is centered horizontally.
      object.position.x = -center.x * s;
      object.position.z = -center.z * s;
      object.position.y = 0 - box.min.y * s;

      var targetY = (size.y * s) / 2;
      controls.target.set(0, targetY, 0);
      var dist = Math.max(6, 4 * 1.8);
      camera.position.set(
        dist * 0.5,
        dist * 0.45 + targetY,
        dist * 0.7
      );
      controls.update();
      rememberHome();
      return s;
    }

    function normalizeMats(object) {
      setModelMaterial(object);
    }

    function setView(view) {
      var t = controls.target;
      var d = Math.max(controls.minDistance, camera.position.distanceTo(t) || 8);
      var x = t.x, y = t.y, z = t.z;
      if (view === 'top') {
        camera.position.set(x + d * 0.18, y + d, z + 0.01);
      } else if (view === 'front') {
        camera.position.set(x + d * 0.4, y + d * 0.5, z + d);
      } else if (view === 'side') {
        camera.position.set(x + d, y + d * 0.42, z + d * 0.15);
      } else if (view === 'back') {
        camera.position.set(x - d * 0.4, y + d * 0.5, z - d);
      }
      camera.lookAt(t);
      controls.update();
    }

    function zoomBy(factor) {
      var dir = new THREE.Vector3().subVectors(camera.position, controls.target);
      var len = dir.length();
      if (!len) return;
      len = Math.max(controls.minDistance, Math.min(controls.maxDistance, len * factor));
      dir.normalize().multiplyScalar(len);
      var end = controls.target.clone().add(dir);
      flyTo(end, controls.target.clone(), 600);
    }

    function buildModel(data, ext) {
      var group = new THREE.Group();
      if (ext === 'stl') {
        // STL files (and most CAD exports) are Z-up; Three.js is Y-up.
        // Rotate so the model's "up" points at the sky like the source model.
        data.rotateX(-Math.PI / 2);
        var mesh = new THREE.Mesh(data, makeMat(matcap));
        group.add(mesh);
      } else if (ext === '3mf') {
        // 3MF is Z-up as well; flip it to Y-up to match STL/CAD.
        data.rotateX(-Math.PI / 2);
        group.add(data);
        normalizeMats(group);
      } else if (ext === 'glb' || ext === 'gltf') {
        group.add(data.scene);
        setModelMaterial(group);
      } else {
        group.add(data);
        normalizeMats(group);
      }
      return group;
    }

    function load(url) {
      var ext = extOf(url);
      var loader = ext ? makeLoader(ext) : null;
      if (!loader) {
        setStatus("Can't preview this format in the browser. It's listed in the Files section below.");
        mount.classList.add('error');
        return;
      }
      if (modelGroup) { scene.remove(modelGroup); modelGroup = null; }
      mount.classList.remove('error');
      showLoading('Loading 3D model\u2026');
      loader.load(url, function (data) {
        var group = buildModel(data, ext);
        scene.add(group);
        modelGroup = group;
        try { fit(group); } catch (e) { /* keep default camera if fit fails */ }
        mount.classList.remove('loading');
        mount.classList.add('ready');
        statusEl.hidden = true;
      }, function (ev) {
        // Show real download progress for large models.
        if (ev && ev.total) {
          var pct = Math.round((ev.loaded / ev.total) * 100);
          setStatus('Loading 3D model\u2026 ' + pct + '%');
        }
      }, function () {
        setStatus("Couldn't load this model. It's listed in the Files section below.");
        mount.classList.remove('loading');
        mount.classList.add('error');
      });
    }

    // Wire the toolbar buttons rendered inside the viewer bar.
    var bar = mount.parentNode.querySelector('.model3d-bar');
    if (bar) {
      bar.querySelectorAll('[data-view]').forEach(function (btn) {
        var v = btn.dataset.view;
        btn.addEventListener('click', function () {
          if (v === 'home') {
            if (homeState) {
              flyTo(homeState.position, homeState.target, 700);
            } else if (modelGroup) {
              fit(modelGroup);
            } else {
              setView('front');
            }
          } else if (v === 'zoom-in') {
            zoomBy(0.75);
          } else if (v === 'zoom-out') {
            zoomBy(1.35);
          } else if (v === 'grid') {
            grid.visible = !grid.visible;
            btn.classList.toggle('active', grid.visible);
          }
        });
      });
    }

    load(mount.dataset.model);

    function render() {
      requestAnimationFrame(render);
      updateTween(performance.now());
      controls.update();
      renderer.render(scene, camera);
    }
    render();

    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () {
        var w = mount.clientWidth;
        if (!w) return;
        var h = mount.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      });
      ro.observe(mount);
    }
  }

  Array.prototype.slice.call(document.querySelectorAll('[data-model]')).forEach(initViewer);

  // Pick up viewers added later, e.g. the 3D preview modal for model files.
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(function (muts) {
      for (var m = 0; m < muts.length; m++) {
        var added = muts[m].addedNodes;
        for (var i = 0; i < added.length; i++) {
          var n = added[i];
          if (!n || n.nodeType !== 1) continue;
          if (n.matches && n.matches('[data-model]')) initViewer(n);
          if (n.querySelectorAll) {
            var inside = n.querySelectorAll('[data-model]');
            for (var k = 0; k < inside.length; k++) initViewer(inside[k]);
          }
        }
      }
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  }
})();