import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const WIDTH = 6.9;
const DEPTH = 5.32;
const BASE = .64;
const WALL_TOP = 4.04;
const HALF_WIDTH = WIDTH / 2;
const HALF_DEPTH = DEPTH / 2;
const RIDGE = 6.20;
const SLOPE = .686;
const EAVE = 3.22;

function material(color, roughness = .86, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function randomizer(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

function roofHeight(z) {
  return RIDGE - SLOPE * Math.abs(z);
}

export function createCottage() {
  const group = new THREE.Group();
  group.name = 'Timber cottage';
  const random = randomizer(72651);
  const choose = (options) => options[Math.floor(random() * options.length)];
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sphereGeometry = new THREE.IcosahedronGeometry(1, 1);
  const tubeGeometry = new THREE.CylinderGeometry(1, 1, 1, 10);
  const timber = material('#4d3429');
  const trim = material('#6b4a35');
  const wornWood = material('#886047');
  const endGrain = material('#ba956a');
  const boards = ['#72533d', '#805b40', '#91674a', '#795a46'].map((color) => material(color));
  const plaster = material('#e5d3a8');
  const plasterShade = material('#d8c393');
  const mortar = material('#786e61');
  const stones = ['#898071', '#a4967e', '#b1a389', '#797267', '#938c7e'].map((color) => material(color));
  const tiles = ['#8f4d39', '#a85840', '#9c4a35', '#b86548', '#aa5944', '#9e5440', '#bf7253'].map((color) => material(color));
  const roofShadow = material('#5f372b');
  const brick = ['#9e674f', '#aa7157', '#8b5b49', '#bb8369'].map((color) => material(color));
  const iron = material('#393a36', .42, .58);
  const copper = material('#746047', .55, .42);
  const brass = material('#af8152', .38, .55);
  const shutter = material('#3f5542');
  const shutterTrim = material('#59694f');
  const terracotta = material('#ae6d54');
  const dirt = material('#4a3928');
  const foliage = ['#4e6835', '#647d3e', '#82954b'].map((color) => material(color));
  const petals = ['#c6705f', '#dbc385', '#a85670', '#f0ddbf'].map((color) => material(color));
  const glazing = [
    new THREE.MeshStandardMaterial({ roughness: .24 }),
    new THREE.MeshStandardMaterial({ roughness: .33 }),
  ];
  const lampGlass = new THREE.MeshStandardMaterial({ roughness: .25 });
  const batches = new Map();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const axis = new THREE.Vector3(0, 1, 0);

  function part(geometry, surface, p, size, rotation, origin) {
    quaternion.setFromEuler(new THREE.Euler(...rotation));
    position.set(...p);
    if (origin) {
      position.applyAxisAngle(axis, origin.angle).add(origin.position);
      quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, origin.angle));
    }
    matrix.compose(position, quaternion, scale.set(...size));
    const transformed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    transformed.deleteAttribute('uv');
    transformed.applyMatrix4(matrix);
    if (!batches.has(surface)) batches.set(surface, []);
    batches.get(surface).push(transformed);
  }

  function box(x, y, z, w, h, d, surface, rotation = [0, 0, 0], origin) {
    part(boxGeometry, surface, [x, y, z], [w, h, d], rotation, origin);
  }

  function cylinder(x, y, z, r, height, surface, rotation = [0, 0, 0], origin, stretch = 1) {
    part(tubeGeometry, surface, [x, y, z], [r, height, r * stretch], rotation, origin);
  }

  function ball(x, y, z, sx, sy, sz, surface) {
    part(sphereGeometry, surface, [x, y, z], [sx, sy, sz], [0, random() * Math.PI, 0]);
  }

  function beam(start, end, width, depth, surface, origin) {
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    const center = a.clone().lerp(b, .5);
    quaternion.setFromUnitVectors(axis, b.sub(a).normalize());
    const rotation = new THREE.Euler().setFromQuaternion(quaternion);
    box(center.x, center.y, center.z, width, center.distanceTo(a) * 2, depth, surface, [rotation.x, rotation.y, rotation.z], origin);
  }

  function face(x, z, angle) {
    return { position: new THREE.Vector3(x, 0, z), angle };
  }

  function wallBlock(x, y, w, h, origin, surface = plaster) {
    box(x, y, -.064, w, h, .13, surface, undefined, origin);
  }

  function wall(width, openings, origin) {
    let edge = -width / 2;
    for (const { x, w, bottom, top } of openings) {
      const start = x - w / 2;
      const gap = start - edge;
      if (gap > .001) wallBlock(edge + gap / 2, (BASE + WALL_TOP) / 2, gap, WALL_TOP - BASE, origin);
      if (bottom > BASE) wallBlock(x, (BASE + bottom) / 2, w, bottom - BASE, origin, plasterShade);
      wallBlock(x, (top + WALL_TOP) / 2, w, WALL_TOP - top, origin);
      edge = x + w / 2;
    }
    if (edge < width / 2) wallBlock((edge + width / 2) / 2, (BASE + WALL_TOP) / 2, width / 2 - edge, WALL_TOP - BASE, origin);
  }

  function window(x, y, width, height, origin, hasShutters = false) {
    const frame = .077;
    box(x, y, -.052, width + .05, height + .05, .15, timber, undefined, origin);
    const paneW = width / 2 - .084;
    const paneH = height / 2 - .084;
    for (const side of [-1, 1]) {
      for (const row of [-1, 1]) {
        const px = x + side * (paneW + .039) / 2;
        const py = y + row * (paneH + .039) / 2;
        box(px, py, .017, paneW, paneH, .035, glazing[(side + row === 0) ? 0 : 1], undefined, origin);
      }
      box(x + side * width / 2, y, .058, frame, height + .12, .14, trim, undefined, origin);
    }
    for (const row of [-1, 1]) {
      box(x, y + row * height / 2, .057, width + .13, frame, .14, trim, undefined, origin);
    }
    box(x, y, .057, .049, height, .075, wornWood, undefined, origin);
    box(x, y, .057, width, .049, .075, wornWood, undefined, origin);
    box(x, y + height / 2 + .083, .092, width + .28, .091, .23, timber, undefined, origin);
    box(x, y - height / 2 - .054, .118, width + .31, .105, .32, stones[2], undefined, origin);
    if (!hasShutters) return;
    for (const side of [-1, 1]) {
      const sx = x + side * (width / 2 + .196);
      box(sx, y, .064, .28, height - .014, .085, shutter, [0, -side * .18, 0], origin);
      for (let i = 0; i < 10; i++) {
        box(sx, y - height / 2 + .12 + i * (height - .21) / 9, .111, .234, .027, .041, shutterTrim, [0, -side * .18, 0], origin);
      }
      for (const row of [-1, 1]) {
        box(sx - side * .068, y + row * height * .31, .14, .16, .045, .026, iron, undefined, origin);
      }
    }
  }

  function gable(base, height, depth, surface, origin, shift = 0) {
    const shape = new THREE.Shape();
    shape.moveTo(-base / 2, 0);
    shape.lineTo(base / 2, 0);
    shape.lineTo(0, height);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
    part(geometry, surface, [0, shift, -depth], [1, 1, 1], [0, 0, 0], origin);
    geometry.dispose();
  }

  function masonry(width, depth, y, height, origin, colors, courses) {
    const step = height / courses;
    box(0, y + height / 2, 0, width - .035, height, depth - .035, mortar, undefined, origin);
    for (let row = 0; row < courses; row++) {
      for (const side of [-1, 1]) {
        for (const vertical of [false, true]) {
          const span = vertical ? depth : width;
          let start = -span / 2 + .019;
          while (start < span / 2 - .075) {
            const length = Math.min(span / 2 - start - .015, .25 + random() * .35);
            const along = start + length / 2;
            const edge = side * ((vertical ? width : depth) / 2 - .027);
            box(vertical ? edge : along, y + (row + .5) * step, vertical ? along : edge,
              vertical ? .112 : length - .019, step - .022, vertical ? length - .019 : .112,
              choose(colors), [(random() - .5) * .045, (random() - .5) * .06, (random() - .5) * .054], origin);
            start += length;
          }
        }
      }
    }
  }

  const front = face(0, HALF_DEPTH, 0);
  const back = face(0, -HALF_DEPTH, Math.PI);
  const right = face(HALF_WIDTH, 0, Math.PI / 2);
  const left = face(-HALF_WIDTH, 0, -Math.PI / 2);
  masonry(WIDTH + .24, DEPTH + .23, -.035, BASE + .012, undefined, stones, 3);
  box(0, BASE + .008, 0, WIDTH + .27, .14, DEPTH + .28, stones[2]);
  box(0, BASE + .085, 0, WIDTH, .08, DEPTH, timber);

  const frontWindows = [
    { x: -2.08, w: 1.04, bottom: 1.56, top: 2.94 },
    { x: .43, w: 1.12, bottom: BASE, top: 2.98 },
    { x: 2.49, w: .94, bottom: 1.67, top: 2.94 },
  ];
  wall(WIDTH, frontWindows, front);
  window(-2.08, 2.25, 1.04, 1.38, front, true);
  window(2.49, 2.305, .94, 1.27, front, true);
  const doorsill = BASE + .105;
  box(.43, (doorsill + 2.98) / 2, -.06, 1.13, 2.98 - doorsill, .16, timber, undefined, front);
  for (let i = 0; i < 7; i++) {
    box(-.018 + .15 * i, 1.86, .041, .145, 2.22, .111, choose(boards), undefined, front);
  }
  for (const edge of [-1, 1]) {
    box(.43 + edge * .615, 1.883, .079, .139, 2.40, .19, timber, undefined, front);
    box(.43 - edge * .306, 2.04, .115, .071, .94, .054, wornWood, [0, 0, edge * -.64], front);
  }
  for (const y of [1.04, 1.66, 2.47]) {
    box(.43, y, .116, 1.02, .098, .063, trim, undefined, front);
  }
  box(.43, 2.99, .102, 1.42, .18, .23, timber, undefined, front);
  box(.43, doorsill, .085, 1.39, .115, .41, wornWood, undefined, front);
  cylinder(.745, 1.81, .175, .052, .091, brass, [Math.PI / 2, 0, 0], front);

  const sideOpenings = [{ x: .15, w: 1.29, bottom: 1.56, top: 2.94 }];
  const rearOpenings = [
    { x: -1.86, w: 1.13, bottom: 1.56, top: 2.94 },
    { x: 1.86, w: 1.13, bottom: 1.56, top: 2.94 },
  ];
  wall(WIDTH, rearOpenings, back);
  for (const entry of rearOpenings) window(entry.x, 2.25, entry.w, 1.38, back, true);
  for (const end of [left, right]) {
    wall(DEPTH, sideOpenings, end);
    const gableSeat = roofHeight(HALF_DEPTH) - .058;
    wallBlock(0, (WALL_TOP + gableSeat) / 2, DEPTH, gableSeat - WALL_TOP, end, plasterShade);
    gable(DEPTH, RIDGE - .055 - gableSeat, .15, plasterShade, end, gableSeat);
    window(.15, 2.25, 1.29, 1.38, end, true);
    window(0, 4.77, .70, .73, end);
    box(0, WALL_TOP + .031, .039, DEPTH + .14, .19, .2, timber, undefined, end);
    beam([-2.56, 4.42, .09], [0, 6.10, .09], .154, .173, timber, end);
    beam([2.56, 4.42, .09], [0, 6.10, .09], .154, .173, timber, end);
    for (const side of [-1, 1]) {
      box(side * .96, 4.72, .053, .10, 1.27, .126, trim, undefined, end);
      beam([side * .49, 4.13, .077], [side * 1.56, 4.87, .077], .09, .12, trim, end);
      beam([side * 2.48, 2.89, .063], [side * 1.22, 3.50, .063], .137, .14, trim, end);
    }
    box(0, 5.68, .042, .135, .64, .124, timber, undefined, end);
  }

  for (const [origin, width] of [[front, WIDTH], [back, WIDTH], [right, DEPTH], [left, DEPTH]]) {
    for (const y of [.80, 3.54, 3.99]) box(0, y, .038, width + .13, .167, .171, timber, undefined, origin);
    for (const x of [-width / 2, width / 2]) box(x, 2.36, .039, .22, 3.31, .224, timber, undefined, origin);
    for (const x of [-width / 2 + .64, -.37, .37, width / 2 - .64]) {
      box(x, 3.769, .039, .117, .39, .14, trim, undefined, origin);
    }
  }
  for (const origin of [front, back]) {
    wallBlock(0, 4.181, WIDTH, .29, origin);
    box(0, 4.292, .009, WIDTH + .10, .133, .143, timber, undefined, origin);
  }
  for (const x of [-1.20, 1.43]) box(x, 2.38, 2.712, .17, 3.20, .17, timber);
  beam([-3.36, 3.53, 2.727], [-2.75, 3.02, 2.727], .12, .144, timber);
  beam([-1.19, .85, 2.727], [-.23, 1.47, 2.727], .121, .144, trim);
  beam([3.37, .87, 2.727], [2.92, 1.53, 2.727], .119, .134, trim);
  for (const s of [-1, 1]) {
    beam([s * 3.37, 3.53, -2.715], [s * 2.64, 3.02, -2.715], .126, .145, trim);
    box(s * .93, 2.16, -2.711, .153, 2.72, .14, timber);
  }

  const pitch = Math.atan(SLOPE);
  const roofSpan = 7.68;
  for (const side of [-1, 1]) {
    const angle = side * pitch;
    box(0, roofHeight(EAVE / 2), side * EAVE / 2, roofSpan, .143, EAVE / Math.cos(pitch), roofShadow, [angle, 0, 0]);
    for (let row = 0; row < 12; row++) {
      const z = 3.16 - row * .273;
      const offset = row % 2 * .183;
      for (let i = -11; i <= 11; i++) {
        const x = i * .365 + offset;
        if (Math.abs(x) > 3.69) continue;
        const dormerGap = side === 1 && z > 1.19 && z < 2.28 && Math.abs(x + .94) < .58;
        if (dormerGap) continue;
        box(x, roofHeight(z) + .078 + row * .005 + random() * .019, side * z,
          .351 + random() * .018, .074, .446 + random() * .036, choose(tiles), [angle + (random() - .5) * .025, (random() - .5) * .024, 0]);
      }
    }
    for (let i = -8; i <= 8; i++) {
      const x = i * .424;
      beam([x, roofHeight(2.37) - .071, side * 2.37], [x, roofHeight(3.24) - .071, side * 3.24], .105, .13, trim);
      box(x, roofHeight(3.24) - .087, side * 3.254, .086, .084, .039, endGrain);
    }
    beam([-3.87, roofHeight(3.25) - .06, side * 3.25], [3.87, roofHeight(3.25) - .06, side * 3.25], .118, .16, timber);
    for (const end of [-1, 1]) {
      beam([end * 3.804, RIDGE + .081, .02 * side], [end * 3.804, roofHeight(3.29) + .055, side * 3.29], .151, .18, trim);
    }
    cylinder(0, roofHeight(3.29) - .15, side * 3.34, .066, 7.58, copper, [0, 0, Math.PI / 2]);
    for (const x of [-3.59, -1.8, 0, 1.8, 3.59]) {
      cylinder(x, roofHeight(3.29) - .15, side * 3.34, .077, .044, iron, [0, 0, Math.PI / 2]);
    }
    const drainX = side === 1 ? 3.36 : -3.36;
    const gutter = new THREE.CatmullRomCurve3([
      new THREE.Vector3(drainX, roofHeight(3.29) - .15, side * 3.34),
      new THREE.Vector3(drainX, 3.59, side * 3.29),
      new THREE.Vector3(drainX, 3.34, side * 2.793),
      new THREE.Vector3(drainX, .49, side * 2.796),
      new THREE.Vector3(drainX, .24, side * 3.01),
    ]);
    const drain = new THREE.TubeGeometry(gutter, 16, .054, 7);
    part(drain, copper, [0, 0, 0], [1, 1, 1], [0, 0, 0]);
    drain.dispose();
    for (const y of [1.14, 2.53]) cylinder(drainX, y, side * 2.79, .068, .055, iron);
  }
  for (let i = -9; i <= 9; i++) {
    cylinder(.401 * i, RIDGE + .178, 0, .119, .404, choose(tiles), [0, 0, Math.PI / 2], undefined, .92);
  }

  const dormerX = -.95;
  const dormerZ = 2.428;
  const dormer = face(dormerX, dormerZ, 0);
  const dormerTop = 5.48;
  box(dormerX, 4.93, 2.02, 1.39, 1.09, .81, plaster);
  gable(1.39, .61, .81, plaster, dormer, dormerTop);
  window(0, 5.036, .688, .707, dormer);
  box(dormerX, 5.49, dormerZ + .036, 1.47, .101, .124, timber);
  for (const side of [-1, 1]) {
    const angle = -side * Math.atan(.61 / .695);
    box(dormerX + side * .421, 5.751, 2.002, 1.074, .126, 1.06, roofShadow, [0, 0, angle]);
    box(dormerX + side * .409, 5.788, 2.525, 1.107, .138, .115, trim, [0, 0, angle]);
    box(dormerX + side * .687, 5.015, dormerZ + .032, .11, .985, .156, timber);
    for (let row = 0; row < 4; row++) {
      const dx = .757 - row * .192;
      for (let i = 0; i < 4; i++) {
        box(dormerX + side * dx, 6.167 - dx * .877, 1.63 + i * .277,
          .317, .069, .269, choose(tiles), [0, 0, angle]);
      }
    }
  }
  cylinder(dormerX, 6.229, 2.045, .097, 1.041, tiles[3], [Math.PI / 2, 0, 0]);

  const chimneyX = 2.10;
  const chimneyZ = -1.25;
  const chimneyFace = face(chimneyX, chimneyZ, 0);
  masonry(.748, .718, 4.93, 1.51, chimneyFace, brick, 8);
  box(chimneyX, 6.432, chimneyZ, .92, .174, .881, stones[2]);
  box(chimneyX, 6.528, chimneyZ, .768, .048, .737, brick[1]);
  for (const side of [-1, 1]) {
    cylinder(chimneyX + side * .191, 6.625, chimneyZ, .142, .164, terracotta);
    cylinder(chimneyX + side * .191, 6.703, chimneyZ, .163, .052, brick[1]);
    cylinder(chimneyX + side * .191, 6.733, chimneyZ, .116, .009, roofShadow);
  }
  const chimney = new THREE.Object3D();
  chimney.position.set(chimneyX + .191, 6.77, chimneyZ);
  group.add(chimney);

  const porchX = .43;
  const porchFloor = .718;
  const near = 3.89;
  const far = 2.76;
  const posts = [porchX - 1.201, porchX + 1.201];
  masonry(2.68, 1.31, -.03, .622, face(porchX, 3.27, 0), stones, 3);
  for (let i = 0; i < 12; i++) {
    box(porchX + (i - 5.5) * .224, porchFloor - .058, 3.28, .214, .116, 1.26, choose(boards));
  }
  box(porchX, .607, near, 2.77, .139, .16, timber);
  for (let i = 0; i < 3; i++) {
    const stepY = .16 + i * .167;
    const z = 4.325 - i * .191;
    box(porchX, stepY / 2, z - .041, 1.595 + (2 - i) * .07, stepY, .326, stones[i + 1]);
    box(porchX, stepY - .008, z + .023, 1.64 + (2 - i) * .07, .064, .32, stones[2]);
  }
  for (const [i, x] of posts.entries()) {
    box(x, porchFloor + .077, near - .058, .283, .182, .283, stones[1]);
    box(x, 1.992, near - .058, .187, 2.326, .187, timber);
    box(x, 1.147, far, .157, .865, .16, timber);
    for (const y of [1.035, 1.580]) {
      beam([x, y, far], [x, y, near - .058], .095, .104, trim);
    }
    for (let baluster = 1; baluster < 5; baluster++) {
      box(x, 1.31, far + baluster * (near - .058 - far) / 5, .056, .526, .06, wornWood);
    }
    const inward = i === 0 ? 1 : -1;
    beam([x, 2.565, near - .058], [x + inward * .473, 3.146, near - .058], .112, .135, trim);
    beam([x, 2.637, near - .058], [x, 3.283, far + .38], .112, .135, trim);
    box(x, .939, near - .057, .211, .109, .211, trim);
  }
  box(porchX, 3.157, near - .039, 2.65, .184, .181, timber);
  box(porchX, 3.549, far - .052, 2.76, .173, .162, timber);
  const porchPitch = Math.atan(.35);
  box(porchX, 3.467, 3.317, 2.89, .130, 1.58, roofShadow, [porchPitch, 0, 0]);
  for (let i = -5; i <= 5; i++) {
    const x = porchX + i * .255;
    beam([x, 3.568, 2.655], [x, 3.085, 4.071], .075, .082, trim);
    for (let row = 0; row < 5; row++) {
      const z = 3.974 - row * .295;
      box(x, 3.563 - (z - 3.317) * .349 + row * .004, z, .25, .061, .418, choose(tiles), [porchPitch, 0, 0]);
    }
  }
  box(porchX, 3.235, 4.088, 2.89, .111, .098, timber);
  cylinder(porchX, 3.199, 4.144, .053, 2.90, copper, [0, 0, Math.PI / 2]);

  const fixtureX = porchX;
  const fixtureZ = 3.44;
  cylinder(fixtureX, 3.292, fixtureZ, .016, .229, iron);
  cylinder(fixtureX, 3.164, fixtureZ, .127, .059, iron);
  cylinder(fixtureX, 2.994, fixtureZ, .124, .053, iron);
  box(fixtureX, 3.076, fixtureZ, .163, .159, .163, lampGlass);
  for (const x of [-.096, .096]) {
    for (const z of [-.096, .096]) box(fixtureX + x, 3.081, fixtureZ + z, .019, .18, .019, iron);
  }

  function flowerBox(x, y, z) {
    box(x, y, z, 1.33, .218, .337, trim);
    box(x, y + .107, z, 1.40, .062, .393, wornWood);
    box(x, y + .146, z, 1.248, .025, .305, dirt);
    for (const side of [-1, 1]) {
      box(x + side * .557, y - .14, z - .062, .078, .235, .154, timber);
    }
    for (let i = 0; i < 20; i++) {
      const fx = x + (random() - .5) * 1.21;
      const fz = z + (random() - .5) * .27;
      const h = .117 + random() * .223;
      ball(fx, y + .160 + h / 2, fz, .088, h * .64, .067, choose(foliage));
      if (i % 2 === 0) ball(fx + .02, y + .17 + h, fz, .048, .036, .044, choose(petals));
    }
  }
  flowerBox(-2.08, 1.31, 2.904);

  function planter(x, z, radius) {
    const potHeight = radius * 1.4;
    const geometry = new THREE.CylinderGeometry(radius, radius * .72, potHeight, 12);
    part(geometry, terracotta, [x, potHeight / 2, z], [1, 1, 1], [0, 0, 0]);
    geometry.dispose();
    cylinder(x, potHeight - .025, z, radius * 1.06, .057, terracotta);
    cylinder(x, potHeight + .006, z, radius * .86, .007, dirt);
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4;
      const dx = Math.cos(angle) * radius * (.25 + random() * .50);
      const dz = Math.sin(angle) * radius * (.25 + random() * .50);
      const h = radius * (.64 + random());
      ball(x + dx, potHeight + h * .64, z + dz, radius * .38, h * .72, radius * .39, choose(foliage));
      if (i % 2) ball(x + dx, potHeight + h * 1.16, z + dz, .043, .034, .04, choose(petals));
    }
  }
  planter(-1.14, 3.59, .225);
  planter(-1.54, 3.42, .159);
  planter(2.06, 3.43, .205);

  const barrel = new THREE.LatheGeometry([
    new THREE.Vector2(.255, 0), new THREE.Vector2(.30, .06),
    new THREE.Vector2(.329, .275), new THREE.Vector2(.31, .535),
    new THREE.Vector2(.265, .625), new THREE.Vector2(.252, .625),
    new THREE.Vector2(.252, .551), new THREE.Vector2(0, .551),
  ], 16);
  part(barrel, wornWood, [-2.99, .008, 3.0], [1, 1, 1], [0, 0, 0]);
  barrel.dispose();
  cylinder(-2.99, .157, 3.0, .319, .053, iron);
  cylinder(-2.99, .485, 3.0, .319, .049, iron);
  cylinder(-2.99, .568, 3.0, .262, .019, timber);

  box(3.79, .102, -1.25, .677, .143, 1.73, timber);
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 8 - row; i++) {
      const z = -1.25 + (i - (7 - row) / 2) * .198;
      const h = .23 + row * .166;
      const len = .58 + random() * .105;
      const radius = .084 + random() * .024;
      cylinder(3.79, h, z, radius, len, choose(boards), [0, 0, Math.PI / 2]);
      cylinder(3.793 + len / 2, h, z, radius * .92, .023, endGrain, [0, 0, Math.PI / 2]);
    }
  }

  const canX = -1.72;
  const canZ = 3.84;
  cylinder(canX, .124, canZ, .124, .215, copper);
  cylinder(canX, .246, canZ, .109, .027, iron);
  beam([canX + .09, .096, canZ], [canX + .291, .249, canZ], .041, .045, copper);
  const handle = new THREE.TorusGeometry(.089, .012, 6, 16, Math.PI);
  part(handle, copper, [canX, .24, canZ], [1, 1, .95], [0, 0, 0]);
  handle.dispose();

  for (const [surface, geometries] of batches) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), surface);
    mesh.castShadow = surface !== lampGlass && !glazing.includes(surface);
    mesh.receiveShadow = mesh.castShadow;
    group.add(mesh);
    for (const geometry of geometries) geometry.dispose();
  }
  boxGeometry.dispose();
  sphereGeometry.dispose();
  tubeGeometry.dispose();

  const interior = new THREE.PointLight('#ffc07c', 13, 4.3, 2);
  interior.position.set(-.32, 2.29, 1.62);
  const landing = new THREE.PointLight('#ffbb74', 10, 4.7, 2);
  landing.position.set(fixtureX, 2.99, fixtureZ + .15);
  const attic = new THREE.PointLight('#ffc080', 2.1, 2.0, 2);
  attic.position.set(dormerX, 5.02, dormerZ - .38);
  group.add(interior, landing, attic);
  const glassOff = new THREE.Color('#34433d');
  const glassOn = [new THREE.Color('#f1994d'), new THREE.Color('#ffc982')];
  const lampOff = new THREE.Color('#747164');
  const lampOn = new THREE.Color('#ffd39b');
  const amber = new THREE.Color('#ffad55');
  function setLight(value) {
    const light = THREE.MathUtils.clamp(value, 0, 1);
    interior.intensity = 13 * light;
    landing.intensity = 10 * light;
    attic.intensity = 2.1 * light;
    glazing.forEach((surface, i) => {
      surface.color.copy(glassOff).lerp(glassOn[i], light);
      surface.emissive.copy(amber);
      surface.emissiveIntensity = light * (.39 + .18 * i);
    });
    lampGlass.color.copy(lampOff).lerp(lampOn, light);
    lampGlass.emissive.copy(amber);
    lampGlass.emissiveIntensity = light * 1.62;
  }
  setLight(1);
  return { group, setLight, chimney };
}
