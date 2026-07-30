'use strict';

const PHYSICAL_DICE_DURATION = 1750;
const PHYSICAL_DUAL_DICE_DURATION = 1980;
const PHYSICAL_DICE_IMPACTS = Object.freeze([0.56, 0.76, 0.90]);
const PHYSICAL_D10_CACHE = new Map();
const baseCreateDieMesh = createDieMesh;
const physicalDiceAdapters = Object.create(null);
globalThis.CairnDiceRenderer = Object.freeze({
  getAdapter(name) {
    return physicalDiceAdapters[name] || null;
  },
  register(adapters) {
    if (!adapters || typeof adapters !== 'object') throw new TypeError('Dice renderer adapters must be an object.');
    for (const [name, adapter] of Object.entries(adapters)) {
      if (typeof adapter !== 'function') throw new TypeError(`Dice renderer adapter ${name} must be a function.`);
      if (physicalDiceAdapters[name]) throw new Error(`Dice renderer adapter ${name} is already registered.`);
      physicalDiceAdapters[name] = adapter;
    }
  }
});



function physicalClamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function physicalLerp(from, to, progress) {
  return from + (to - from) * progress;
}

function physicalEaseOutCubic(progress) {
  const remaining = 1 - physicalClamp(progress);
  return 1 - remaining * remaining * remaining;
}

function physicalSmoothStep(progress) {
  const value = physicalClamp(progress);
  return value * value * (3 - 2 * value);
}

function physicalSmootherStep(progress) {
  const value = physicalClamp(progress);
  return value * value * value * (value * (value * 6 - 15) + 10);
}

function physicalQuatNormalize(quaternion) {
  const length = Math.hypot(quaternion.x, quaternion.y, quaternion.z, quaternion.w) || 1;
  return {
    x: quaternion.x / length,
    y: quaternion.y / length,
    z: quaternion.z / length,
    w: quaternion.w / length
  };
}

function physicalQuatMultiply(left, right) {
  return physicalQuatNormalize({
    x: left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
    y: left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
    z: left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
    w: left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z
  });
}

function physicalQuatFromAxisAngle(axis, angle) {
  const length = Math.hypot(axis.x, axis.y, axis.z) || 1;
  const half = angle / 2;
  const sine = Math.sin(half) / length;
  return physicalQuatNormalize({
    x: axis.x * sine,
    y: axis.y * sine,
    z: axis.z * sine,
    w: Math.cos(half)
  });
}

function physicalQuatFromEuler(rotation) {
  const c1 = Math.cos(rotation.x / 2);
  const c2 = Math.cos(rotation.y / 2);
  const c3 = Math.cos(rotation.z / 2);
  const s1 = Math.sin(rotation.x / 2);
  const s2 = Math.sin(rotation.y / 2);
  const s3 = Math.sin(rotation.z / 2);
  return physicalQuatNormalize({
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3
  });
}

function physicalQuatSlerp(from, to, progress) {
  const amount = physicalClamp(progress);
  let target = to;
  let dot = from.x * to.x + from.y * to.y + from.z * to.z + from.w * to.w;
  if (dot < 0) {
    dot = -dot;
    target = { x: -to.x, y: -to.y, z: -to.z, w: -to.w };
  }
  if (dot > 0.9995) {
    return physicalQuatNormalize({
      x: physicalLerp(from.x, target.x, amount),
      y: physicalLerp(from.y, target.y, amount),
      z: physicalLerp(from.z, target.z, amount),
      w: physicalLerp(from.w, target.w, amount)
    });
  }
  const theta = Math.acos(physicalClamp(dot, -1, 1));
  const sine = Math.sin(theta) || 1;
  const fromWeight = Math.sin((1 - amount) * theta) / sine;
  const toWeight = Math.sin(amount * theta) / sine;
  return physicalQuatNormalize({
    x: from.x * fromWeight + target.x * toWeight,
    y: from.y * fromWeight + target.y * toWeight,
    z: from.z * fromWeight + target.z * toWeight,
    w: from.w * fromWeight + target.w * toWeight
  });
}

function physicalEulerFromQuat(quaternion) {
  const q = physicalQuatNormalize(quaternion);
  const sinPitch = physicalClamp(2 * (q.w * q.y + q.z * q.x), -1, 1);
  return {
    x: Math.atan2(2 * (q.w * q.x - q.y * q.z), 1 - 2 * (q.x * q.x + q.y * q.y)),
    y: Math.asin(sinPitch),
    z: Math.atan2(2 * (q.w * q.z - q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z))
  };
}

