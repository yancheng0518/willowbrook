import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const { BoxGeometry, CylinderGeometry, LatheGeometry, SphereGeometry, TorusGeometry, Vector2, Vector3 } = THREE;

function finishGeometry(group, batches) {
  for (const [material, parts] of batches) {
    const geometry = mergeGeometries(parts);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    for (const part of parts) part.dispose();
  }
}

function lampHalo() {
  const size = 48;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5) * 2;
      const index = (x + y * size) * 4;
      pixels.set([255, 230, 188, Math.round(255 * Math.pow(Math.max(0, 1 - radius), 3.2))], index);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function createPavilion() {
  const group = new THREE.Group();
  group.name = '木亭和育苗工作区';
  const batches = new Map();
  const transform = new THREE.Object3D();
  const materials = new Map();
  let seed = 11453;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  function material(color, roughness = 0.83, metalness = 0) {
    const key = [color, roughness, metalness].join('/');
    if (!materials.has(key)) {
      materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    }
    return materials.get(key);
  }

  function piece(geometry, surface, x, y, z, rx = 0, ry = 0, rz = 0) {
    transform.position.set(x, y, z);
    transform.rotation.set(rx, ry, rz);
    transform.updateMatrix();
    geometry.applyMatrix4(transform.matrix);
    if (!batches.has(surface)) batches.set(surface, []);
    batches.get(surface).push(geometry);
    return geometry;
  }

  const timber = material(0x744628);
  const darkTimber = material(0x563623);
  const cutWood = material(0xa67142);
  const grain = material(0x8c5a35);
  const stones = [0x9a9080, 0x85776b, 0xab9c87, 0x716e62].map(color => material(color));
  const boards = [0x8a6039, 0x9b6c45, 0xa77a4d, 0xb08052].map(color => material(color));
  const cedar = [0x8d6e46, 0x9c7a50, 0xa88255, 0xb08c5d, 0x947853].map(color => material(color));
  const bronze = material(0x604931, 0.52, 0.42);
  const iron = material(0x424740, 0.65, 0.29);
  const ceramic = material(0x729093, 0.32);
  const porcelain = material(0xe8d8a3, 0.37);
  const clay = material(0xb16c4a);
  const moss = material(0x626043);
  const soil = material(0x463629);
  const foliage = [0x4e6435, 0x708347, 0x819252, 0x9b993f].map(color => material(color));
  const petals = [0xe4bdb2, 0xeccd8a, 0xba765e, 0xc3b091].map(color => material(color));
  const fabric = material(0x984f43);
  const thread = material(0xf0d9b4);
  const tea = material(0x906042, 0.22);

  const box = (surface, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) =>
    piece(new BoxGeometry(sx, sy, sz), surface, x, y, z, rx, ry, rz);
  const dowel = (surface, x, y, z, r1, r2, length, sides = 8, rx = 0, ry = 0, rz = 0) =>
    piece(new CylinderGeometry(r1, r2, length, sides), surface, x, y, z, rx, ry, rz);
  const oval = (surface, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) =>
    piece(new SphereGeometry(1, 7, 4).scale(sx, sy, sz), surface, x, y, z, rx, ry, rz);
  const ring = (surface, x, y, z, radius, thickness, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2) =>
    piece(new TorusGeometry(radius, thickness, 5, 14, arc), surface, x, y, z, rx, ry, rz);
  const turned = (surface, x, y, z, profile) =>
    piece(new LatheGeometry(profile.map(point => new Vector2(...point)), 14), surface, x, y, z);

  function beam(surface, start, end, width, depth = width, round = false) {
    const a = new Vector3(...start);
    const b = new Vector3(...end);
    const axis = b.clone().sub(a);
    const middle = a.addScaledVector(axis, 0.5);
    const block = round
      ? new CylinderGeometry(width / 2, width / 2, axis.length(), 7)
      : new BoxGeometry(width, axis.length(), depth);
    transform.position.copy(middle);
    transform.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), axis.normalize());
    transform.updateMatrix();
    block.applyMatrix4(transform.matrix);
    if (!batches.has(surface)) batches.set(surface, []);
    batches.get(surface).push(block);
  }

  // Stone apron and individually laid floorboards.
  const floor = 0.265;
  box(stones[1], 0, 0.05, 0, 4.88, 0.10, 4.08);
  box(darkTimber, 0, 0.145, 0, 4.84, 0.145, 4.03);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      box(stones[(i + 1) % stones.length], -2.13 + i * 0.53, 0.061, side * 2.025, 0.505, 0.12, 0.14);
    }
    for (let i = 0; i < 8; i++) {
      box(stones[i % stones.length], side * 2.43, 0.061, -1.81 + i * 0.514, 0.13, 0.12, 0.491);
    }
  }
  for (let i = 0; i < 14; i++) {
    const x = (i - 6.5) * 0.345;
    box(boards[i % boards.length], x, floor - 0.036, 0, 0.331, 0.072, 4.09);
    for (const z of [-1.96, 1.96]) {
      dowel(darkTimber, x - 0.095, floor + 0.0005, z, 0.012, 0.012, 0.004, 6);
    }
  }
  box(stones[0], 0, 0.051, 2.35, 1.47, 0.102, 0.36);
  box(stones[2], 0, 0.096, 2.157, 1.63, 0.192, 0.37);
  box(stones[3], -0.73, 0.017, 2.64, 0.46, 0.034, 0.30, 0, 0.18);
  box(stones[0], 0.69, 0.021, 2.68, 0.41, 0.042, 0.26, 0, -0.12);

  const postX = 2.11;
  const postZ = 1.72;
  const beamY = 2.74;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * postX;
      const z = sz * postZ;
      box(stones[0], x, floor + 0.065, z, 0.39, 0.13, 0.39);
      box(stones[2], x, floor + 0.162, z, 0.32, 0.064, 0.32);
      box(timber, x, (floor + 0.194 + beamY) / 2, z, 0.228, beamY - floor - 0.194, 0.228);
      box(darkTimber, x, floor + 0.236, z, 0.264, 0.07, 0.264);
      for (const side of [-1, 1]) {
        for (let i = 0; i < 2; i++) {
          box(grain, x + side * 0.115, 1.37 + i * 0.53, z - 0.043 + i * 0.116, 0.003, 0.41 - i * 0.12, 0.009);
        }
      }
      beam(timber, [x, 1.99, z], [x - sx * 0.67, beamY - 0.035, z], 0.138, 0.15);
      beam(timber, [x, 1.99, z], [x, beamY - 0.035, z - sz * 0.67], 0.15, 0.138);
      dowel(darkTimber, x + sx * 0.117, 2.08, z, 0.031, 0.031, 0.012, 10, 0, 0, Math.PI / 2);
      dowel(darkTimber, x, 2.08, z + sz * 0.117, 0.031, 0.031, 0.012, 10, Math.PI / 2);
    }
    box(darkTimber, sx * postX, beamY, 0, 0.21, 0.23, 4.3);
    box(cutWood, sx * postX, beamY + 0.139, 0, 0.275, 0.051, 4.31);
    box(timber, 0, beamY, sx * postZ, 4.55, 0.216, 0.224);
  }

  // The front stays open. Side-rail ends meet the main columns and the rear rail.
  const railHigh = floor + 0.74;
  const railLow = floor + 0.17;
  for (const side of [-1, 1]) {
    const x = postX * side;
    box(darkTimber, x, railHigh, 0, 0.147, 0.118, postZ * 2);
    box(cutWood, x, railHigh + 0.068, 0, 0.177, 0.04, postZ * 2);
    box(timber, x, railLow, 0, 0.116, 0.104, postZ * 2);
    for (let i = 1; i < 9; i++) {
      box(i % 2 ? timber : grain, x, (railHigh + railLow) / 2, -postZ + i * postZ * 2 / 9, 0.078, railHigh - railLow, 0.074, 0, i % 2 ? Math.PI / 4 : 0);
    }
  }
  box(darkTimber, 0, railHigh, -postZ, postX * 2, 0.117, 0.148);
  box(cutWood, 0, railHigh + 0.068, -postZ, postX * 2, 0.04, 0.177);
  box(timber, 0, railLow, -postZ, postX * 2, 0.105, 0.115);
  for (let i = 1; i < 11; i++) {
    box(timber, -postX + i * postX * 2 / 11, (railHigh + railLow) / 2, -postZ, 0.076, railHigh - railLow, 0.076, 0, i % 2 ? Math.PI / 4 : 0);
  }
  box(timber, 0, floor + 0.406, -postZ, 0.121, 0.812, 0.138);
  box(cutWood, 0, railHigh + 0.101, -postZ, 0.187, 0.032, 0.19);

  // A gabled cedar roof with staggered, overlapping shingles and visible rafters.
  const roofEdge = 2.59;
  const roofPeak = 4.14;
  const roofDrop = 1.30;
  const pitch = Math.atan(roofDrop / roofEdge);
  const roofWidth = Math.hypot(roofEdge, roofDrop);
  box(darkTimber, 0, roofPeak - 0.11, 0, 0.19, 0.24, 4.66);
  for (const z of [-2.21, -1.72, -0.85, 0, 0.85, 1.72, 2.21]) {
    for (const side of [-1, 1]) {
      beam(timber, [0, roofPeak - 0.13, z], [side * 2.58, roofPeak - roofDrop - 0.13, z], 0.132, 0.107);
    }
  }
  for (const z of [-postZ, postZ]) {
    beam(darkTimber, [0, beamY + 0.05, z], [0, roofPeak - 0.12, z], 0.141);
    for (const side of [-1, 1]) {
      beam(timber, [0, beamY + 0.235, z], [side * 1.23, 3.41, z], 0.117, 0.117);
    }
  }
  for (const side of [-1, 1]) {
    box(darkTimber, side * roofEdge / 2, roofPeak - roofDrop / 2 - 0.035, 0, roofWidth, 0.09, 4.55, 0, 0, -side * pitch);
    for (let row = 0; row < 8; row++) {
      const x = (row + 0.5) * roofEdge / 8;
      const lift = 0.03 + 0.004 * row;
      const offset = row % 2 ? 0.18 : 0;
      for (let column = -7; column <= 7; column++) {
        const start = Math.max(-2.29, column * 0.355 + offset - 0.178);
        const end = Math.min(2.29, column * 0.355 + offset + 0.17);
        if (end <= start) continue;
        box(cedar[Math.floor(random() * cedar.length)], side * x, roofPeak - roofDrop * x / roofEdge + lift, (start + end) / 2,
          roofWidth / 8 + 0.085, 0.054 + random() * 0.008, end - start, 0, 0, -side * (pitch + 0.035));
      }
    }
    box(cutWood, side * 2.61, roofPeak - roofDrop - 0.014, 0, 0.085, 0.145, 4.66);
    for (const z of [-2.325, 2.325]) {
      beam(darkTimber, [0, roofPeak + 0.055, z], [side * 2.64, roofPeak - roofDrop - 0.015, z], 0.124, 0.105);
      beam(cutWood, [0, roofPeak + 0.076, z + Math.sign(z) * 0.062], [side * 2.63, roofPeak - roofDrop + 0.008, z + Math.sign(z) * 0.062], 0.062, 0.045);
    }
  }
  for (let i = 0; i < 13; i++) {
    const z = (i - 6) * 0.352;
    box(cedar[i % cedar.length], 0, roofPeak + 0.078, z, 0.227, 0.089, 0.352, 0, 0, 0.052);
  }

  const tableTop = floor + 0.88;
  for (const x of [-0.36, 0.36]) {
    for (const z of [-0.74, 0.74]) {
      box(darkTimber, x, floor + 0.41, z, 0.12, 0.82, 0.13);
    }
    box(timber, x, tableTop - 0.125, 0, 0.088, 0.158, 1.69);
  }
  for (const z of [-0.74, 0.74]) box(timber, 0, tableTop - 0.127, z, 0.78, 0.159, 0.092);
  for (let i = 0; i < 5; i++) {
    box(boards[(i + 1) % boards.length], (i - 2) * 0.208, tableTop - 0.04, 0, 0.202, 0.08, 2.03);
  }
  for (const x of [-0.94, 0.94]) {
    for (const z of [-0.69, 0.69]) box(timber, x, floor + 0.207, z, 0.129, 0.414, 0.15);
    box(darkTimber, x, floor + 0.156, 0, 0.093, 0.087, 1.45);
    for (const shift of [-0.082, 0.082]) box(boards[2], x + shift, floor + 0.43, 0, 0.157, 0.075, 1.82);
  }

  // A woven, fringed runner follows the tabletop and folds over both ends.
  const runner = 0.45;
  box(fabric, 0.035, tableTop + 0.008, 0, runner, 0.015, 2.03);
  for (const z of [-1.022, 1.022]) {
    box(fabric, 0.035, tableTop - 0.082, z, runner, 0.179, 0.015);
    for (let i = 0; i < 12; i++) {
      box(thread, -0.165 + i * 0.036, tableTop - 0.18, z, 0.009, 0.031, 0.011, 0, 0, (random() - 0.5) * 0.25);
    }
  }
  for (const x of [-0.153, 0.224]) {
    box(thread, x, tableTop + 0.016, 0, 0.023, 0.007, 2.037);
    for (const z of [-1.031, 1.031]) box(thread, x, tableTop - 0.083, z, 0.023, 0.172, 0.006);
  }

  const setting = tableTop + 0.017;
  turned(ceramic, -0.225, setting, 0.31, [[0, 0], [0.078, 0], [0.111, 0.05], [0.12, 0.126], [0.092, 0.174], [0.064, 0.185], [0, 0.185]]);
  oval(ceramic, -0.225, setting + 0.189, 0.31, 0.067, 0.018, 0.067);
  oval(porcelain, -0.225, setting + 0.214, 0.31, 0.023, 0.014, 0.023);
  beam(ceramic, [-0.14, setting + 0.091, 0.33], [-0.057, setting + 0.149, 0.362], 0.064, 0.064, true);
  beam(ceramic, [-0.06, setting + 0.143, 0.361], [-0.018, setting + 0.187, 0.377], 0.047, 0.047, true);
  ring(ceramic, -0.333, setting + 0.116, 0.306, 0.063, 0.013);

  for (const [x, z] of [[0.275, 0.48], [-0.305, 0.74], [0.305, -0.46]]) {
    dowel(porcelain, x, tableTop + 0.015, z, 0.085, 0.062, 0.016, 14);
    turned(porcelain, x, tableTop + 0.022, z, [[0, 0], [0.039, 0], [0.055, 0.061], [0.048, 0.061], [0.034, 0.012], [0, 0.012]]);
    dowel(tea, x, tableTop + 0.073, z, 0.046, 0.045, 0.007, 12);
    ring(porcelain, x + Math.sign(x) * 0.057, tableTop + 0.057, z, 0.022, 0.007);
  }
  turned(porcelain, 0.06, setting, 0.715, [[0, 0], [0.12, 0], [0.17, 0.048], [0.158, 0.050], [0.102, 0.014], [0, 0.014]]);
  const apples = [0xb56a4b, 0xc59745, 0x9a9c49].map(color => material(color, 0.57));
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 0.4;
    const x = 0.06 + Math.cos(angle) * 0.078;
    const z = 0.715 + Math.sin(angle) * 0.077;
    oval(apples[i % apples.length], x, setting + 0.065, z, 0.044, 0.044, 0.044);
    beam(darkTimber, [x, setting + 0.098, z], [x + 0.006, setting + 0.121, z + 0.007], 0.008, 0.008, true);
  }

  function sprig(x, base, z, height, color, spread, index) {
    const tipX = x + Math.cos(index * 2.1) * spread;
    const tipZ = z + Math.sin(index * 2.1) * spread;
    beam(foliage[1], [x, base, z], [tipX, base + height, tipZ], 0.016, 0.016, true);
    for (const side of [-1, 1]) {
      oval(foliage[(index + 1) % foliage.length], x + side * height * 0.13, base + height * (0.32 + 0.23 * (side + 1) / 2), z,
        height * 0.214, height * 0.058, height * 0.106, 0, 0, side * 0.56);
    }
    if (!color) return;
    const size = height * 0.152;
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      oval(color, tipX + Math.cos(angle) * size, base + height + 0.015, tipZ + Math.sin(angle) * size,
        size * 0.87, size * 0.39, size * 0.7, 0.42, -angle, 0.12);
    }
    oval(petals[1], tipX, base + height + 0.025, tipZ, size * 0.66, size * 0.45, size * 0.66);
  }

  const vaseX = -0.34;
  const vaseZ = -0.38;
  turned(ceramic, vaseX, tableTop, vaseZ, [[0, 0], [0.068, 0], [0.084, 0.052], [0.078, 0.127], [0.045, 0.165], [0.045, 0.199], [0.052, 0.208], [0.036, 0.208], [0.036, 0.147], [0, 0.13]]);
  for (let i = 0; i < 6; i++) sprig(vaseX, tableTop + 0.155, vaseZ, 0.20 + random() * 0.13, petals[i % 3], 0.109, i);

  // Planters sit outside the footprint, on short skids below the cedar boards.
  for (const x of [-2.93, 2.93]) {
    const z = 0.12;
    for (const end of [-0.71, 0.71]) box(stones[3], x, 0.052, z + end, 0.59, 0.104, 0.22);
    box(darkTimber, x, 0.12, z, 0.60, 0.081, 1.82);
    for (const side of [-1, 1]) {
      box(timber, x + side * 0.268, 0.258, z, 0.085, 0.285, 1.82);
      box(cutWood, x + side * 0.268, 0.414, z, 0.106, 0.046, 1.85);
      box(timber, x, 0.257, z + side * 0.871, 0.478, 0.285, 0.085);
      box(cutWood, x, 0.414, z + side * 0.871, 0.49, 0.046, 0.104);
      for (const end of [-0.79, 0.79]) box(iron, x + side * 0.314, 0.253, z + end, 0.012, 0.236, 0.033);
    }
    box(soil, x, 0.343, z, 0.47, 0.096, 1.655);
    for (let i = 0; i < 15; i++) {
      const px = x + (random() - 0.5) * 0.33;
      sprig(px, 0.381, z + (i - 7) * 0.106, 0.18 + random() * 0.22,
        i % 4 === 0 ? null : petals[(i + (x < 0 ? 1 : 2)) % petals.length], 0.07, i);
    }
  }

  // Potting table beyond the side rail and clear of the planter.
  const benchX = 3.49;
  const benchZ = -2.53;
  const workTop = 0.85;
  for (const dx of [-0.58, 0.58]) {
    for (const dz of [-0.242, 0.242]) box(timber, benchX + dx, 0.406, benchZ + dz, 0.104, 0.812, 0.106);
    box(darkTimber, benchX + dx, 0.197, benchZ, 0.096, 0.092, 0.57);
  }
  for (let i = 0; i < 4; i++) {
    box(boards[i], benchX, workTop - 0.031, benchZ + (i - 1.5) * 0.171, 1.45, 0.062, 0.161);
    box(boards[(i + 1) % boards.length], benchX, 0.262, benchZ + (i - 1.5) * 0.132, 1.26, 0.057, 0.115);
  }
  box(darkTimber, benchX, 0.745, benchZ + 0.266, 1.33, 0.113, 0.067);
  box(grain, benchX, 0.945, benchZ - 0.311, 1.45, 0.19, 0.064);

  function flowerpot(x, y, z, scale, surface, plant) {
    const profile = [[0, 0], [0.1, 0], [0.145, 0.19], [0.154, 0.19], [0.154, 0.227], [0.122, 0.227], [0.116, 0.043], [0, 0.043]];
    turned(surface, x, y, z, profile.map(([r, h]) => [r * scale, h * scale]));
    if (!plant) return;
    dowel(soil, x, y + 0.18 * scale, z, 0.121 * scale, 0.109 * scale, 0.034 * scale, 12);
    for (let i = 0; i < 5; i++) {
      sprig(x + (i % 2) * 0.025 * scale, y + 0.19 * scale, z, (0.20 + random() * 0.17) * scale, i % 3 ? null : plant, 0.12 * scale, i);
    }
  }

  flowerpot(benchX - 0.49, workTop, benchZ - 0.08, 1, clay, petals[1]);
  flowerpot(benchX - 0.139, workTop, benchZ + 0.077, 0.72, clay, null);
  flowerpot(benchX - 0.333, 0.291, benchZ, 0.88, clay, null);
  flowerpot(benchX + 0.263, 0.291, benchZ, 1, ceramic, null);
  flowerpot(benchX - 0.57, 0, benchZ - 0.61, 1.28, clay, petals[0]);
  flowerpot(benchX - 0.94, 0, benchZ - 0.6, 1, moss, petals[2]);
  const paper = material(0xd0ae78);
  const printedLabel = material(0xe0cc9a);
  const printedSeed = material(0x828759);
  for (let i = 0; i < 3; i++) {
    const x = benchX + 0.17 + i * 0.185;
    box(paper, x, workTop + 0.094, benchZ + 0.022 * i, 0.126, 0.175, 0.034, -0.13, 0, 0.08 * i);
    box(printedLabel, x - 0.003, workTop + 0.103, benchZ + 0.022 * i + 0.018, 0.096, 0.082, 0.008, -0.13, 0, 0.08 * i);
    oval(printedSeed, x, workTop + 0.105, benchZ + 0.022 * i + 0.025, 0.026, 0.021, 0.005, 0, 0, 0.48);
  }

  // Rake and spade lean against the worktop with their heads at ground height.
  const rakeX = benchX + 0.76;
  const rakeZ = benchZ + 0.278;
  beam(cutWood, [rakeX, 0.124, rakeZ + 0.05], [rakeX - 0.20, 1.12, rakeZ - 0.215], 0.039, 0.039, true);
  box(iron, rakeX, 0.105, rakeZ + 0.05, 0.28, 0.026, 0.032, 0, 0.15);
  for (let i = 0; i < 7; i++) box(iron, rakeX + (i - 3) * 0.04, 0.064, rakeZ + 0.050 - (i - 3) * 0.006, 0.014, 0.088, 0.019, -0.31);
  const spadeX = benchX + 0.405;
  const spadeZ = benchZ + 0.412;
  beam(cutWood, [spadeX, 0.15, spadeZ + 0.008], [spadeX + 0.13, 0.944, spadeZ - 0.235], 0.045, 0.045, true);
  oval(iron, spadeX, 0.103, spadeZ + 0.017, 0.101, 0.102, 0.022, -0.26);
  ring(iron, spadeX + 0.133, 0.982, spadeZ - 0.247, 0.051, 0.013, -0.29, 0, -0.16);

  const lanternX = 0.064;
  const lanternZ = -0.15;
  const lanternBase = setting;
  turned(bronze, lanternX, lanternBase, lanternZ, [[0, 0], [0.107, 0], [0.119, 0.027], [0.111, 0.059], [0.083, 0.102], [0.073, 0.113], [0.079, 0.134], [0, 0.134]]);
  dowel(bronze, lanternX, lanternBase + 0.141, lanternZ, 0.086, 0.086, 0.019, 14);
  dowel(bronze, lanternX, lanternBase + 0.354, lanternZ, 0.071, 0.061, 0.039, 14);
  dowel(iron, lanternX, lanternBase + 0.385, lanternZ, 0.055, 0.064, 0.024, 12);
  beam(darkTimber, [lanternX, lanternBase + 0.147, lanternZ], [lanternX, lanternBase + 0.182, lanternZ], 0.021, 0.021);
  for (const x of [-0.084, 0.084]) {
    beam(bronze, [lanternX + x, lanternBase + 0.103, lanternZ], [lanternX + x * 0.72, lanternBase + 0.368, lanternZ], 0.012, 0.012, true);
  }
  ring(bronze, lanternX, lanternBase + 0.388, lanternZ, 0.073, 0.011, 0, 0.27, 0, Math.PI);
  const glassProfile = [[0.066, 0.143], [0.078, 0.185], [0.079, 0.223], [0.060, 0.281], [0.053, 0.331], [0.057, 0.347]];
  const glass = new THREE.Mesh(
    new LatheGeometry(glassProfile.map(point => new Vector2(...point)), 20),
    new THREE.MeshStandardMaterial({ color: 0xffdcac, metalness: 0.02, roughness: 0.19, transparent: true, opacity: 0.30, depthWrite: false, side: THREE.DoubleSide }),
  );
  glass.position.set(lanternX, lanternBase, lanternZ);
  glass.renderOrder = 1;
  group.add(glass);

  const flame = new THREE.Mesh(
    new SphereGeometry(1, 10, 6).scale(0.024, 0.068, 0.019),
    new THREE.MeshBasicMaterial({ color: 0xffe2a1, transparent: true, depthWrite: false }),
  );
  flame.position.set(lanternX, lanternBase + 0.224, lanternZ);
  flame.rotation.z = -0.16;
  group.add(flame);

  const lanternPower = 4.8;
  const light = new THREE.PointLight(0xffb064, lanternPower, 2.9, 2);
  light.position.set(lanternX, lanternBase + 0.27, lanternZ);
  group.add(light);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lampHalo(), color: 0xffae67, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.scale.set(0.78, 0.78, 1);
  glow.position.copy(flame.position);
  glow.renderOrder = 2;
  group.add(glow);
  finishGeometry(group, batches);

  function setLight(value) {
    const level = THREE.MathUtils.clamp(value, 0, 1);
    flame.visible = level > 0.001;
    glow.visible = flame.visible;
    flame.material.opacity = level;
    glow.material.opacity = level * 0.83;
    light.intensity = level * lanternPower;
    glass.material.emissive.setHex(0xff9a4f);
    glass.material.emissiveIntensity = level * 0.13;
  }

  setLight(1);
  return { group, setLight };
}
