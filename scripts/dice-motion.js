'use strict';

const PHYSICAL_DICE_DURATION = 1680;
const PHYSICAL_DUAL_DICE_DURATION = 1980;
const PHYSICAL_DICE_IMPACTS = Object.freeze([0.58, 0.76, 0.89]);
const PHYSICAL_D10_CACHE = new Map();
const baseCreateDieMesh = createDieMesh;

const PHYSICAL_DICE_RULES = [
  `.animated-dice-result, .dual-dice-result { width: 100%; max-width: 100%; min-width: 0; display: grid; justify-items: center; gap: 3px; text-align: center; }`,
  `.animated-dice-result { overflow: visible; }`,
  `.result-die-scene.die-motion-stage { position: relative; width: min(100%, 360px); height: 178px; overflow: visible; isolation: isolate; }`,
  `.die-motion-stage::before, .dual-dice-stage::before { content: ""; position: absolute; z-index: 0; left: 50%; bottom: 12px; width: min(82%, 270px); height: 54px; border-radius: 50%; transform: translateX(-50%); background: radial-gradient(ellipse at center, rgba(7, 10, 7, .22) 0 18%, rgba(7, 10, 7, .09) 42%, transparent 72%); pointer-events: none; }`,
  `:root[data-theme="light"] .die-motion-stage::before, :root[data-theme="light"] .dual-dice-stage::before { background: radial-gradient(ellipse at center, rgba(52, 55, 42, .16) 0 18%, rgba(52, 55, 42, .06) 44%, transparent 74%); }`,
  `.die-motion-stage .result-die-object, .dual-dice-stage .result-die-object { z-index: 2; will-change: transform, opacity; transform-origin: 50% 68%; }`,
  `.die-motion-stage .result-die-shadow, .dual-dice-stage .result-die-shadow { z-index: 1; right: auto; left: 50%; bottom: 14px; width: 100px; height: 12px; margin-left: -50px; background: rgba(0, 0, 0, .38); filter: blur(6px); will-change: transform, opacity, filter; }`,
  `.result-die-object[data-sides="4"] { width: 124px; height: 124px; }`,
  `.result-die-object[data-sides="6"] { width: 144px; height: 144px; }`,
  `.result-die-object[data-sides="8"] { width: 150px; height: 150px; }`,
  `.result-die-object[data-sides="10"] { width: 154px; height: 154px; }`,
  `.result-die-object[data-sides="12"] { width: 160px; height: 160px; }`,
  `.result-die-object[data-sides="20"] { width: 164px; height: 164px; }`,
  `.result-die-object[data-sides="100"] { width: 164px; height: 154px; }`,
  `.result-die-object[data-sides="100"] .percentile-die { width: 112px; height: 112px; top: 16px; bottom: auto; }`,
  `.result-die-object[data-sides="100"] .percentile-die-first { right: auto; left: -4px; }`,
  `.result-die-object[data-sides="100"] .percentile-die-second { right: -4px; left: auto; top: 28px; }`,
  `.result-die-value { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }`,
  `.result-die-notation { display: none !important; }`,
  `.result-die-copy { min-height: 22px; }`,
  `.result-die-context { min-height: 18px; color: var(--text-faint); font-size: .72rem; letter-spacing: .01em; }`,
  `.animated-dice-result.rolling .result-die-copy, .dual-dice-result.rolling .result-die-copy { opacity: .66; }`,
  `.animated-dice-result.settled .result-die-copy, .dual-dice-result.settled .result-die-copy { animation: result-copy-in 240ms ease-out; }`,
  `.dual-dice-stage { position: relative; width: min(100%, 360px); height: 178px; overflow: visible; isolation: isolate; }`,
  `.dual-dice-stage .result-die-scene { position: absolute; top: 0; left: 0; width: 164px; height: 172px; display: grid; place-items: center; }`,
  `.dual-dice-result .damage-die-loser { pointer-events: none; }`,
  `.dual-dice-result.comparing .damage-die-winner .result-die-object { filter: saturate(1.06) brightness(1.04); }`,
  `.dual-dice-result.comparing .damage-die-winner::after { content: "wyższy"; position: absolute; z-index: 4; left: 50%; bottom: 2px; transform: translateX(-50%); padding: 2px 8px; border: 1px solid color-mix(in srgb, var(--character-gold, var(--brass)) 68%, transparent); border-radius: 999px; background: color-mix(in srgb, var(--surface-raised) 86%, transparent); color: var(--character-gold, var(--brass-bright)); font-size: .62rem; font-weight: 760; letter-spacing: .06em; text-transform: uppercase; }`,
  `.dual-dice-result.comparing.is-tie .damage-die-winner::after { content: "remis"; }`,
  `:root[data-reduce-motion="true"] .die-motion-stage .result-die-object, :root[data-reduce-motion="true"] .die-motion-stage .result-die-shadow, :root[data-reduce-motion="true"] .dual-dice-stage .result-die-object, :root[data-reduce-motion="true"] .dual-dice-stage .result-die-shadow { transition: none !important; }`,
  `@media (max-width: 350px) { .dual-dice-stage { transform: scale(.9); transform-origin: center top; margin-bottom: -17px; } .result-die-context { font-size: .68rem; } }`,
  `@media (prefers-reduced-motion: reduce) { .die-motion-stage .result-die-object, .die-motion-stage .result-die-shadow, .dual-dice-stage .result-die-object, .dual-dice-stage .result-die-shadow { transition: none !important; } }`
];