function physicalHash(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function physicalSignedHash(seed) {
  return physicalHash(seed) * 2 - 1;
}

function physicalSeed(sides, value, salt = 0) {
  return Number(sides) * 97 + Number(value) * 31 + salt * 17;
}

function createPhysicalD10Mesh() {
  if (PHYSICAL_D10_CACHE.has(10)) return PHYSICAL_D10_CACHE.get(10);
  const vertices = [[0, 0, 1.34], [0, 0, -1.34]];
  const upperStart = vertices.length;
  for (let index = 0; index < 5; index += 1) {
    const angle = index / 5 * Math.PI * 2 - Math.PI / 2;
    vertices.push([Math.cos(angle), Math.sin(angle), 0.28]);
  }
  const lowerStart = vertices.length;
  for (let index = 0; index < 5; index += 1) {
    const angle = (index + 0.5) / 5 * Math.PI * 2 - Math.PI / 2;
    vertices.push([Math.cos(angle), Math.sin(angle), -0.28]);
  }
  const faces = [];
  for (let index = 0; index < 5; index += 1) {
    const next = (index + 1) % 5;
    faces.push([0, upperStart + index, lowerStart + index, upperStart + next]);
    faces.push([1, lowerStart + next, upperStart + next, lowerStart + index]);
  }
  const normalized = normalizeDieVertices(vertices);
  const mesh = { vertices: normalized, faces: orientFacesOutward(normalized, faces), sides: 10 };
  PHYSICAL_D10_CACHE.set(10, mesh);
  return mesh;
}

createDieMesh = function createPhysicalDieMesh(sides) {
  const numericSides = DICE_SIDES.includes(Number(sides)) ? Number(sides) : 20;
  if (numericSides === 10 || numericSides === 100) return createPhysicalD10Mesh();
  return baseCreateDieMesh(numericSides);
};

const PHYSICAL_FINAL_POSES = Object.freeze({
  4: Object.freeze([
    { x: 0.66, y: 0.48, z: -0.10 }, { x: 0.78, y: 0.66, z: 0.08 },
    { x: 0.58, y: 0.84, z: -0.18 }, { x: 0.82, y: 0.92, z: 0.14 }
  ]),
  6: Object.freeze([
    { x: 0.58, y: 0.70, z: -0.08 }, { x: 0.74, y: 0.92, z: 0.06 },
    { x: 0.88, y: 0.62, z: -0.14 }, { x: 0.64, y: 1.08, z: 0.12 }
  ]),
  8: Object.freeze([
    { x: 0.44, y: 0.62, z: -0.12 }, { x: 0.60, y: 0.90, z: 0.08 },
    { x: 0.76, y: 0.54, z: -0.18 }, { x: 0.54, y: 1.10, z: 0.14 }
  ]),
  10: Object.freeze([
    { x: 0.30, y: 0.54, z: -0.08 }, { x: 0.42, y: 0.82, z: 0.10 },
    { x: 0.56, y: 1.02, z: -0.14 }, { x: 0.38, y: 1.26, z: 0.12 }
  ]),
  12: Object.freeze([
    { x: 0.40, y: 0.58, z: -0.10 }, { x: 0.56, y: 0.84, z: 0.08 },
    { x: 0.70, y: 1.04, z: -0.16 }, { x: 0.50, y: 1.22, z: 0.12 }
  ]),
  20: Object.freeze([
    { x: 0.34, y: 0.56, z: -0.08 }, { x: 0.48, y: 0.80, z: 0.08 },
    { x: 0.62, y: 1.02, z: -0.12 }, { x: 0.42, y: 1.20, z: 0.10 }
  ]),
  100: Object.freeze([
    { x: 0.34, y: 0.62, z: -0.08 }, { x: 0.48, y: 0.86, z: 0.08 },
    { x: 0.56, y: 1.08, z: -0.12 }, { x: 0.40, y: 1.26, z: 0.10 }
  ])
});

finalDieRotation = function finalPhysicalDieRotation(sides, value) {
  const numericSides = DICE_SIDES.includes(Number(sides)) ? Number(sides) : 20;
  const poses = PHYSICAL_FINAL_POSES[numericSides] || PHYSICAL_FINAL_POSES[20];
  const index = Math.abs(Number(value) || 0) % poses.length;
  const pose = poses[index];
  const seed = physicalSeed(numericSides, value, 3);
  return {
    x: pose.x + physicalSignedHash(seed) * 0.045,
    y: pose.y + physicalSignedHash(seed + 1) * 0.055,
    z: pose.z + physicalSignedHash(seed + 2) * 0.035
  };
};

function physicalFaceArea(points) {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0)) / 2;
}

function physicalFaceCentroid(points) {
  return points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
    .map(value => value / points.length);
}

function physicalFaceTextAngle(points) {
  let longest = [points[0], points[1] || points[0]];
  let longestLength = 0;
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    if (length > longestLength) {
      longestLength = length;
      longest = [start, end];
    }
  }
  let angle = Math.atan2(longest[1][1] - longest[0][1], longest[1][0] - longest[0][0]);
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;
  return physicalClamp(angle, -0.30, 0.30);
}

function physicalFaceLabel(canvas, sides, value) {
  if (Number(sides) !== 10 || !canvas?.classList?.contains('percentile-die')) return String(value);
  if (canvas.classList.contains('percentile-die-first')) {
    return Number(value) === 100 ? '00' : String(Math.floor(Number(value) / 10) * 10).padStart(2, '0');
  }
  return Number(value) === 100 ? '0' : String(Number(value) % 10);
}

function physicalRadiusForSides(sides) {
  const values = { 4: 0.43, 6: 0.405, 8: 0.43, 10: 0.435, 12: 0.415, 20: 0.43 };
  return values[Number(sides)] || 0.42;
}

function physicalPath(context, points) {
  context.beginPath();
  points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
  context.closePath();
}

function physicalInsetPoints(points, factor) {
  const centroid = physicalFaceCentroid(points);
  return points.map(([x, y]) => [
    physicalLerp(centroid[0], x, factor),
    physicalLerp(centroid[1], y, factor)
  ]);
}

function drawPhysicalTexture(context, entry, sides, isLight, canvas) {
  const adapter = physicalDiceAdapters.drawPhysicalTexture;
  return adapter ? adapter(context, entry, sides, isLight, canvas, drawPhysicalTextureBase) : drawPhysicalTextureBase(context, entry, sides, isLight, canvas);
}

