import * as THREE from 'three';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

function randomSource(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function creek(x) {
  return 7.25 + Math.sin(x * 0.174) * 1.35 + Math.sin(x * 0.37 + 1.35) * 0.46;
}

function halfWidth(x) {
  return 2.13 + Math.cos(x * 0.22 - 0.6) * 0.42 + Math.sin(x * 0.55) * 0.21;
}

function terrainHeight(x, z) {
  const riverDistance = Math.abs(z - creek(x)) - halfWidth(x);
  const shore = THREE.MathUtils.smoothstep(riverDistance, -0.35, 0.88);
  const apron = THREE.MathUtils.smoothstep(Math.max(Math.abs(x) - 11.2, -z - 7.8, z - 12.8), 0, 10);
  const hill = Math.sin(x * 0.24 + z * 0.19) * 0.59 +
    Math.cos(x * 0.16 - z * 0.36) * 0.48 + Math.sin(z * 0.15) * 0.34;
  const bankRipple = Math.sin(x * 0.8 + z * 1.12) * Math.cos(z * 0.74) * 0.16;
  return -0.72 + shore * 0.72 + (hill * apron + bankRipple * (0.25 + apron * 0.75)) * shore *
    THREE.MathUtils.smoothstep(riverDistance, 0.2, 1.15);
}

function geometryFrom(positions, indices, colors, uv) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (indices) geometry.setIndex(indices);
  if (colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  if (uv) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function soilMaterial(strength, isFootpath = false) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    transparent: isFootpath,
    depthWrite: !isFootpath,
    polygonOffset: isFootpath,
    polygonOffsetFactor: -1
  });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSoil;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSoil = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSoil;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' +
        'float soilHash = fract(sin(dot(floor(vSoil * 98.0), vec2(12.9898, 78.233))) * 43758.5453);\n' +
        'float soilVeins = sin(vSoil.x * 10.3 + cos(vSoil.y * 3.6)) * cos(vSoil.y * 10.9);\n' +
        'float grain = (soilHash - 0.5) * (1.0 - smoothstep(0.009, 0.037, length(fwidth(vSoil))));\n' +
        'diffuseColor.rgb *= 1.0 + (grain + soilVeins * 0.26) * ' + strength.toFixed(3) + ';');
    if (isFootpath) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vPathBand;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPathBand = uv.y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vPathBand;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n' +
          'float wornEdge = 0.13 + 0.027 * sin(vSoil.x * 21.0 + vSoil.y * 18.9);\n' +
          'diffuseColor.a *= smoothstep(0.01, wornEdge, min(vPathBand, 1.0 - vPathBand));');
    }
  };
  material.customProgramCacheKey = () => 'ground-grain-' + strength + '-' + isFootpath;
  return material;
}

function samplesBetween(zones) {
  const samples = [zones[0][0]];
  for (let i = 1; i < zones.length; i++) {
    const [start] = zones[i - 1];
    const [end, spacing] = zones[i];
    const count = Math.ceil((end - start) / spacing);
    for (let j = 1; j <= count; j++) samples.push(THREE.MathUtils.lerp(start, end, j / count));
  }
  return samples;
}