function installPhysicalDiceStyles() {
  if (document.documentElement.dataset.physicalDice === 'true') return;
  const sheet = [...document.styleSheets].find(entry => entry.href?.endsWith('/styles/app.css'));
  if (!sheet) {
    requestAnimationFrame(installPhysicalDiceStyles);
    return;
  }
  document.documentElement.dataset.physicalDice = 'true';
  for (const rule of PHYSICAL_DICE_RULES) {
    try { sheet.insertRule(rule, sheet.cssRules.length); }
    catch (_) {}
  }
}

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

function drawPhysicalTexture(context, entry, sides, isLight, canvas) {
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
  for (let index = 0; index < 6; index += 1) {
    const x = physicalLerp(minX, maxX, physicalHash(seedBase + index * 2));
    const y = physicalLerp(minY, maxY, physicalHash(seedBase + index * 2 + 1));
    const radius = 0.45 + physicalHash(seedBase + index + 20) * 1.15;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = isLight
      ? `rgba(38, 54, 33, ${0.018 + physicalHash(seedBase + index + 40) * 0.025})`
      : `rgba(221, 232, 205, ${0.014 + physicalHash(seedBase + index + 40) * 0.022})`;
    context.fill();
  }
  context.restore();
}

function drawPhysicalFaceValue(context, face, label, reveal, isLight) {
  const points = face.points;
  const centroid = physicalFaceCentroid(points);
  const area = physicalFaceArea(points);
  const angle = physicalFaceTextAngle(points);
  const sizeFactor = label.length > 1 ? 0.50 : 0.68;
  const fontSize = physicalClamp(Math.sqrt(area) * sizeFactor, 16, label.length > 1 ? 34 : 43);
  const scale = 0.94 + reveal * 0.06;

  context.save();
  physicalPath(context, points);
  context.clip();
  context.translate(centroid[0], centroid[1]);
  context.rotate(angle);
  context.scale(scale, scale);
  context.globalAlpha = reveal;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `700 ${fontSize}px Georgia, "Times New Roman", serif`;
  context.lineJoin = 'round';
  context.lineWidth = Math.max(0.8, fontSize * 0.038);
  context.strokeStyle = isLight ? 'rgba(31, 43, 27, .64)' : 'rgba(15, 25, 16, .76)';
  context.strokeText(label, 0, fontSize * 0.035);
  context.shadowColor = 'rgba(8, 15, 9, .42)';
  context.shadowBlur = Math.max(1, fontSize * 0.035);
  context.shadowOffsetY = Math.max(0.7, fontSize * 0.022);
  context.fillStyle = 'rgba(255, 255, 255, .98)';
  context.fillText(label, 0, fontSize * 0.035);
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
    const perspective = 4.25 / (4.25 - point[2]);
    return [center + point[0] * radius * perspective, center + lift + point[1] * radius * perspective];
  };
  const light = vectorNormalize([-0.48, -0.68, 0.72]);
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
    const brightness = physicalClamp(0.30 + lightDot * 0.70, 0.30, 1);
    const xs = entry.points.map(point => point[0]);
    const ys = entry.points.map(point => point[1]);
    const gradient = context.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    const percentileShift = canvas.classList.contains('percentile-die-first') ? 2.5 : canvas.classList.contains('percentile-die-second') ? -1.5 : 0;
    const baseLightness = (isLight ? 38 + brightness * 17 : 25 + brightness * 18) + percentileShift;
    gradient.addColorStop(0, `hsl(91 24% ${Math.min(62, baseLightness + 3.5)}%)`);
    gradient.addColorStop(0.55, `hsl(94 22% ${baseLightness}%)`);
    gradient.addColorStop(1, `hsl(86 25% ${Math.max(20, baseLightness - 4)}%)`);

    physicalPath(context, entry.points);
    context.fillStyle = gradient;
    context.fill();
    drawPhysicalTexture(context, entry, mesh.sides, isLight, canvas);

    physicalPath(context, entry.points);
    context.lineWidth = 1.35;
    context.strokeStyle = isLight ? 'rgba(35, 49, 30, .72)' : 'rgba(15, 27, 17, .86)';
    context.stroke();
    if (lightDot > 0.56) {
      physicalPath(context, entry.points);
      context.lineWidth = 0.55;
      context.strokeStyle = `rgba(226, 238, 207, ${0.08 + lightDot * 0.12})`;
      context.stroke();
    }
  }

  const object = canvas.closest?.('.result-die-object');
  const value = Number(object?.dataset?.value);
  const defaultReveal = object?.classList?.contains('is-tumbling') ? 0 : 1;
  const reveal = physicalClamp(Number(object?.dataset?.faceReveal ?? defaultReveal));
  if (reveal > 0 && Number.isFinite(value) && visibleFaces.length) {
    const frontFace = visibleFaces.reduce((best, entry) => {
      const score = entry.normal[2] * 0.88 + Math.min(0.34, entry.area / 3300) + entry.depth * 0.08;
      return !best || score > best.score ? { entry, score } : best;
    }, null)?.entry;
    if (frontFace) {
      context.save();
      physicalPath(context, frontFace.points);
      context.fillStyle = `rgba(238, 246, 222, ${reveal * 0.045})`;
      context.fill();
      context.restore();
      drawPhysicalFaceValue(context, frontFace, physicalFaceLabel(canvas, sides, value), reveal, isLight);
    }
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
  const finalX = physicalSignedHash(seed + 3) * 12;
  const flightHeight = 46 + physicalHash(seed + 4) * 10;
  if (progress < PHYSICAL_DICE_IMPACTS[0]) {
    const phase = progress / PHYSICAL_DICE_IMPACTS[0];
    const eased = physicalEaseOutCubic(phase);
    return {
      x: physicalLerp(-travel - 24, finalX - 30, eased),
      y: -Math.sin(phase * Math.PI) * flightHeight - (1 - phase) * 9,
      scale: 0.96 + phase * 0.04
    };
  }
  if (progress < PHYSICAL_DICE_IMPACTS[1]) {
    const phase = (progress - PHYSICAL_DICE_IMPACTS[0]) / (PHYSICAL_DICE_IMPACTS[1] - PHYSICAL_DICE_IMPACTS[0]);
    return {
      x: physicalLerp(finalX - 30, finalX - 7, physicalEaseOutCubic(phase)),
      y: -Math.sin(phase * Math.PI) * (24 + physicalHash(seed + 5) * 5),
      scale: 1
    };
  }
  if (progress < PHYSICAL_DICE_IMPACTS[2]) {
    const phase = (progress - PHYSICAL_DICE_IMPACTS[1]) / (PHYSICAL_DICE_IMPACTS[2] - PHYSICAL_DICE_IMPACTS[1]);
    return {
      x: physicalLerp(finalX - 7, finalX + 4, physicalEaseOutCubic(phase)),
      y: -Math.sin(phase * Math.PI) * (9 + physicalHash(seed + 6) * 3),
      scale: 1
    };
  }
  const phase = (progress - PHYSICAL_DICE_IMPACTS[2]) / (1 - PHYSICAL_DICE_IMPACTS[2]);
  return {
    x: physicalLerp(finalX + 4, finalX, physicalEaseOutCubic(phase)),
    y: -Math.abs(Math.sin(phase * Math.PI * 2)) * (1 - phase) * 3.5,
    scale: 1
  };
}