function drawPhysicalTextureBase(context, entry, sides, isLight, canvas) {
  const xs = entry.points.map(point => point[0]);
  const ys = entry.points.map(point => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const seedBase = physicalSeed(sides, entry.faceIndex, canvas?.classList?.contains('percentile-die-second') ? 11 : 7);
  context.save();
  physicalPath(context, entry.points);
  context.clip();

  const mineralWash = context.createLinearGradient(minX, minY, maxX, maxY);
  mineralWash.addColorStop(0, isLight ? 'rgba(239, 246, 220, .08)' : 'rgba(230, 241, 211, .07)');
  mineralWash.addColorStop(0.46, 'rgba(255, 255, 255, 0)');
  mineralWash.addColorStop(1, isLight ? 'rgba(34, 49, 29, .11)' : 'rgba(9, 19, 10, .18)');
  context.fillStyle = mineralWash;
  context.fillRect(minX - 2, minY - 2, maxX - minX + 4, maxY - minY + 4);

  for (let index = 0; index < 4; index += 1) {
    const startY = physicalLerp(minY, maxY, 0.18 + physicalHash(seedBase + index * 7) * 0.64);
    const bend = physicalSignedHash(seedBase + index * 7 + 1) * (maxY - minY) * 0.12;
    context.beginPath();
    context.moveTo(minX - 5, startY);
    context.bezierCurveTo(
      physicalLerp(minX, maxX, 0.34), startY + bend,
      physicalLerp(minX, maxX, 0.67), startY - bend * 0.55,
      maxX + 5, startY + bend * 0.25
    );
    context.lineWidth = 0.38 + physicalHash(seedBase + index + 30) * 0.42;
    context.strokeStyle = isLight
      ? `rgba(38, 57, 31, ${0.045 + physicalHash(seedBase + index + 50) * 0.035})`
      : `rgba(225, 237, 207, ${0.035 + physicalHash(seedBase + index + 50) * 0.035})`;
    context.stroke();
  }
  context.restore();
}

function drawPhysicalFaceValue(context, face, label, reveal, isLight) {
  const adapter = physicalDiceAdapters.drawPhysicalFaceValue;
  return adapter ? adapter(context, face, label, reveal, isLight, drawPhysicalFaceValueBase) : drawPhysicalFaceValueBase(context, face, label, reveal, isLight);
}

function drawPhysicalFaceValueBase(context, face, label, reveal, isLight) {
  const points = face.points;
  const centroid = physicalFaceCentroid(points);
  const area = physicalFaceArea(points);
  const angle = physicalFaceTextAngle(points);
  const sizeFactor = label.length > 1 ? 0.49 : 0.66;
  const fontSize = physicalClamp(Math.sqrt(area) * sizeFactor, 16, label.length > 1 ? 33 : 42);
  const scale = 0.96 + reveal * 0.04;

  context.save();
  physicalPath(context, points);
  context.clip();
  context.translate(centroid[0], centroid[1]);
  context.rotate(angle);
  context.scale(scale, scale);
  context.globalAlpha = reveal;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `800 ${fontSize}px Georgia, "Times New Roman", serif`;
  context.lineJoin = 'round';
  context.shadowColor = 'rgba(7, 16, 8, .46)';
  context.shadowBlur = Math.max(1.1, fontSize * 0.035);
  context.shadowOffsetY = Math.max(0.8, fontSize * 0.025);
  context.lineWidth = Math.max(0.95, fontSize * 0.042);
  context.strokeStyle = isLight ? 'rgba(31, 48, 27, .72)' : 'rgba(12, 26, 14, .82)';
  context.strokeText(label, 0, fontSize * 0.025);
  context.fillStyle = 'rgba(250, 255, 245, .99)';
  context.fillText(label, 0, fontSize * 0.025);
  context.restore();
}

paintResultDie = function paintPhysicalMossDie(canvas, sides, rotation, lift = 0) {
  const context = canvas?.getContext?.('2d');
  if (!context) return false;
  const bounds = canvas.getBoundingClientRect();
  const cssSize = Math.max(104, Math.round(Math.min(bounds.width || 136, bounds.height || 136)));
  const pixelRatio = Math.min(2, globalThis.devicePixelRatio || 1);
  const targetSize = Math.round(cssSize * pixelRatio);
  if (canvas.width !== targetSize || canvas.height !== targetSize) {
    canvas.width = targetSize;
    canvas.height = targetSize;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssSize, cssSize);
  const mesh = createDieMesh(sides);
  const transformed = mesh.vertices.map(vertex => rotateDiePoint(vertex, rotation));
  const center = cssSize / 2;
  const radius = cssSize * physicalRadiusForSides(mesh.sides);
  const project = point => {
    const perspective = 4.35 / (4.35 - point[2]);
    return [center + point[0] * radius * perspective, center + lift + point[1] * radius * perspective];
  };
  const light = vectorNormalize([-0.52, -0.72, 0.68]);
  const isLight = document.documentElement.dataset.theme === 'light';
  const visibleFaces = mesh.faces.map((face, faceIndex) => {
    const [a, b, c] = face.map(index => transformed[index]);
    const normal = vectorNormalize(vectorCross(
      b.map((entry, axis) => entry - a[axis]),
      c.map((entry, axis) => entry - a[axis])
    ));
    const depth = face.reduce((sum, index) => sum + transformed[index][2], 0) / face.length;
    const points = face.map(index => project(transformed[index]));
    return { face, faceIndex, normal, depth, points, area: physicalFaceArea(points) };
  }).filter(entry => entry.normal[2] > -0.035).sort((left, right) => left.depth - right.depth);

  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const entry of visibleFaces) {
    const lightDot = Math.max(0, vectorDot(entry.normal, light));
    const brightness = physicalClamp(0.26 + lightDot * 0.74, 0.26, 1);
    const xs = entry.points.map(point => point[0]);
    const ys = entry.points.map(point => point[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const percentileShift = canvas.classList.contains('percentile-die-first') ? 2.5 : canvas.classList.contains('percentile-die-second') ? -1.5 : 0;
    const baseLightness = (isLight ? 35 + brightness * 18 : 21 + brightness * 20) + percentileShift;
    const outerGradient = context.createLinearGradient(minX, minY, maxX, maxY);
    outerGradient.addColorStop(0, `hsl(88 34% ${Math.min(60, baseLightness + 4)}%)`);
    outerGradient.addColorStop(0.58, `hsl(94 31% ${baseLightness}%)`);
    outerGradient.addColorStop(1, `hsl(82 36% ${Math.max(16, baseLightness - 7)}%)`);

    physicalPath(context, entry.points);
    context.fillStyle = outerGradient;
    context.fill();

    const insetPoints = physicalInsetPoints(entry.points, mesh.sides === 6 ? 0.88 : 0.91);
    const innerGradient = context.createLinearGradient(minX, minY, maxX, maxY);
    innerGradient.addColorStop(0, `hsl(91 32% ${Math.min(64, baseLightness + 8 + lightDot * 4)}%)`);
    innerGradient.addColorStop(0.52, `hsl(96 29% ${Math.min(57, baseLightness + 4)}%)`);
    innerGradient.addColorStop(1, `hsl(87 33% ${Math.max(19, baseLightness - 2)}%)`);
    physicalPath(context, insetPoints);
    context.fillStyle = innerGradient;
    context.fill();
    drawPhysicalTexture(context, { ...entry, points: insetPoints }, mesh.sides, isLight, canvas);

    context.save();
    physicalPath(context, insetPoints);
    context.clip();
    const faceShade = context.createRadialGradient(
      physicalLerp(minX, maxX, 0.38), physicalLerp(minY, maxY, 0.30), 2,
      physicalLerp(minX, maxX, 0.48), physicalLerp(minY, maxY, 0.48), Math.max(maxX - minX, maxY - minY) * 0.78
    );
    faceShade.addColorStop(0, `rgba(244, 251, 228, ${0.035 + lightDot * 0.055})`);
    faceShade.addColorStop(0.68, 'rgba(255, 255, 255, 0)');
    faceShade.addColorStop(1, isLight ? 'rgba(29, 43, 25, .10)' : 'rgba(5, 14, 7, .18)');
    context.fillStyle = faceShade;
    context.fillRect(minX - 2, minY - 2, maxX - minX + 4, maxY - minY + 4);
    context.restore();

    physicalPath(context, entry.points);
    context.lineWidth = mesh.sides === 6 ? 2.25 : 1.8;
    context.strokeStyle = isLight ? 'rgba(30, 47, 27, .76)' : 'rgba(8, 20, 10, .88)';
    context.stroke();
    physicalPath(context, insetPoints);
    context.lineWidth = 0.8;
    context.strokeStyle = `rgba(232, 242, 214, ${0.10 + lightDot * 0.14})`;
    context.stroke();
  }

  const object = canvas.closest?.('.result-die-object');
  const value = Number(object?.dataset?.value);
  const defaultReveal = object?.classList?.contains('is-tumbling') ? 0 : 1;
  const reveal = physicalClamp(Number(object?.dataset?.faceReveal ?? defaultReveal));
  if (reveal > 0 && Number.isFinite(value) && visibleFaces.length) {
    const frontFace = visibleFaces.reduce((best, entry) => {
      const score = entry.normal[2] * 0.90 + Math.min(0.34, entry.area / 3300) + entry.depth * 0.07;
      return !best || score > best.score ? { entry, score } : best;
    }, null)?.entry;
    if (frontFace) drawPhysicalFaceValue(context, frontFace, physicalFaceLabel(canvas, sides, value), reveal, isLight);
  }
  return true;
};

function physicalEntry(scene, roll, salt = 0) {
  const sides = DICE_SIDES.includes(Number(roll.sides)) ? Number(roll.sides) : 6;
  const value = Number(roll.value);
  const object = scene.querySelector('.result-die-object');
  object.dataset.faceReveal = object.classList.contains('is-tumbling') ? '0' : '1';
  return {
    scene,
    object,
    shadow: scene.querySelector('.result-die-shadow'),
    number: scene.querySelector('.result-die-value'),
    canvases: [...scene.querySelectorAll('.result-die-canvas')],
    sides,
    value,
    seed: physicalSeed(sides, value, salt),
    finalRotation: finalDieRotation(sides, value)
  };
}

function physicalPaintEntry(entry, rotation, lift = 0) {
  const adapter = physicalDiceAdapters.physicalPaintEntry;
  return adapter ? adapter(entry, rotation, lift, physicalPaintEntryBase) : physicalPaintEntryBase(entry, rotation, lift);
}

function physicalPaintEntryBase(entry, rotation, lift = 0) {
  entry.canvases.forEach((canvas, index) => {
    const percentile = entry.sides === 100;
    const offset = percentile
      ? { x: index ? 0.18 : -0.12, y: index ? 0.42 : -0.38, z: index ? 0.09 : -0.12 }
      : { x: 0, y: 0, z: 0 };
    paintResultDie(
      canvas,
      percentile ? 10 : entry.sides,
      { x: rotation.x + offset.x, y: rotation.y + offset.y, z: rotation.z + offset.z },
      lift + (percentile ? (index ? 3 : -1) : 0)
    );
  });
}

function physicalSetPose(entry, x, y, scale = 1, opacity = 1) {
  entry.object.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  entry.object.style.opacity = String(opacity);
  if (!entry.shadow) return;
  const height = Math.max(0, -y);
  const proximity = 1 - physicalClamp(height / 54);
  const shadowScaleX = (0.54 + proximity * 0.38) * scale;
  const shadowScaleY = 0.70 + proximity * 0.30;
  entry.shadow.style.transform = `translate3d(${x}px, 0, 0) scale(${shadowScaleX}, ${shadowScaleY})`;
  entry.shadow.style.opacity = String(opacity * (0.16 + proximity * 0.32));
  entry.shadow.style.filter = `blur(${physicalLerp(10, 5.5, proximity)}px)`;
}

function physicalTravel(stage, object) {
  const stageWidth = stage?.clientWidth || stage?.getBoundingClientRect?.().width || 320;
  const objectWidth = object?.offsetWidth || object?.getBoundingClientRect?.().width || 144;
  return Math.max(88, Math.min(148, (stageWidth - objectWidth) / 2 + 24));
}

function physicalSinglePose(progress, travel, seed) {
  const finalX = physicalSignedHash(seed + 3) * 10;
  const firstLanding = 0.18;
  const wallImpact = PHYSICAL_DICE_IMPACTS[0];
  const reboundEnd = PHYSICAL_DICE_IMPACTS[1];
  const settleBounceEnd = PHYSICAL_DICE_IMPACTS[2];
  if (progress < firstLanding) {
    const phase = progress / firstLanding;
    return {
      x: physicalLerp(-travel - 30, -travel * 0.55, phase),
      y: -(1 - phase) * 11 - Math.sin(phase * Math.PI) * 18,
      scale: 0.96 + phase * 0.04
    };
  }
  if (progress < wallImpact) {
    const phase = (progress - firstLanding) / (wallImpact - firstLanding);
    const hopEnvelope = 1 - phase * 0.72;
    return {
      x: physicalLerp(-travel * 0.55, travel, phase),
      y: -Math.abs(Math.sin(phase * Math.PI * 4)) * (2.2 + hopEnvelope * 5.4),
      scale: 1
    };
  }
  if (progress < reboundEnd) {
    const phase = (progress - wallImpact) / (reboundEnd - wallImpact);
    return {
      x: physicalLerp(travel, finalX + 30, physicalEaseOutCubic(phase)),
      y: -Math.sin(phase * Math.PI) * (29 + physicalHash(seed + 5) * 4),
      scale: 1
    };
  }
  if (progress < settleBounceEnd) {
    const phase = (progress - reboundEnd) / (settleBounceEnd - reboundEnd);
    return {
      x: physicalLerp(finalX + 30, finalX - 6, physicalEaseOutCubic(phase)),
      y: -Math.sin(phase * Math.PI) * (10 + physicalHash(seed + 6) * 2.5),
      scale: 1
    };
  }
  const phase = (progress - settleBounceEnd) / (1 - settleBounceEnd);
  return {
    x: physicalLerp(finalX - 6, finalX, physicalEaseOutCubic(phase)),
    y: -Math.abs(Math.sin(phase * Math.PI * 2)) * (1 - phase) * 2.6,
    scale: 1
  };
}

function physicalInitialSpin(entry, direction = 1) {
  const initialRotation = {
    x: entry.finalRotation.x + direction * (0.95 + physicalHash(entry.seed + 8) * 0.55),
    y: entry.finalRotation.y + (1.20 + physicalHash(entry.seed + 9) * 0.70),
    z: entry.finalRotation.z + direction * (0.34 + physicalHash(entry.seed + 10) * 0.34)
  };
  return {
    orientation: physicalQuatFromEuler(initialRotation),
    rotation: initialRotation,
    previousPose: null,
    settleFrom: null,
    settleTarget: physicalQuatFromEuler(entry.finalRotation),
    direction,
    rollRadius: entry.sides === 4 ? 51 : entry.sides === 6 ? 59 : entry.sides === 100 ? 56 : 62,
    impactEnergy: 0
  };
}

function physicalApplyImpact(spin, impactIndex, direction = 1) {
  const strength = [1, 0.46, 0.20][impactIndex] || 0.12;
  spin.direction = direction;
  spin.impactEnergy = Math.max(spin.impactEnergy, strength);
}

function physicalAdvanceSpin(spin, finalRotation, deltaSeconds, progress, pose) {
  const adapter = physicalDiceAdapters.physicalAdvanceSpin;
  return adapter ? adapter(spin, finalRotation, deltaSeconds, progress, pose, physicalAdvanceSpinBase) : physicalAdvanceSpinBase(spin, finalRotation, deltaSeconds, progress, pose);
}

function physicalAdvanceSpinBase(spin, finalRotation, deltaSeconds, progress, pose) {
  if (pose && spin.previousPose) {
    const deltaX = pose.x - spin.previousPose.x;
    const deltaY = pose.y - spin.previousPose.y;
    const distance = Math.hypot(deltaX, deltaY * 0.32);
    const travelDirection = Math.sign(deltaX) || spin.direction || 1;
    const rollAngle = distance / spin.rollRadius;
    if (rollAngle > 0.0001) {
      const rollAxis = { x: 0.58, y: travelDirection * 0.79, z: 0.19 };
      spin.orientation = physicalQuatMultiply(physicalQuatFromAxisAngle(rollAxis, rollAngle), spin.orientation);
    }
    const airborne = physicalClamp(Math.max(0, -pose.y) / 42);
    if (airborne > 0.02) {
      const tumbleAngle = deltaSeconds * airborne * (0.52 + spin.impactEnergy * 0.42);
      const tumbleAxis = { x: travelDirection * 0.42, y: 0.24, z: 0.68 };
      spin.orientation = physicalQuatMultiply(physicalQuatFromAxisAngle(tumbleAxis, tumbleAngle), spin.orientation);
    }
  }
  if (pose) spin.previousPose = { x: pose.x, y: pose.y };
  spin.impactEnergy *= Math.exp(-deltaSeconds * 7.2);

  const settleStart = 0.80;
  if (progress >= settleStart) {
    if (!spin.settleFrom) spin.settleFrom = { ...spin.orientation };
    const settle = physicalSmootherStep((progress - settleStart) / (1 - settleStart));
    spin.orientation = physicalQuatSlerp(spin.settleFrom, spin.settleTarget, settle);
  }
  spin.rotation = physicalEulerFromQuat(spin.orientation);
}

function physicalNotation(sides) {
  return `k${Number(sides) === 100 ? 100 : Number(sides)}`;
}

function physicalResultContext(sides, custom = '') {
  return custom || `Rzut ${physicalNotation(sides)}`;
}

function appendPhysicalContext(shell, text) {
  const context = createEl('span', { className: 'result-die-context', text });
  shell.append(context);
  return context;
}

animateDiceResult = function animatePhysicalDiceResult(container, value, label, sides = 6, tone = 'neutral', contextLabel = '') {
  if (!container) return;
  const token = ++diceAnimationToken;
  const numericSides = DICE_SIDES.includes(Number(sides)) ? Number(sides) : 6;
  const reduced = shouldReduceMotion();
  const shell = createDiceResultVisual(value, label, numericSides, tone, !reduced);
  const scene = shell.querySelector('.result-die-scene');
  const copy = shell.querySelector('.result-die-copy');
  const context = appendPhysicalContext(shell, physicalResultContext(numericSides, contextLabel));
  const entry = physicalEntry(scene, { sides: numericSides, value }, token);
  scene.classList.add('die-motion-stage');
  container.replaceChildren(shell);

  if (reduced) {
    entry.object.dataset.faceReveal = '1';
    entry.object.classList.remove('is-tumbling');
    entry.number.textContent = String(value);
    physicalPaintEntry(entry, entry.finalRotation);
    shell.setAttribute('aria-label', `${label}: ${value}. ${context.textContent}.`);
    triggerHaptic(resultHapticForTone(tone));
    return;
  }

  shell.setAttribute('aria-hidden', 'true');
  const started = performance.now();
  let previous = started;
  const travel = physicalTravel(scene, entry.object);
  const direction = physicalSignedHash(entry.seed + 20) >= 0 ? 1 : -1;
  const spin = physicalInitialSpin(entry, direction);
  let nextImpact = 0;

  const tick = now => {
    if (token !== diceAnimationToken || !shell.isConnected) return;
    const progress = Math.min(1, (now - started) / PHYSICAL_DICE_DURATION);
    const deltaSeconds = Math.min(0.034, Math.max(0, (now - previous) / 1000));
    previous = now;

    while (nextImpact < PHYSICAL_DICE_IMPACTS.length && progress >= PHYSICAL_DICE_IMPACTS[nextImpact]) {
      physicalApplyImpact(spin, nextImpact, direction);
      triggerHaptic(nextImpact === 0 ? 'impact' : 'tick');
      nextImpact += 1;
    }

    const pose = physicalSinglePose(progress, travel, entry.seed);
    physicalAdvanceSpin(spin, entry.finalRotation, deltaSeconds, progress, pose);
    const reveal = progress < 0.92 ? 0 : physicalSmootherStep((progress - 0.92) / 0.08);
    entry.object.dataset.faceReveal = String(reveal);
    physicalSetPose(entry, pose.x, pose.y, pose.scale, 1);
    physicalPaintEntry(entry, spin.rotation, pose.y * 0.055);

    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }

    entry.number.textContent = String(value);
    entry.object.dataset.faceReveal = '1';
    entry.object.classList.remove('is-tumbling');
    copy.textContent = label;
    shell.removeAttribute('aria-hidden');
    shell.classList.remove('rolling');
    shell.classList.add('settled');
    shell.setAttribute('aria-label', `${label}: ${value}. ${context.textContent}.`);
    physicalSetPose(entry, pose.x, 0, 1, 1);
    physicalPaintEntry(entry, spin.rotation);
    triggerHaptic(resultHapticForTone(tone));
  };

  requestAnimationFrame(tick);
};

function physicalDualContext(rolls, custom = '') {
  if (custom) return custom;
  if (rolls[0].sides === rolls[1].sides) return `2${physicalNotation(rolls[0].sides)}, zachowaj wyższy`;
  return `${physicalNotation(rolls[0].sides)} + ${physicalNotation(rolls[1].sides)}, zachowaj wyższy`;
}

function physicalPrepareDualShell(container, rolls, total, label, tone, contextLabel, reduced) {
  const highest = Math.max(...rolls.map(roll => roll.value));
  const winnerIndexes = rolls.map((roll, index) => roll.value === highest ? index : -1).filter(index => index >= 0);
  const isTie = winnerIndexes.length > 1;
  const scenes = rolls.map((roll, index) => {
    const scene = createResultDie(roll.value, roll.sides, !reduced);
    scene.classList.add('damage-die-scene', winnerIndexes.includes(index) ? 'damage-die-winner' : 'damage-die-loser');
    scene.dataset.rollIndex = String(index);
    return scene;
  });
  const stage = createEl('div', { className: 'dual-dice-stage' }, scenes);
  const copy = createEl('span', { className: 'result-die-copy', text: reduced ? `Wyższy wynik: ${total} ${label}` : 'Kości w ruchu…' });
  const context = createEl('span', { className: 'result-die-context', text: physicalDualContext(rolls, contextLabel) });
  const shell = createEl('div', {
    className: `dual-dice-result ${reduced ? 'settled comparing' : 'rolling'}${isTie ? ' is-tie' : ''}`,
    attrs: { 'data-tone': tone }
  }, [stage, copy, context]);
  container.replaceChildren(shell);
  return { shell, stage, scenes, copy, context, winnerIndexes, isTie };
}

function physicalDualPose(progress, side, separation, travel, seed, index) {
  const firstImpact = 0.48;
  const secondImpact = 0.68;
  const thirdImpact = 0.86;
  const target = side * separation;
  const collisionX = side * 8;
  if (progress < firstImpact) {
    const phase = progress / firstImpact;
    return {
      x: physicalLerp(side * (travel + 22), collisionX, phase),
      y: -(1 - phase) * (8 + index * 3) - Math.sin(phase * Math.PI) * (35 + physicalHash(seed + 2) * 8)
    };
  }
  if (progress < secondImpact) {
    const phase = (progress - firstImpact) / (secondImpact - firstImpact);
    return {
      x: physicalLerp(collisionX, target * 0.78, physicalEaseOutCubic(phase)),
      y: -Math.sin(phase * Math.PI) * (23 + physicalHash(seed + 3) * 4)
    };
  }
  if (progress < thirdImpact) {
    const phase = (progress - secondImpact) / (thirdImpact - secondImpact);
    return {
      x: physicalLerp(target * 0.78, target, physicalEaseOutCubic(phase)),
      y: -Math.sin(phase * Math.PI) * (8 + physicalHash(seed + 4) * 2.5)
    };
  }
  const phase = (progress - thirdImpact) / (1 - thirdImpact);
  return {
    x: target,
    y: -Math.abs(Math.sin(phase * Math.PI * 2)) * (1 - phase) * 2.2
  };
}

function physicalSetDualComparison(entries, winnerIndexes, isTie, separation, settledRotations = null) {
  entries.forEach((entry, index) => {
    const side = index === 0 ? -1 : 1;
    const winner = winnerIndexes.includes(index);
    const scale = isTie ? 0.91 : winner ? 0.96 : 0.84;
    const y = isTie ? 0 : winner ? -4 : 8;
    const opacity = isTie || winner ? 1 : 0.42;
    physicalSetPose(entry, side * separation, y, scale, opacity);
    entry.object.dataset.faceReveal = '1';
    entry.object.classList.remove('is-tumbling');
    entry.number.textContent = String(entry.value);
    physicalPaintEntry(entry, settledRotations?.[index] || entry.finalRotation);
  });
}

function animateHighestDamageDice(container, rolls, total, label = 'obrażeń', tone = 'success', contextLabel = '') {
  if (!container || !Array.isArray(rolls) || rolls.length !== 2) {
    animateDiceResult(container, total, label, rolls?.[0]?.sides || 6, tone, contextLabel);
    return;
  }

  const normalizedRolls = rolls.map(roll => ({
    sides: DICE_SIDES.includes(Number(roll.sides)) ? Number(roll.sides) : 6,
    value: Number(roll.value)
  }));
  const reduced = shouldReduceMotion();
  const token = ++diceAnimationToken;
  const prepared = physicalPrepareDualShell(container, normalizedRolls, total, label, tone, contextLabel, reduced);
  const { shell, stage, scenes, copy, context, winnerIndexes, isTie } = prepared;
  const entries = scenes.map((scene, index) => physicalEntry(scene, normalizedRolls[index], index + 31));

  requestAnimationFrame(() => {
    const stageWidth = stage.clientWidth || 320;
    entries.forEach(entry => {
      const sceneWidth = entry.scene.offsetWidth || 164;
      entry.scene.style.left = `${(stageWidth - sceneWidth) / 2}px`;
    });
    const separation = Math.max(50, Math.min(64, stageWidth * 0.18));

    if (reduced) {
      physicalSetDualComparison(entries, winnerIndexes, isTie, separation);
      shell.setAttribute('aria-label', `${copy.textContent}. Rzuty: ${normalizedRolls.map(roll => roll.value).join(' i ')}. ${context.textContent}.`);
      triggerHaptic(resultHapticForTone(tone));
      return;
    }

    shell.setAttribute('aria-hidden', 'true');
    const started = performance.now();
    let previous = started;
    const travel = Math.max(92, Math.min(145, stageWidth / 2 - 28));
    const spins = entries.map((entry, index) => physicalInitialSpin(entry, index === 0 ? 1 : -1));
    const impactPoints = [0.48, 0.68, 0.86];
    let nextImpact = 0;
    let comparisonStarted = false;

    const tick = now => {
      if (token !== diceAnimationToken || !shell.isConnected) return;
      const progress = Math.min(1, (now - started) / PHYSICAL_DUAL_DICE_DURATION);
      const deltaSeconds = Math.min(0.034, Math.max(0, (now - previous) / 1000));
      previous = now;

      while (nextImpact < impactPoints.length && progress >= impactPoints[nextImpact]) {
        spins.forEach((spin, index) => physicalApplyImpact(spin, nextImpact, index === 0 ? 1 : -1));
        triggerHaptic(nextImpact === 0 ? 'impact' : 'tick');
        nextImpact += 1;
      }

      entries.forEach((entry, index) => {
        const side = index === 0 ? -1 : 1;
        const pose = physicalDualPose(progress, side, separation, travel, entry.seed, index);
        physicalAdvanceSpin(spins[index], entry.finalRotation, deltaSeconds, progress, pose);
        const reveal = progress < 0.88 ? 0 : physicalSmootherStep((progress - 0.88) / 0.10);
        const comparison = progress < 0.86 ? 0 : physicalSmootherStep((progress - 0.86) / 0.14);
        const winner = winnerIndexes.includes(index);
        const comparisonY = isTie ? 0 : winner ? -4 * comparison : 8 * comparison;
        const comparisonScale = isTie
          ? 0.91
          : winner
            ? physicalLerp(0.91, 0.96, comparison)
            : physicalLerp(0.91, 0.84, comparison);
        const comparisonOpacity = isTie || winner ? 1 : physicalLerp(1, 0.42, comparison);
        entry.object.dataset.faceReveal = String(reveal);
        physicalSetPose(entry, pose.x, pose.y + comparisonY, comparisonScale, comparisonOpacity);
        physicalPaintEntry(entry, spins[index].rotation, pose.y * 0.055);
      });

      if (!comparisonStarted && progress >= 0.86) {
        comparisonStarted = true;
        shell.classList.add('comparing');
        copy.textContent = isTie ? `Remis: ${total} ${label}` : `Wyższy wynik: ${total} ${label}`;
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
        return;
      }

      physicalSetDualComparison(entries, winnerIndexes, isTie, separation, spins.map(spin => spin.rotation));
      shell.removeAttribute('aria-hidden');
      shell.classList.remove('rolling');
      shell.classList.add('settled', 'comparing');
      shell.setAttribute('aria-label', `${copy.textContent}. Rzuty: ${normalizedRolls.map(roll => roll.value).join(' i ')}. ${context.textContent}.`);
      triggerHaptic(resultHapticForTone(tone));
    };

    requestAnimationFrame(tick);
  });
}

openItemDamageResultSheet = function openItemDamageResultSheetWithPhysicalDice(item, result, options = {}) {
  const mode = options.mode || (options.impaired === true ? 'impaired' : 'normal');
  const modeLabel = mode === 'impaired' ? 'Atak osłabiony' : mode === 'enhanced' ? 'Atak wzmocniony' : 'Atak trafia automatycznie';
  const notation = mode === 'impaired' ? 'k4' : mode === 'enhanced' ? 'k12' : result.notation;
  const resultPanel = createEl('div', { className: 'dice-result', attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' } });
  const body = createEl('div', { className: 'sheet-list item-damage-result' }, [
    resultPanel,
    createEl('div', { className: 'report-block' }, [
      createEl('span', { className: 'section-kicker', text: modeLabel }),
      createEl('strong', { text: `${item.name} · ${notation}` }),
      createEl('p', { className: 'muted small', text: 'Przekaż wynik Wardenowi. Pancerz celu i skutki obrażeń są rozpatrywane osobno.' })
    ])
  ]);
  const footer = createEl('div', { className: 'button-row' }, [
    button('Historia', () => transitionFromSheet(openDiceHistorySheet), 'btn btn-ghost'),
    button('Gotowe', closeSheet, 'btn btn-primary')
  ]);
  openSheet({ title: 'Obrażenia broni', body, footer });

  const usesHighestOfTwo = mode === 'normal'
    && result?.formula?.keep === 'highest'
    && Array.isArray(result.rolls)
    && result.rolls.length === 2;

  if (usesHighestOfTwo) {
    const diceContext = result.rolls[0]?.sides === result.rolls[1]?.sides
      ? `${item.name} · 2${physicalNotation(result.rolls[0].sides)}, zachowaj wyższy`
      : `${item.name} · ${notation}, zachowaj wyższy`;
    animateHighestDamageDice(resultPanel, result.rolls, result.total, 'obrażeń', 'success', diceContext);
    return;
  }

  const resultSides = mode === 'impaired' ? 4 : mode === 'enhanced' ? 12 : (result.rolls?.[0]?.sides || 6);
  animateDiceResult(resultPanel, result.total, 'obrażeń', resultSides, 'success', `${item.name} · ${notation}`);
};