function makeTerrain() {
  const grass = new THREE.Color('#75834d');
  const forest = new THREE.Color('#485f3e');
  const moss = new THREE.Color('#929557');
  const sand = new THREE.Color('#847459');
  const mud = new THREE.Color('#535b43');
  const positions = [], colors = [], indices = [];
  const xSamples = samplesBetween([[-81.5], [-36, 2.4], [-18.5, 0.92], [20.5, 0.46], [36, 0.92], [81.5, 2.4]]);
  const groundSamples = samplesBetween([[-81], [-28, 2.5], [-10, 1.2], [3.4, 0.70], [12, 0.38], [25, 0.90], [82, 2.5]]);
  const fishbone = new THREE.Color();
  for (let i = 0; i < xSamples.length; i++) {
    const x = xSamples[i];
    const center = creek(x);
    for (let j = 0; j < groundSamples.length; j++) {
      const z = groundSamples[j] + center - 7.25;
      const toWater = Math.abs(z - center) - halfWidth(x);
      const y = terrainHeight(x, z);
      positions.push(x, y, z);
      const patch = 0.5 + 0.19 * Math.sin(x * 0.34 + Math.sin(z * 0.54)) + 0.2 * Math.cos(x * 0.53 - z * 0.38);
      const speckle = 0.5 + 0.5 * Math.sin(x * 6.3 + z * 9.37) * Math.cos(z * 7.21);
      const outskirts = THREE.MathUtils.smoothstep(Math.hypot((x + 2) * 0.88, (z + 2) * 0.99), 9, 23);
      fishbone.copy(grass).lerp(moss, patch * 0.66).lerp(forest, outskirts * 0.65 + speckle * 0.12);
      fishbone.lerp(sand, 1 - THREE.MathUtils.smoothstep(toWater, 0.28 + speckle * 0.31, 1.31 + patch * 0.36));
      fishbone.lerp(mud, 1 - THREE.MathUtils.smoothstep(toWater, -0.57, 0.25));
      colors.push(fishbone.r, fishbone.g, fishbone.b);
      if (i === 0 || j === 0) continue;
      const a = (i - 1) * groundSamples.length + j - 1;
      const b = a + groundSamples.length;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const mesh = new THREE.Mesh(geometryFrom(positions, indices, colors), soilMaterial(0.28));
  mesh.name = 'Grassy clearing and forest floor';
  mesh.receiveShadow = true;
  return mesh;
}

function makeCreek() {
  const positions = [], uv = [], indices = [];
  const segments = 270;
  const widthSteps = 8;
  const time = { value: 0 };
  for (let segment = 0; segment <= segments; segment++) {
    const x = (segment / segments - 0.5) * 163;
    for (let side = 0; side <= widthSteps; side++) {
      const v = side / widthSteps;
      positions.push(x, -0.37, creek(x) + (v * 2 - 1) * (halfWidth(x) + 0.21));
      uv.push(segment / segments, v);
      if (segment === 0 || side === 0) continue;
      const a = (segment - 1) * (widthSteps + 1) + side - 1;
      const b = a + widthSteps + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  const material = new THREE.MeshPhysicalMaterial({
    color: '#85beb2', roughness: 0.26, metalness: 0.12, clearcoat: 0.55, clearcoatRoughness: 0.25
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.creekTime = time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCreek;\nvarying vec2 vCreekWorld;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCreek = uv;\nvCreekWorld = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float creekTime;\nvarying vec2 vCreek;\nvarying vec2 vCreekWorld;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + [
        'float across = min(vCreek.y, 1.0 - vCreek.y);',
        'float drift = vCreekWorld.x - creekTime * 0.58;',
        'float ripple = sin(vCreekWorld.y * 8.4 + sin(drift * 0.75) * 2.8 + drift * 1.4);',
        'float wave = cos(vCreekWorld.y * 3.3 - drift * 0.81 + cos(drift * 0.46) * 2.1);',
        'float fleck = sin(drift * 8.1 + vCreekWorld.y * 5.5) * sin(drift * 4.7 - vCreekWorld.y * 3.7);',
        'vec3 bankTint = vec3(0.36, 0.41, 0.21);',
        'vec3 deepTint = vec3(0.12, 0.45, 0.43);',
        'vec3 skyTint = vec3(0.31, 0.63, 0.66);',
        'float current = 0.52 + 0.16 * ripple + 0.19 * wave;',
        'vec3 flowing = mix(deepTint, skyTint, current);',
        'diffuseColor.rgb = mix(bankTint, flowing, smoothstep(0.012, 0.33, across));',
        'float lace = smoothstep(0.70, 0.98, ripple) * smoothstep(0.16, 0.81, wave);',
        'float sheen = lace * (0.07 + max(0.0, fleck) * 0.12);',
        'float strands = sin(vCreekWorld.y * 15.0 + 0.91 * sin(drift * 1.19) + drift * 0.035);',
        'float gaps = sin(drift * 1.35 + vCreekWorld.y * 2.1) * sin(drift * 0.73 - vCreekWorld.y * 0.67);',
        'float glint = pow(max(strands, 0.0), 16.0) * smoothstep(0.18, 0.94, gaps);',
        'glint *= 0.44 * smoothstep(0.045, 0.14, across) * (1.0 - smoothstep(0.23, 0.5, across) * 0.47);',
        'float shoreline = (1.0 - smoothstep(0.012, 0.05, across)) * smoothstep(0.35, 0.95, wave) * 0.16;',
        'diffuseColor.rgb += vec3(0.72, 0.91, 0.86) * (sheen + shoreline + glint);'
      ].join('\n'))
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' +
        'normal = normalize(normal + vec3(0.07 * ripple, 0.032 * wave, 0.075 * ripple * wave));');
  };
  const mesh = new THREE.Mesh(geometryFrom(positions, indices, null, uv), material);
  mesh.name = 'Flowing creek';
  mesh.receiveShadow = true;
  return { mesh, time };
}

function pathGeometry(points, startWidth, endWidth, random) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const steps = Math.max(24, Math.ceil(curve.getLength() * 15));
  const band = [-0.500, -0.43, -0.26, 0, 0.26, 0.43, 0.500];
  const positions = [], colors = [], indices = [], uv = [];
  const dirt = new THREE.Color('#b39a71');
  const centerDirt = new THREE.Color('#d4b68b');
  const darkEdge = new THREE.Color('#8c8657');
  const color = new THREE.Color();
  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    curve.getPoint(t, point);
    curve.getTangent(t, tangent);
    const width = THREE.MathUtils.lerp(startWidth, endWidth, t) *
      (1 + 0.13 * Math.sin(t * 29) + 0.05 * Math.cos(t * 52));
    for (let j = 0; j < band.length; j++) {
      const edge = band[j] * width;
      const x = point.x + tangent.z * edge;
      const z = point.z - tangent.x * edge;
      const y = terrainHeight(x, z) + 0.027 + (1 - Math.abs(band[j] * 2)) * 0.006;
      positions.push(x, y, z);
      uv.push(t, band[j] + 0.5);
      const trim = Math.pow(Math.abs(band[j] * 2), 4);
      color.copy(dirt).lerp(centerDirt, 0.2 + random() * 0.55).lerp(darkEdge, trim * 0.61);
      colors.push(color.r, color.g, color.b);
      if (i === 0 || j === 0) continue;
      const a = (i - 1) * band.length + j - 1;
      const b = a + band.length;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { geometry: geometryFrom(positions, indices, colors, uv), curve };
}

function bladeGeometry(random, leafCount, tuftHeight) {
  const positions = [];
  const colors = [];
  const leaf = new THREE.Color();
  for (let i = 0; i < leafCount; i++) {
    const a = random() * TAU;
    const y = tuftHeight * (0.58 + random() * 0.45);
    const bend = tuftHeight * (0.35 + random() * 0.44);
    const width = (0.11 + random() * 0.17) * tuftHeight;
    const x = Math.sin(a) * bend, z = Math.cos(a) * bend;
    const bx = Math.cos(a) * width, bz = -Math.sin(a) * width;
    const ax = x * 0.16, az = z * 0.16;
    positions.push(
      ax - bx * 0.25, 0, az - bz * 0.25, ax + bx * 0.25, 0, az + bz * 0.25, x * 0.48 + bx * 0.5, y * 0.57, z * 0.48 + bz * 0.5,
      ax - bx * 0.25, 0, az - bz * 0.25, x * 0.48 + bx * 0.5, y * 0.57, z * 0.48 + bz * 0.5, x * 0.48 - bx * 0.5, y * 0.57, z * 0.48 - bz * 0.5,
      x * 0.48 - bx * 0.5, y * 0.57, z * 0.48 - bz * 0.5, x * 0.48 + bx * 0.5, y * 0.57, z * 0.48 + bz * 0.5, x, y, z
    );
    const tint = 0.58 + random() * 0.26;
    for (const bright of [0.56, 0.59, 0.86, 0.56, 0.88, 0.91, 0.88, 0.91, 1]) {
      leaf.setRGB(tint * bright, (tint + 0.06) * bright, (tint - 0.04) * bright);
      colors.push(leaf.r, leaf.g, leaf.b);
    }
  }
  return geometryFrom(positions, null, colors);
}

function pineCrown(random, distant = false) {
  const positions = [], colors = [], indices = [];
  const sides = distant ? 7 : 12;
  const rings = distant ? [[0, 0.85], [0.38, 0.64], [1, 0.01]] :
    [[0, 0.79], [0.11, 0.96], [0.38, 0.72], [0.72, 0.33], [1, 0.01]];
  const color = new THREE.Color();
  const phase = random() * TAU;
  for (let layer = 0; layer < rings.length; layer++) {
    const [y, radius] = rings[layer];
    for (let radial = 0; radial < sides; radial++) {
      const a = radial / sides * TAU + phase;
      const r = radius * (0.8 + random() * 0.18 + (radial % 2 ? 0 : 0.13));
      const dy = y + (layer < 3 ? (random() - 0.5) * 0.09 : 0);
      positions.push(Math.sin(a) * r + y * 0.07, dy, Math.cos(a) * r);
      const shade = (0.58 + y * 0.38 + (radial % 2) * 0.035) * (0.93 + random() * 0.11);
      color.setRGB(shade * 0.89, shade, shade * 0.91);
      colors.push(color.r, color.g, color.b);
      if (layer === 0) continue;
      const aIndex = (layer - 1) * sides + radial;
      const aNext = (layer - 1) * sides + (radial + 1) % sides;
      indices.push(aIndex, aNext, aIndex + sides, aNext, aNext + sides, aIndex + sides);
    }
  }
  const geometry = geometryFrom(positions, indices, colors);
  return geometry;
}

function lumpGeometry(random, detail, irregularity) {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const position = geometry.getAttribute('position');
  const colors = [];
  const seed = random() * 17;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const ripple = Math.sin(x * 5 + y * 3 + seed) * Math.sin(z * 5.4 - y * 3 + seed);
    const r = 1 + irregularity * ripple;
    position.setXYZ(i, x * r, y * r, z * r);
    const brightness = 0.68 + 0.24 * (y * 0.5 + 0.5) + ripple * 0.1;
    colors.push(brightness * 0.96, brightness, brightness * 0.93);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function blossomGeometry() {
  const positions = [];
  const indices = [];
  for (let j = 0; j < 5; j++) {
    const a = j * TAU / 5;
    const x = Math.cos(a), z = Math.sin(a);
    const l = -z * 0.41, r = x * 0.41;
    const first = positions.length / 3;
    positions.push(
      x * 0.14, 0, z * 0.14,
      x * 0.85 - l, -0.04, z * 0.85 - r,
      x * 1.38 - l * 0.59, 0.10, z * 1.38 - r * 0.59,
      x * 1.38 + l * 0.59, 0.10, z * 1.38 + r * 0.59,
      x * 0.85 + l, -0.04, z * 0.85 + r,
      x * 0.90, 0.22, z * 0.90
    );
    for (let k = 0; k < 5; k++) indices.push(first + (k + 1) % 5, first + k, first + 5);
  }
  return geometryFrom(positions, indices);
}

function treeVisibilityMaterial(material, focus, clearance) {
  const result = material.clone();
  result.onBeforeCompile = shader => {
    shader.uniforms.woodlandFocus = focus;
    shader.uniforms.woodlandClearance = clearance;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + `
        uniform vec3 woodlandFocus;
        uniform float woodlandClearance;
        attribute vec4 woodlandTree;
        varying float vTreeFade;
        float treeFade() {
          vec2 fromFocus = cameraPosition.xz - woodlandFocus.xz;
          float cameraDistance = max(length(fromFocus), 0.001);
          vec2 cameraDirection = fromFocus / cameraDistance;
          vec2 fromTree = woodlandTree.xy - woodlandFocus.xz;
          float forward = dot(fromTree, cameraDirection);
          float side = abs(fromTree.x * cameraDirection.y - fromTree.y * cameraDirection.x);
          float positionOnRay = clamp(forward / cameraDistance, 0.0, 1.0);
          float crown = woodlandTree.w;
          float corridor = max(2.15, woodlandClearance * (1.0 - positionOnRay * 0.48)) + crown * 0.64;
          float flank = 1.0 - smoothstep(corridor, corridor + 2.8, side);
          float ahead = smoothstep(2.5, 5.7, forward);
          float beforeCamera = 1.0 - smoothstep(cameraDistance + crown * 0.36, cameraDistance + crown + 1.3, forward);
          float rayHeight = mix(woodlandFocus.y, cameraPosition.y, positionOnRay);
          float canopyOverlap = 1.0 - smoothstep(woodlandTree.z + 0.6, woodlandTree.z + 3.0, rayHeight);
          float distanceToCamera = length(woodlandTree.xy - cameraPosition.xz);
          float closeCanopy = 1.0 - smoothstep(crown * 0.65, crown + 1.5, distanceToCamera);
          float obstruction = max(flank * ahead * beforeCamera, closeCanopy) * canopyOverlap;
          return smoothstep(0.12, 0.86, obstruction);
        }`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTreeFade = treeFade();')
      .replace('#include <project_vertex>', '#include <project_vertex>\nif (vTreeFade > 0.998) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vTreeFade;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + `
        if (vTreeFade > 0.002) {
          float screenThreshold = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
          if (screenThreshold < vTreeFade) discard;
        }`);
  };
  result.customProgramCacheKey = () => 'forest-view-clearance';
  return result;
}

function instancing(group, random, focus, clearance) {
  const generic = new THREE.MeshStandardMaterial({ roughness: 0.91 });
  const tinted = new THREE.MeshStandardMaterial({ roughness: 0.92, vertexColors: true });
  const leaf = new THREE.MeshStandardMaterial({ roughness: 0.91, vertexColors: true, side: THREE.DoubleSide });
  const pine = new THREE.MeshStandardMaterial({ roughness: 0.94, vertexColors: true, side: THREE.DoubleSide });
  const shapes = {
    box: [new THREE.BoxGeometry(1, 1, 1), generic, true],
    log: [new THREE.CylinderGeometry(1, 1, 1, 8), generic, true],
    farLog: [new THREE.CylinderGeometry(0.62, 1, 1, 5), generic, false],
    branch: [new THREE.CylinderGeometry(0.59, 1, 1, 7), generic, true],
    trunk: [new THREE.CylinderGeometry(0.52, 1, 1, 9), generic, true],
    pear: [new THREE.SphereGeometry(1, 6, 5), generic, false],
    bud: [new THREE.IcosahedronGeometry(1, 0), generic, false],
    stone: [lumpGeometry(random, 1, 0.26), tinted, true],
    stoneSmall: [lumpGeometry(random, 0, 0.20), tinted, false],
    foliage: [lumpGeometry(random, 1, 0.30), tinted, true],
    distantFoliage: [lumpGeometry(random, 0, 0.30), tinted, false],
    pine: [pineCrown(random), pine, true],
    farPine: [pineCrown(random, true), pine, false],
    blossom: [blossomGeometry(), generic, false],
    grass: [bladeGeometry(random, 6, 0.32), leaf, false],
    fern: [bladeGeometry(random, 12, 0.63), leaf, false],
    onion: [bladeGeometry(random, 5, 0.4), leaf, false]
  };
  const buckets = new Map();
  const transform = new THREE.Object3D();
  const paint = new THREE.Color();
  const first = new THREE.Vector3();
  const last = new THREE.Vector3();
  const direction = new THREE.Vector3();
  let treeAnchor = null;

  function store(shape, color) {
    const key = treeAnchor ? 'tree-' + shape : shape;
    if (!buckets.has(key)) buckets.set(key, { shape, instances: [], forest: Boolean(treeAnchor) });
    paint.set(color);
    buckets.get(key).instances.push([transform.matrix.clone(), paint.clone(), treeAnchor]);
  }

  function put(shape, x, y, z, sx, sy, sz, color, rx = 0, ry = 0, rz = 0) {
    transform.position.set(x, y, z);
    transform.rotation.set(rx, ry, rz);
    transform.scale.set(sx, sy, sz);
    transform.updateMatrix();
    store(shape, color);
  }

  function link(shape, a, b, radius, color, depth = radius) {
    first.fromArray(a);
    last.fromArray(b);
    direction.subVectors(last, first);
    const span = direction.length();
    transform.position.addVectors(first, last).multiplyScalar(0.5);
    transform.quaternion.setFromUnitVectors(UP, direction.normalize());
    transform.scale.set(radius, span, depth);
    transform.updateMatrix();
    store(shape, color);
  }

  function flush() {
    for (const [name, { shape, instances, forest }] of buckets) {
      const [baseGeometry, baseMaterial, casts] = shapes[shape];
      const geometry = forest ? baseGeometry.clone() : baseGeometry;
      const material = forest ? treeVisibilityMaterial(baseMaterial, focus, clearance) : baseMaterial;
      if (forest) {
        const anchors = new Float32Array(instances.length * 4);
        instances.forEach(([, , anchor], i) => anchor.toArray(anchors, i * 4));
        geometry.setAttribute('woodlandTree', new THREE.InstancedBufferAttribute(anchors, 4));
      }
      const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
      mesh.name = 'Grounds ' + name;
      mesh.castShadow = casts;
      mesh.receiveShadow = true;
      instances.forEach(([matrix, color], i) => {
        mesh.setMatrixAt(i, matrix);
        mesh.setColorAt(i, color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }
  }
  return {
    put, link, flush,
    beginTree(x, z, height, radius) {
      treeAnchor = new THREE.Vector4(x, z, height, radius);
    },
    endTree() {
      treeAnchor = null;
    }
  };
}

const rocks = ['#62695e', '#77796c', '#8a8171', '#94917a', '#666159'];
const bark = ['#5c4735', '#644d37', '#5b4839', '#755a43'];
const pineDeep = ['#405a39', '#536a43', '#506949', '#435b40', '#5f7045'];
const pineTip = ['#768451', '#70814e', '#607746', '#627b51'];
const canopy = ['#516e43', '#617649', '#6e814d', '#768351', '#829251', '#4c6e52'];
const shrub = ['#758643', '#687b48', '#667843', '#8b9253', '#6c8047'];
const herbs = ['#7f8e45', '#8f9851', '#6e8e4f', '#6e8f58', '#abc068'];
const petals = ['#f9edbf', '#efbb63', '#d59c78', '#bda7ce', '#e6d79d'];
const wood = ['#7c5938', '#8f653e', '#9c7349', '#6d5135', '#b18753'];

function pick(options, random) {
  return options[Math.floor(random() * options.length)];
}

function buildBridge(batch, random) {
  const x = 0.85;
  const north = creek(x) - halfWidth(x) - 0.72;
  const south = creek(x) + halfWidth(x) + 0.84;
  const center = (north + south) * 0.5;
  const halfSpan = (south - north) * 0.5;
  const arch = z => 0.2 + 0.55 * (1 - Math.pow((z - center) / halfSpan, 2));
  const width = 1.9;
  for (const z of [north + 0.35, south - 0.35]) {
    for (let i = 0; i < 6; i++) {
      batch.put('stone', x + (i - 2.5) * 0.39, terrainHeight(x, z) + 0.06, z, 0.37, 0.25, 0.42, pick(rocks, random), 0, random() * TAU);
    }
  }
  for (const dx of [-0.68, 0, 0.68]) {
    batch.link('log', [x + dx, 0.07, north - 0.14], [x + dx, 0.07, south + 0.14], 0.175, '#634832');
    let last = [x + dx, arch(north) - 0.17, north];
    for (let i = 1; i <= 7; i++) {
      const z = THREE.MathUtils.lerp(north, south, i / 7);
      const point = [x + dx, arch(z) - 0.17, z];
      batch.link('log', last, point, 0.113, '#745338');
      last = point;
    }
    for (const sign of [-1, 1]) {
      const z = center + sign * halfSpan * 0.72;
      batch.link('log', [x + dx, -0.48, z], [x + dx, arch(z) - 0.12, z], 0.13, '#745638');
    }
  }
  const slats = 27;
  for (let i = 0; i < slats; i++) {
    const z = THREE.MathUtils.lerp(north, south, i / (slats - 1));
    const tilt = Math.atan(-1.1 * (z - center) / (halfSpan * halfSpan));
    batch.put('box', x, arch(z) - 0.062, z, width + random() * 0.11, 0.124,
      (south - north) / (slats - 1) * 0.94, pick(wood, random), -tilt, (random() - 0.5) * 0.024);
    for (const dx of [-0.69, 0.69]) {
      batch.put('log', x + dx, arch(z) + 0.002, z, 0.018, 0.012, 0.018, '#514538');
    }
  }
  for (const sign of [-1, 1]) {
    const px = x + sign * 0.88;
    const postOffsets = [-0.93, -0.37, 0.37, 0.93];
    for (const t of postOffsets) {
      const z = center + t * halfSpan;
      const y = arch(z);
      batch.put('log', px, y + 0.31, z, 0.085, 0.86, 0.085, '#775336');
      batch.put('log', px, y + 0.745, z, 0.087, 0.031, 0.087, '#ae8556');
    }
    for (let i = 1; i < postOffsets.length; i++) {
      const z1 = center + postOffsets[i - 1] * halfSpan, z2 = center + postOffsets[i] * halfSpan;
      batch.link('log', [px, arch(z1) + 0.57, z1], [px, arch(z2) + 0.57, z2], 0.069, '#846341');
      batch.link('log', [px, arch(z1) + 0.36, z1], [px, arch(z2) + 0.36, z2], 0.026, '#795f40');
    }
  }
  for (const [z, sign] of [[north, -1], [south, 1]]) {
    batch.put('box', x, 0.058, z + sign * 0.23, width * 0.95, 0.123, 0.34, '#a38964');
  }
  return { x, north, south };
}

function buildWell(batch, random) {
  const x = -8.4, z = 1.62;
  const y = terrainHeight(x, z);
  batch.put('log', x, y + 0.095, z, 0.86, 0.19, 0.86, '#6d6d61');
  batch.put('log', x, y + 0.24, z, 0.60, 0.22, 0.60, '#383b30');
  batch.put('log', x, y + 0.36, z, 0.46, 0.018, 0.46, '#506d5f');
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 13; i++) {
      const angle = (i + (row % 2) * 0.5) / 13 * TAU;
      const r = row === 3 ? 0.72 : 0.66;
      batch.put('box', x + Math.sin(angle) * r, y + 0.20 + row * 0.17, z + Math.cos(angle) * r,
        0.315 + random() * 0.043, 0.153, row === 3 ? 0.32 : 0.26, pick(rocks, random),
        (random() - 0.5) * 0.09, angle, (random() - 0.5) * 0.055);
    }
  }
  for (const dx of [-0.74, 0.74]) {
    batch.put('box', x + dx, y + 1.55, z, 0.14, 1.68, 0.15, '#664931');
    batch.put('box', x + dx, y + 0.72, z, 0.22, 0.10, 0.25, '#888173');
    batch.put('box', x + dx, y + 1.98, z, 0.12, 0.11, 1.48, '#77593b');
    for (const dz of [-0.47, 0.47]) {
      batch.link('box', [x + dx, y + 1.55, z], [x + dx, y + 1.98, z + dz], 0.095, '#6c4d30');
      batch.link('box', [x + dx, y + 2.42, z], [x + dx, y + 1.94, z + Math.sign(dz) * 0.77], 0.104, '#795b3d');
    }
  }
  batch.link('log', [x - 0.84, y + 1.42, z], [x + 0.84, y + 1.42, z], 0.072, '#8b6946');
  batch.link('log', [x + 0.84, y + 1.42, z], [x + 0.84, y + 1.28, z + 0.18], 0.028, '#51493b');
  batch.link('log', [x + 0.84, y + 1.28, z + 0.18], [x + 0.97, y + 1.28, z + 0.18], 0.039, '#654830');
  batch.link('log', [x + 0.15, y + 1.49, z], [x + 0.15, y + 1.06, z + 0.04], 0.019, '#c1a377');
  for (const sign of [-1, 1]) {
    const angle = sign * Math.atan(0.48 / 0.72);
    for (let i = 0; i < 6; i++) {
      const dz = (i + 0.5) * 0.125;
      const level = y + 2.45 - dz * 0.667;
      for (let tile = 0; tile < 9; tile++) {
        const roofTone = ['#887052', '#765f44', '#937651', '#817052'];
        batch.put('box', x + (tile - 4) * 0.23 + (i % 2) * 0.035,
          level, z + sign * dz, 0.228, 0.053, 0.195, pick(roofTone, random), angle);
      }
    }
    for (const dx of [-1.045, 1.045]) {
      batch.link('box', [x + dx, y + 2.46, z], [x + dx, y + 1.94, z + sign * 0.79], 0.106, '#654c34');
    }
  }
  batch.put('box', x, y + 2.48, z, 2.19, 0.077, 0.14, '#725336');
  batch.put('log', x + 0.15, y + 0.85, z + 0.04, 0.15, 0.19, 0.15, '#a6794b');
  for (const py of [0.778, 0.91]) {
    batch.put('log', x + 0.15, y + py, z + 0.04, 0.158, 0.026, 0.158, '#5c5a50');
  }
  batch.put('log', x + 0.15, y + 0.949, z + 0.04, 0.128, 0.013, 0.128, '#534331');
  const bucketHandle = [];
  for (let i = 0; i <= 10; i++) {
    const a = i / 10 * Math.PI;
    bucketHandle.push([x + 0.15 + Math.cos(a) * 0.135, y + 0.94 + Math.sin(a) * 0.12, z + 0.04]);
  }
  for (let i = 1; i < bucketHandle.length; i++) {
    batch.link('log', bucketHandle[i - 1], bucketHandle[i], 0.011, '#685b45');
  }
}

function buildGarden(batch, random) {
  const gardenX = -10.15, gardenZ = -3.75;
  const postSpots = [];
  for (const x of [-12.60, -7.96]) {
    for (const z of [-6.55, -4.87, -3.19, -1.51]) postSpots.push([x, z]);
  }
  for (const z of [-6.55, -1.51]) {
    for (const x of [-11.04, -9.5]) postSpots.push([x, z]);
  }
  for (const [x, z] of postSpots) {
    const y = terrainHeight(x, z);
    batch.put('box', x, y + 0.39, z, 0.132, 0.8, 0.132, pick(wood, random), 0, (random() - 0.5) * 0.12);
    batch.put('box', x, y + 0.785, z, 0.15, 0.06, 0.15, '#aa8053', 0, 0.13);
  }
  for (const [ax, az] of postSpots) {
    for (const [bx, bz] of postSpots) {
      const aligned = (ax === bx && bz > az && bz - az < 1.72) || (az === bz && bx > ax && bx - ax < 1.6);
      if (!aligned || (az === -1.51 && ax === -9.5)) continue;
      for (const h of [0.275, 0.58]) {
        batch.link('box', [ax, terrainHeight(ax, az) + h, az], [bx, terrainHeight(bx, bz) + h, bz],
          0.105, pick(wood, random), 0.078);
      }
    }
  }
  for (const [i, dx] of [-1.61, 0, 1.49].entries()) {
    const x = gardenX + dx;
    const bottomZ = gardenZ + (i === 1 ? -0.3 : 0);
    const span = i === 1 ? 3.22 : 3.63;
    const width = i === 1 ? 1.2 : 1.11;
    const y = terrainHeight(x, bottomZ);
    batch.put('box', x, y + 0.11, bottomZ, width, 0.19, span, '#5d4634');
    for (const sign of [-1, 1]) {
      batch.put('box', x + sign * width * 0.52, y + 0.115, bottomZ, 0.075, 0.23, span + 0.12, '#8c6544');
      batch.put('box', x, y + 0.115, bottomZ + sign * span / 2, width + 0.13, 0.23, 0.078, '#986f4a');
    }
    for (let row = 0; row < 7; row++) {
      for (const side of [-1, 1]) {
        const px = x + side * 0.25 + (random() - 0.5) * 0.08;
        const zz = bottomZ + (row - 3) * 0.47 + (random() - 0.5) * 0.11;
        const soilY = y + 0.215;
        if (i === 0) {
          for (let leaf = 0; leaf < 6; leaf++) {
            const a = leaf * TAU / 6;
            const r = 0.098 + random() * 0.045;
            batch.put('pear', px + Math.sin(a) * r, soilY + 0.085, zz + Math.cos(a) * r,
              0.095, 0.049, 0.135, pick(herbs, random), 0.2, a);
          }
          batch.put('pear', px, soilY + 0.13, zz, 0.133, 0.13, 0.138, '#a4af6d');
        } else if (i === 1) {
          batch.put('onion', px, soilY, zz, 0.78, 0.8 + random() * 0.7, 0.78, pick(herbs, random), 0, random() * TAU);
          batch.put('bud', px, soilY, zz, 0.065, 0.13, 0.06, '#ce8d45');
        } else {
          const support = soilY + 0.83;
          batch.link('branch', [px, soilY, zz], [px + 0.03, support, zz + 0.03], 0.022, '#90704a');
          for (let j = 0; j < 4; j++) {
            const a = random() * TAU;
            const yy = soilY + j * 0.145 + 0.18;
            const dxLeaf = Math.cos(a) * 0.11, dzLeaf = Math.sin(a) * 0.12;
            batch.put('pear', px + dxLeaf, yy, zz + dzLeaf, 0.14, 0.039, 0.083,
              pick(herbs, random), (random() - 0.5), a);
            if (j % 2 === 0) batch.put('pear', px - dxLeaf * 0.57, yy - 0.035, zz - dzLeaf * 0.65,
              0.064, 0.066, 0.064, pick(['#b7593f', '#c77c3e', '#d57e4a'], random));
          }
        }
      }
    }
  }
}

function tree(batch, random, x, z, height, evergreen, distant) {
  const y = terrainHeight(x, z);
  batch.beginTree(x, z, y + height, height * (evergreen ? 0.24 : 0.32));
  const lean = (random() - 0.5) * height * 0.10;
  const width = height * (evergreen ? 0.035 : 0.048);
  const trunkColor = pick(bark, random);
  const rotation = random() * TAU;
  const base = [x, y - 0.09, z];
  const split = [x + lean * 0.3, y + height * 0.45, z + lean * 0.08];
  const top = [x + lean, y + height * (evergreen ? 0.96 : 0.86), z + lean * 0.28];
  batch.link(distant ? 'farLog' : 'trunk', base, split, width, trunkColor);
  batch.link(distant ? 'farLog' : 'trunk', split, top, width * 0.58, trunkColor);
  if (!distant) {
    for (let i = 0; i < 4; i++) {
      const a = (i + random() * 0.4) * TAU / 4;
      const rx = x + Math.cos(a) * width * (2 + random() * 1.6);
      const rz = z + Math.sin(a) * width * (2 + random() * 1.6);
      batch.link('branch', [x, y + width * 1.22, z], [rx, terrainHeight(rx, rz) - 0.04, rz], width * 0.42, trunkColor);
    }
  }
  if (evergreen) {
    const tierCount = distant ? 3 : 5;
    const taper = height * (0.20 + random() * 0.084);
    const baseY = 0.23 + random() * 0.10;
    const foliageColor = pick(pineDeep, random);
    for (let i = 0; i < tierCount; i++) {
      const progress = i / (tierCount - 1);
      const subY = y + height * (baseY + progress * (0.73 - baseY));
      const scale = 1 - progress * 0.63;
      const radius = taper * scale * (0.86 + random() * 0.18);
      const sway = (random() - 0.5) * radius * 0.18;
      batch.put(distant ? 'farPine' : 'pine', x + lean * progress + sway, subY, z + sway * 0.5,
        radius, height * (0.34 - progress * 0.06), radius * (0.89 + random() * 0.17),
        i >= tierCount - 2 ? pick(pineTip, random) : foliageColor, 0.06, rotation + i * 1.422, lean * 0.036);
    }
  } else {
    const crownColor = pick(canopy, random);
    const crownSize = height * (0.195 + random() * 0.059);
    for (let i = 0; i < (distant ? 3 : 6); i++) {
      const direction = rotation + i * 2.399963;
      const radius = crownSize * (0.61 + random() * 0.39);
      const side = crownSize * (i === 0 ? 0.15 : 0.7 + random() * 0.53);
      const ax = x + lean * 0.55 + Math.cos(direction) * side;
      const az = z + Math.sin(direction) * side;
      const ay = y + height * (i === 0 ? 0.91 : 0.61 + random() * 0.27);
      batch.link(distant ? 'farLog' : 'branch', split, [ax, ay, az], width * (0.28 + random() * 0.23), trunkColor);
      batch.put(distant ? 'distantFoliage' : 'foliage', ax, ay, az,
        radius, radius * (0.7 + random() * 0.29), radius * (0.83 + random() * 0.26),
        i < 2 ? crownColor : pick(canopy, random), (random() - 0.5) * 0.3, direction, lean * 0.02);
      if (!distant && i > 1) {
        batch.put('foliage', ax + Math.cos(direction) * radius * 0.67, ay + radius * 0.19,
          az + Math.sin(direction) * radius * 0.67, radius * 0.59, radius * 0.51, radius * 0.62,
          pick(canopy, random), 0.21, direction);
      }
    }
  }
  batch.endTree();
}

function plantForest(batch, random) {
  const arrangements = [
    [-13.4, 10.2, 13.3, false], [-14.4, 6.8, 10.7, true], [-17.8, 7.6, 15.5, true],
    [-11.8, 13.1, 8.1, true], [-16.4, 2.9, 12.3, false], [-14.9, -2.4, 10.9, true],
    [-12.4, -7.9, 11.4, false], [-10.2, -10.1, 10.6, true], [-7.8, -10.7, 13.5, true],
    [-5.0, -12.4, 11.7, false], [-2.0, -12.0, 10.8, true], [1.3, -11.4, 13.6, true],
    [3.3, -12.5, 11.3, false], [7.2, -11.0, 12.2, false], [9.5, -8.7, 10.7, true],
    [12.5, -6.2, 10.8, true], [14.0, -1.8, 10.7, false], [15.3, 1.5, 13.5, true],
    [17.2, 3.5, 12.1, false], [19.4, 8, 14.5, true], [19.5, 12, 12.5, false],
    [22.4, 16.5, 11.2, true], [-14.6, 16.9, 11.6, false], [-9.5, 21.8, 11.8, true],
    [-5.5, 24.4, 11.3, false], [1.0, 28.8, 10.1, true], [9, 32, 13.4, false],
    [17.0, 32, 10.7, true], [23, 23, 11.2, false]
  ];
  const locations = arrangements.map(([x, z]) => [x, z]);
  for (const [x, z, height, evergreen] of arrangements) tree(batch, random, x, z, height, evergreen, false);

  let planted = 0;
  for (let i = 0; i < 1300 && planted < 314; i++) {
    const x = (random() - 0.5) * 130;
    const z = (random() - 0.5) * 133;
    const clearFront = z > -8.3 && z < 23.1 && x > -11.6 && x < 18.5 + Math.max(0, z - 9) * 0.38;
    const clearBack = z > -11 && z < -4 && x > -11.5 && x < 11.8;
    if (clearFront || clearBack || Math.abs(z - creek(x)) < halfWidth(x) + 1.15) continue;
    const distant = Math.hypot(x, z) > 26;
    const minSpacing = distant ? 3.6 : 3.1;
    if (locations.some(([tx, tz]) => (tx - x) ** 2 + (tz - z) ** 2 < minSpacing ** 2)) continue;
    locations.push([x, z]);
    const height = 5.8 + random() * 7.4 + THREE.MathUtils.smoothstep(-z, 13, 37) * 1.8;
    tree(batch, random, x, z, height, random() < 0.68, distant);
    planted++;
  }
  return locations;
}

function buildStreamDetails(batch, random, bridge) {
  for (let i = 0; i < 263; i++) {
    const x = (random() - 0.5) * (i < 194 ? 48 : 144);
    const side = random() < 0.5 ? -1 : 1;
    const z = creek(x) + side * (halfWidth(x) + (random() - 0.25) * 1.42);
    if (Math.abs(x - bridge.x) < 1.2) continue;
    const large = random() < 0.15;
    const size = 0.10 + random() ** 1.7 * (large ? 0.87 : 0.37);
    const y = terrainHeight(x, z) + size * 0.04;
    batch.put(large ? 'stone' : 'stoneSmall', x, y, z, size * (1.05 + random() * 0.62),
      size * (0.52 + random() * 0.2), size, pick(rocks, random), 0.12, random() * TAU, -0.13);
    if (large) {
      batch.put('stoneSmall', x + size * 0.14, y + size * 0.49, z - size * 0.21,
        size * 0.73, size * 0.17, size * 0.63, pick(shrub, random), 0.11, random() * TAU);
    }
  }
  const clumps = [-19, -13.7, -6.8, -3.4, 3.5, 6.5, 10.3, 15.8, 19.4];
  for (const [i, cx] of clumps.entries()) {
    for (let j = 0; j < 15; j++) {
      const x = cx + (random() - 0.5) * 2.2;
      const z = creek(x) + (i % 2 ? 1 : -1) * (halfWidth(x) + 0.64 + random() * 0.49);
      const h = 0.22 + random() * 0.45;
      const y = terrainHeight(x, z);
      batch.put('onion', x, y, z, 0.74, 0.8 + random(), 0.8, pick(herbs, random), 0, random() * TAU);
      if (j > 6) continue;
      const dx = (random() - 0.5) * 0.21, dz = (random() - 0.5) * 0.17;
      batch.link('branch', [x, y, z], [x + dx, y + h, z + dz], 0.012, '#788a48');
      batch.put('pear', x + dx, y + h, z + dz, 0.028, 0.095, 0.028, '#765837', dz, 0, -dx);
    }
  }
}

function decorateGrounds(batch, random, paths, treePoints) {
  const coarseDistance = paths.map(({ curve }) => curve.getSpacedPoints(70));
  const isPath = (x, z, margin) => coarseDistance.some(points => points.some(point => (point.x - x) ** 2 + (point.z - z) ** 2 < margin ** 2));
  const occupied = (x, z) => (
    (x > -7.6 && x < -0.1 && z > -6.5 && z < 1.55) ||
    (x > 3.15 && x < 10.9 && z > -3.8 && z < 2.25) ||
    (x > -12.85 && x < -7.69 && z > -6.8 && z < -1.35) ||
    Math.hypot(x + 8.4, z - 1.62) < 1.15
  );

  for (const [index, { curve }] of paths.entries()) {
    const count = Math.round(curve.getLength() * 12);
    for (let i = 0; i < count; i++) {
      const t = random();
      const point = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const edge = (random() - 0.5) * (index === 0 ? 1.85 : 1.21);
      const x = point.x + tangent.z * edge, z = point.z - tangent.x * edge;
      if (Math.abs(z - creek(x)) < halfWidth(x) + 0.40 || occupied(x, z)) continue;
      const size = 0.02 + random() ** 3.2 * 0.095;
      batch.put('stoneSmall', x, terrainHeight(x, z) + 0.039, z, size * (1 + random()), size * 0.30,
        size, pick(['#b4a48a', '#a69a7d', '#c4b08a', '#8b8968'], random), 0, random() * TAU);
    }
  }

  for (let i = 0; i < 3150; i++) {
    const spread = i < 2590 ? 1 : 1.6;
    const x = (random() - 0.51) * 39 * spread;
    const z = (random() - 0.46) * 36 * spread;
    const shore = Math.abs(z - creek(x)) - halfWidth(x);
    if (shore < 0.39 || occupied(x, z) || isPath(x, z, 0.77)) continue;
    const patch = Math.sin(x * 1.77 + Math.cos(z)) * Math.cos(z * 1.29);
    if (random() < 0.07 + Math.max(0, patch) * 0.37) continue;
    const size = 0.44 + random() ** 1.4 * 1.42;
    const taller = shore < 1.05 || random() < 0.034;
    const tint = taller ? pick(herbs, random) : pick(shrub, random);
    batch.put(taller ? 'fern' : 'grass', x, terrainHeight(x, z) - 0.014, z,
      size, size * (taller ? 0.68 + random() * 0.55 : 1), size, tint, 0, random() * TAU);
  }

  const flowerBeds = [
    [-7.3, 3.25, 1], [-5.2, 4.49, 0], [-1.86, 3.83, 2], [-0.81, 4.95, 0],
    [2.3, 3.85, 1], [4.97, 4.17, 0], [7.35, 3.53, 1], [8.45, 3.25, 4], [10.3, 3.65, 0],
    [-9.5, 2.94, 3], [-12.2, 3.3, 0], [4.25, 10.85, 1], [6.68, 11.2, 0],
    [-2.84, 11.84, 1], [-5.05, 11.62, 0], [8.78, 13.64, 4], [-9.14, 12.1, 0],
    [10.63, 12.7, 2], [-10.36, -0.61, 4], [1.52, -2.55, 3], [1.91, -0.22, 0]
  ];
  for (const [cx, cz, index] of flowerBeds) {
    const count = 15 + Math.floor(random() * 21);
    for (let i = 0; i < count; i++) {
      const a = random() * TAU;
      const r = Math.sqrt(random()) * (0.57 + random() * 0.66);
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r * 0.59;
      if (Math.abs(z - creek(x)) < halfWidth(x) + 0.6 || occupied(x, z) || isPath(x, z, 0.55)) continue;
      const y = terrainHeight(x, z) - 0.01;
      const height = 0.09 + random() * 0.29;
      batch.put('grass', x, y, z, 0.46, 0.73, 0.46, pick(herbs, random), 0, a);
      batch.link('branch', [x, y, z], [x + 0.039, y + height, z + 0.017], 0.009, '#778850');
      const blossom = 0.032 + random() * 0.027;
      const tint = random() < 0.82 ? petals[index] : pick(petals, random);
      batch.put('blossom', x + 0.039, y + height, z + 0.017,
        blossom, blossom * 1.12, blossom, tint, 0.19 * Math.cos(a), a, 0.19 * Math.sin(a));
      batch.put('bud', x + 0.039, y + height + blossom * 0.14, z + 0.017, blossom * 0.48,
        blossom * 0.53, blossom * 0.48, index === 1 ? '#a57744' : '#d9a95a');
    }
  }

  for (const [tx, tz] of treePoints) {
    if (Math.hypot(tx, tz) > 44) continue;
    for (let i = 0; i < 4; i++) {
      const a = random() * TAU;
      const size = 0.43 + random() * 0.7;
      const x = tx + Math.cos(a) * (0.57 + random() * 2.2);
      const z = tz + Math.sin(a) * (0.57 + random() * 2.2);
      if (Math.abs(z - creek(x)) < halfWidth(x) + 0.85 || occupied(x, z) || isPath(x, z, 0.85)) continue;
      batch.put('foliage', x, terrainHeight(x, z) + size * 0.43, z,
        size * 1.14, size * 0.72, size * 0.94, pick(canopy, random), 0.15, a);
      batch.put('distantFoliage', x + size * 0.4, terrainHeight(x, z) + size * 0.60, z + size * 0.14,
        size * 0.72, size * 0.49, size * 0.59, pick(shrub, random), 0.15, a);
    }
  }

  for (let i = 0; i < 90; i++) {
    const x = (random() - 0.5) * 44, z = (random() - 0.5) * 37;
    if (Math.abs(z - creek(x)) < halfWidth(x) + 0.78 || occupied(x, z) || isPath(x, z, 0.7)) continue;
    const size = 0.12 + random() ** 3 * 0.63;
    batch.put(size > 0.3 ? 'stone' : 'stoneSmall', x, terrainHeight(x, z) + size * 0.11, z,
      size * 1.29, size * 0.55, size, pick(rocks, random), -0.17, random() * TAU);
  }
}

export function createGrounds() {
  const group = new THREE.Group();
  group.name = 'Willowbrook clearing and forest';
  const random = randomSource(720311);
  const focus = { value: new THREE.Vector3(0, 2.2, 0.6) };
  const clearance = { value: 5.5 };
  const batch = instancing(group, random, focus, clearance);
  const river = makeCreek();
  group.add(makeTerrain(), river.mesh);

  const bridge = buildBridge(batch, random);
  const paths = [
    pathGeometry([[bridge.x, bridge.south + 0.08], [1.72, 11.7], [3.85, 13.6], [5.30, 16.05], [4.58, 18.92], [2.08, 23.8], [0.57, 28.6]], 1.73, 2.25, random),
    pathGeometry([[bridge.x, bridge.north - 0.04], [0.35, 3.94], [-1.99, 3.07], [-3.68, 2.42], [-3.8, 1.06]], 1.53, 1.36, random),
    pathGeometry([[-0.63, 3.45], [1.95, 3.1], [4.57, 2.84], [6.10, 2.75], [6.10, 1.76]], 1.33, 1.42, random),
    pathGeometry([[-3.64, 2.37], [-5.29, 2.13], [-7.04, 2.25], [-8.31, 1.98], [-9.22, 0.37], [-8.79, -1.62]], 1.02, 0.75, random)
  ];
  const gravel = soilMaterial(0.36, true);
  for (const { geometry } of paths) {
    const path = new THREE.Mesh(geometry, gravel);
    path.name = 'Curving dirt footpath';
    path.receiveShadow = true;
    group.add(path);
  }

  buildGarden(batch, random);
  buildWell(batch, random);
  buildStreamDetails(batch, random, bridge);
  const forest = plantForest(batch, random);
  decorateGrounds(batch, random, paths, forest);
  batch.flush();

  return {
    group,
    setViewTarget(target, radius = 5.5) {
      focus.value.copy(target);
      clearance.value = radius;
    },
    update(time) {
      river.time.value = time;
    }
  };
}

