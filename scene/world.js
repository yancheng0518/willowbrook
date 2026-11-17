import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCottage } from './cottage.js';
import { createGrounds } from './grounds.js';
import { createPavilion } from './pavilion.js';

const views = {
  overview: { target: [0, 2.20, 0.6], eye: [13.2, 12.4, 25.6], minDistance: 12.1, clearing: 6.2 },
  cottage: { target: [-3.7, 2.55, -2.2], eye: [4.65, 5.85, 10.5], minDistance: 8.2, clearing: 3.7 },
  pavilion: { target: [6.35, 1.92, -0.22], eye: [11.45, 4.15, 7.65], minDistance: 6.8, clearing: 3.2 },
  creek: { target: [0.4, 0.65, 7], eye: [5.9, 3.65, 16.6], minDistance: 7.5, clearing: 3.4 },
};

const mood = [
  {
    sky: '#a1b2af', horizon: '#b3b8a1', high: '#7b9eac', sun: '#ffe0af',
    ambient: '#edf0c8', soil: '#71634a', rim: '#cfe6e1',
    ambientPower: 1.12, sunPower: 3.35, rimPower: 0.45, exposure: 1.08, fog: 0.016,
  },
  {
    sky: '#333f64', horizon: '#3b4b62', high: '#171d36', sun: '#bcd3ff',
    ambient: '#a6bdff', soil: '#44495c', rim: '#8bacf0',
    ambientPower: 0.74, sunPower: 0.63, rimPower: 0.30, exposure: 0.92, fog: 0.022,
  },
];

function makeSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      atmosphere: { value: new THREE.Color() },
      horizon: { value: new THREE.Color() },
      zenith: { value: new THREE.Color() },
      evening: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 atmosphere;
      uniform vec3 horizon;
      uniform vec3 zenith;
      uniform float evening;
      varying vec3 vDirection;
      void main() {
        vec3 axis = normalize(vDirection);
        float altitude = max(0.0, axis.y);
        vec3 sky = mix(horizon, atmosphere, smoothstep(0.0, .24, altitude));
        sky = mix(sky, zenith, pow(altitude, .72));
        float haze = pow(max(0.0, dot(axis, normalize(vec3(-1., .19, .20)))), 5.);
        sky += vec3(.28, .15, .042) * haze * (1. - evening);
        gl_FragColor = vec4(sky, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(140, 24, 12), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

function smokeFrom(chimney) {
  const cloud = document.createElement('canvas');
  cloud.width = cloud.height = 80;
  const ink = cloud.getContext('2d');
  const lobes = [[40, 40, 27], [30, 38, 17], [45, 28, 17], [52, 47, 14]];
  for (const [x, y, r] of lobes) {
    const shade = ink.createRadialGradient(x, y, 0, x, y, r);
    shade.addColorStop(0, 'rgba(255,255,255,0.36)');
    shade.addColorStop(0.45, 'rgba(255,255,255,0.15)');
    shade.addColorStop(1, 'rgba(255,255,255,0)');
    ink.fillStyle = shade;
    ink.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const map = new THREE.CanvasTexture(cloud);
  const puffs = Array.from({ length: 10 }, () => {
    const material = new THREE.SpriteMaterial({ map, color: '#e4e1c7', depthWrite: false, transparent: true });
    const sprite = new THREE.Sprite(material);
    chimney.add(sprite);
    return sprite;
  });

  return (time, night) => {
    puffs.forEach((puff, index) => {
      const age = (time * 0.22 + index / puffs.length) % 1;
      puff.position.set(0.11 * Math.sin(age * 3 + index) + age * age * 2.35, age * 3.12, -age * 1.04);
      const size = 0.4 + age * 1.36;
      puff.scale.set(size * 1.18, size, 1);
      puff.material.rotation = index * 1.18 + age * 1.3;
      puff.material.opacity = Math.sin(Math.PI * age) * THREE.MathUtils.lerp(0.34, 0.13, night);
    });
  };
}

export function createWorld(canvas, { onContextLost }) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const touch = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !touch, powerPreference: 'default' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(mood[0].horizon, mood[0].fog);
  const sky = makeSky();
  scene.add(sky);

  const hemi = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.position.set(-15, 22, 12);
  sun.target.position.set(-1, 0, -1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 2, far: 62 });
  sun.shadow.bias = -0.00022;
  sun.shadow.normalBias = 0.046;
  sun.shadow.radius = 2.25;
  const rim = new THREE.DirectionalLight();
  rim.position.set(11, 6, -16);
  scene.add(hemi, sun, sun.target, rim);

  const grounds = createGrounds();
  const cottage = createCottage();
  const pavilion = createPavilion();
  cottage.group.position.set(-3.8, 0, -3.3);
  pavilion.group.position.set(6.1, 0, -0.3);
  scene.add(grounds.group, cottage.group, pavilion.group);
  const animateSmoke = cottage.chimney ? smokeFrom(cottage.chimney) : null;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.22, 155);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = !reduced.matches;
  controls.dampingFactor = 0.105;
  controls.rotateSpeed = 0.53;
  controls.zoomSpeed = 0.72;
  controls.minDistance = views.overview.minDistance;
  controls.maxDistance = 47;
  controls.minPolarAngle = 0.26;
  controls.maxPolarAngle = 1.47;

  controls.target.fromArray(views.overview.target);
  camera.position.fromArray(views.overview.eye);
  controls.update();
  let clearing = views.overview.clearing;

  let width = 0;
  let height = 0;
  let dirty = true;
  let lost = false;
  let maxRatio = 1;
  let sampleTime = 0;
  let sampleFrames = 0;
  function resize() {
    const nextWidth = canvas.clientWidth;
    const nextHeight = canvas.clientHeight;
    if (nextWidth === 0 || nextHeight === 0 || (nextWidth === width && nextHeight === height)) return;
    width = nextWidth;
    height = nextHeight;
    camera.aspect = width / height;
    const portraitFov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(21)) / camera.aspect);
    camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(portraitFov), 35, 86);
    camera.updateProjectionMatrix();
    const pixelBudget = touch ? 1050000 : 2000000;
    maxRatio = Math.min(devicePixelRatio || 1, touch ? 1.5 : 1.7, Math.sqrt(pixelBudget / (width * height)));
    sampleTime = sampleFrames = 0;
    renderer.setPixelRatio(maxRatio);
    renderer.setSize(width, height, false);
    dirty = true;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const desired = { house: 1, table: 1, night: 0 };
  const current = { ...desired };
  const applyLight = {
    house: cottage.setLight,
    table: pavilion.setLight,
    night: applyMood,
  };
  const duskColors = {};
  const nightColors = {};
  for (const key of ['sky', 'horizon', 'high', 'sun', 'ambient', 'soil', 'rim']) {
    duskColors[key] = new THREE.Color(mood[0][key]);
    nightColors[key] = new THREE.Color(mood[1][key]);
  }

  function applyMood(amount) {
    const uniforms = sky.material.uniforms;
    uniforms.atmosphere.value.lerpColors(duskColors.sky, nightColors.sky, amount);
    uniforms.horizon.value.lerpColors(duskColors.horizon, nightColors.horizon, amount);
    uniforms.zenith.value.lerpColors(duskColors.high, nightColors.high, amount);
    uniforms.evening.value = amount;
    scene.fog.color.copy(uniforms.horizon.value);
    scene.fog.density = THREE.MathUtils.lerp(mood[0].fog, mood[1].fog, amount);
    hemi.color.lerpColors(duskColors.ambient, nightColors.ambient, amount);
    hemi.groundColor.lerpColors(duskColors.soil, nightColors.soil, amount);
    sun.color.lerpColors(duskColors.sun, nightColors.sun, amount);
    rim.color.lerpColors(duskColors.rim, nightColors.rim, amount);
    hemi.intensity = THREE.MathUtils.lerp(mood[0].ambientPower, mood[1].ambientPower, amount);
    sun.intensity = THREE.MathUtils.lerp(mood[0].sunPower, mood[1].sunPower, amount);
    rim.intensity = THREE.MathUtils.lerp(mood[0].rimPower, mood[1].rimPower, amount);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(mood[0].exposure, mood[1].exposure, amount);
  }

  applyMood(0);
  let transition = null;
  const offset = new THREE.Vector3();
  const spherical = new THREE.Spherical();
  const moment = performance.now();
  let previous = moment;

  function setView(name, instant = reduced.matches) {
    const view = views[name];
    const target = new THREE.Vector3().fromArray(view.target);
    const eye = new THREE.Vector3().fromArray(view.eye);
    const start = new THREE.Spherical().setFromVector3(offset.copy(camera.position).sub(controls.target));
    const finish = new THREE.Spherical().setFromVector3(eye.clone().sub(target));
    finish.theta = start.theta + THREE.MathUtils.euclideanModulo(finish.theta - start.theta + Math.PI, Math.PI * 2) - Math.PI;
    transition = {
      from: controls.target.clone(), target, start, finish,
      startLimit: controls.minDistance, finishLimit: view.minDistance,
      startClearing: clearing, finishClearing: view.clearing, seconds: 0,
    };
    if (instant) advanceView(1);
    dirty = true;
  }

  function advanceView(seconds) {
    transition.seconds += seconds;
    const progress = Math.min(transition.seconds / 0.92, 1);
    const eased = THREE.MathUtils.smootherstep(progress, 0, 1);
    const { from, target, start, finish, startLimit, finishLimit, startClearing, finishClearing } = transition;
    controls.target.lerpVectors(from, target, eased);
    controls.minDistance = THREE.MathUtils.lerp(startLimit, finishLimit, eased);
    clearing = THREE.MathUtils.lerp(startClearing, finishClearing, eased);
    spherical.set(
      THREE.MathUtils.lerp(start.radius, finish.radius, eased),
      THREE.MathUtils.lerp(start.phi, finish.phi, eased),
      THREE.MathUtils.lerp(start.theta, finish.theta, eased),
    );
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    if (progress === 1) transition = null;
    dirty = true;
  }

  function moveCamera({ azimuth = 0, altitude = 0, scale = 1 }) {
    transition = null;
    spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
    spherical.theta += azimuth;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + altitude, controls.minPolarAngle, controls.maxPolarAngle);
    spherical.radius = THREE.MathUtils.clamp(spherical.radius * scale, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    dirty = true;
  }

  controls.addEventListener('start', () => { transition = null; });
  controls.addEventListener('change', () => { dirty = true; });
  reduced.addEventListener('change', (event) => {
    controls.enableDamping = !event.matches;
    if (event.matches && transition) advanceView(1);
    dirty = true;
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    lost = true;
    renderer.setAnimationLoop(null);
    observer.disconnect();
    controls.dispose();
    onContextLost();
  }, { once: true });

  grounds.update(0);
  grounds.setViewTarget(controls.target, clearing);
  animateSmoke?.(0, 0);
  sky.position.copy(camera.position);
  renderer.render(scene, camera);
  previous = performance.now();
  renderer.setAnimationLoop((now) => {
    if (lost) return;
    const dt = Math.max((now - previous) / 1000, 0);
    previous = now;
    // Resolution is the first quality setting to yield when a device misses the frame budget.
    if (!reduced.matches && !document.hidden && dt < 1) {
      sampleTime += dt;
      sampleFrames += 1;
      if (sampleFrames === 20) {
        const ratio = renderer.getPixelRatio();
        if (sampleTime > 0.72 && ratio > maxRatio * 0.62) {
          renderer.setPixelRatio(Math.max(maxRatio * 0.62, ratio * 0.83));
        }
        sampleTime = sampleFrames = 0;
      }
    }
    if (transition) advanceView(dt);
    controls.update();
    for (const key of Object.keys(current)) {
      if (current[key] === desired[key]) continue;
      const next = THREE.MathUtils.damp(current[key], desired[key], key === 'night' ? 4.2 : 7.3, dt);
      current[key] = reduced.matches || Math.abs(next - desired[key]) < 0.002 ? desired[key] : next;
      applyLight[key](current[key]);
      dirty = true;
    }
    if (!reduced.matches || dirty) {
      const time = reduced.matches ? 0 : Math.max(0, (now - moment) / 1000);
      grounds.update(time);
      grounds.setViewTarget(controls.target, clearing);
      animateSmoke?.(time, current.night);
      sky.position.copy(camera.position);
      renderer.render(scene, camera);
      dirty = false;
    }
  });

  return {
    setView,
    moveCamera,
    setNight: (enabled) => { desired.night = Number(enabled); },
    setLight: (key, enabled) => { desired[key] = Number(enabled); },
  };
}