function physicalInitialSpin(entry, direction = 1) {
  return {
    rotation: {
      x: entry.finalRotation.x + direction * Math.PI * (2.8 + physicalHash(entry.seed + 8) * 1.4),
      y: entry.finalRotation.y + Math.PI * (3.6 + physicalHash(entry.seed + 9) * 1.8),
      z: entry.finalRotation.z + direction * Math.PI * (1.2 + physicalHash(entry.seed + 10) * 0.8)
    },
    velocity: {
      x: direction * (8.2 + physicalHash(entry.seed + 11) * 2.6),
      y: 10.4 + physicalHash(entry.seed + 12) * 2.8,
      z: direction * (4.0 + physicalHash(entry.seed + 13) * 1.8)
    }
  };
}

function physicalApplyImpact(spin, impactIndex, direction = 1) {
  const strength = [1, 0.55, 0.28][impactIndex] || 0.2;
  spin.velocity.x = -spin.velocity.x * (0.30 + strength * 0.15) + direction * strength * 1.8;
  spin.velocity.y = spin.velocity.y * (0.42 + strength * 0.14);
  spin.velocity.z = -spin.velocity.z * (0.28 + strength * 0.18);
}

function physicalAdvanceSpin(spin, finalRotation, deltaSeconds, progress) {
  const damping = Math.exp(-deltaSeconds * (1.25 + progress * 2.6));
  spin.velocity.x *= damping;
  spin.velocity.y *= damping;
  spin.velocity.z *= damping;
  spin.rotation.x += spin.velocity.x * deltaSeconds;
  spin.rotation.y += spin.velocity.y * deltaSeconds;
  spin.rotation.z += spin.velocity.z * deltaSeconds;
  if (progress > 0.80) {
    const settle = physicalSmoothStep((progress - 0.80) / 0.20);
    const blend = 0.035 + settle * 0.18;
    spin.rotation.x = physicalLerp(spin.rotation.x, finalRotation.x, blend);
    spin.rotation.y = physicalLerp(spin.rotation.y, finalRotation.y, blend);
    spin.rotation.z = physicalLerp(spin.rotation.z, finalRotation.z, blend);
  }
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

    physicalAdvanceSpin(spin, entry.finalRotation, deltaSeconds, progress);
    const pose = physicalSinglePose(progress, travel, entry.seed);
    const reveal = progress < 0.84 ? 0 : physicalSmoothStep((progress - 0.84) / 0.14);
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
    const finalX = physicalSignedHash(entry.seed + 3) * 12;
    physicalSetPose(entry, finalX, 0, 1, 1);
    physicalPaintEntry(entry, entry.finalRotation);
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
  const firstImpact = 0.52;
  const secondImpact = 0.71;
  const thirdImpact = 0.83;
  const target = side * separation;
  if (progress < firstImpact) {
    const phase = progress / firstImpact;
    return {
      x: physicalLerp(side * (travel + 18), target + side * 20, physicalEaseOutCubic(phase)),
      y: -Math.sin(phase * Math.PI) * (42 + physicalHash(seed + 2) * 10) - (1 - phase) * (7 + index * 3)
    };
  }
  if (progress < secondImpact) {
    const phase = (progress - firstImpact) / (secondImpact - firstImpact);
    return {
      x: physicalLerp(target + side * 20, target + side * 6, physicalEaseOutCubic(phase)),
      y: -Math.sin(phase * Math.PI) * (20 + physicalHash(seed + 3) * 5)
    };
  }
  if (progress < thirdImpact) {
    const phase = (progress - secondImpact) / (thirdImpact - secondImpact);
    return {
      x: physicalLerp(target + side * 6, target, physicalEaseOutCubic(phase)),
      y: -Math.sin(phase * Math.PI) * (8 + physicalHash(seed + 4) * 3)
    };
  }
  const phase = (progress - thirdImpact) / (1 - thirdImpact);
  return {
    x: target,
    y: -Math.abs(Math.sin(phase * Math.PI * 2)) * (1 - phase) * 2.5
  };
}

function physicalSetDualComparison(entries, winnerIndexes, isTie, separation) {
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
    physicalPaintEntry(entry, entry.finalRotation);
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
    const impactPoints = [0.52, 0.71, 0.83];
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
        physicalAdvanceSpin(spins[index], entry.finalRotation, deltaSeconds, progress);
        const pose = physicalDualPose(progress, side, separation, travel, entry.seed, index);
        const reveal = progress < 0.76 ? 0 : physicalSmoothStep((progress - 0.76) / 0.14);
        const comparison = progress < 0.84 ? 0 : physicalSmoothStep((progress - 0.84) / 0.16);
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

      if (!comparisonStarted && progress >= 0.84) {
        comparisonStarted = true;
        shell.classList.add('comparing');
        copy.textContent = isTie ? `Remis: ${total} ${label}` : `Wyższy wynik: ${total} ${label}`;
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
        return;
      }

      physicalSetDualComparison(entries, winnerIndexes, isTie, separation);
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

installPhysicalDiceStyles();
