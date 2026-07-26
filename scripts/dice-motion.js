'use strict';

const DICE_MOTION_DURATION = 2100;
const DICE_COLLISION_DURATION = 2300;
const DICE_COLLISION_AT = 0.48;

const DICE_MOTION_RULES = [
  `.animated-dice-result, .dual-dice-result { width: 100%; max-width: 100%; min-width: 0; }`,
  `.animated-dice-result { overflow: visible; }`,
  `.result-die-scene.die-motion-stage { width: min(100%, 360px); height: 158px; overflow: visible; }`,
  `.die-motion-stage .result-die-object, .die-motion-stage .result-die-shadow, .dual-dice-stage .result-die-scene { will-change: transform, opacity; }`,
  `.die-motion-stage .result-die-shadow { right: auto; left: 50%; width: 96px; margin-left: -48px; filter: blur(8px); }`,
  `.dual-dice-result { display: grid; justify-items: center; gap: 2px; text-align: center; }`,
  `.dual-dice-stage { position: relative; width: min(100%, 360px); height: 158px; overflow: visible; }`,
  `.dual-dice-stage .result-die-scene { position: absolute; top: 0; left: 0; }`,
  `.result-die-value { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }`,
  `.result-die-notation { bottom: 1px; color: var(--text-faint); font-size: .58rem; letter-spacing: .05em; opacity: .72; text-shadow: none; }`,
  `.dual-dice-result.settled .result-die-copy, .animated-dice-result.settled .result-die-copy { animation: result-copy-in 240ms ease-out; }`,
  `.dual-dice-result .damage-die-winner .result-die-notation { color: var(--text-soft); }`,
  `.dual-dice-result .damage-die-loser { pointer-events: none; }`,
  `:root[data-reduce-motion="true"] .die-motion-stage .result-die-object, :root[data-reduce-motion="true"] .die-motion-stage .result-die-shadow, :root[data-reduce-motion="true"] .dual-dice-stage .result-die-scene { transform: none !important; }`,
  `@media (prefers-reduced-motion: reduce) { .die-motion-stage .result-die-object, .die-motion-stage .result-die-shadow, .dual-dice-stage .result-die-scene { transform: none !important; } }`
];

function installDiceMotionStyles() {
  if (document.documentElement.dataset.diceMotion === 'true') return;
  const sheet = [...document.styleSheets].find(entry => entry.href?.endsWith('/styles/app.css'));
  if (!sheet) return;
  document.documentElement.dataset.diceMotion = 'true';
  for (const rule of DICE_MOTION_RULES) {
    try { sheet.insertRule(rule, sheet.cssRules.length); }
    catch (_) {}
  }
}

function diceMotionClamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function diceMotionLerp(from, to, progress) {
  return from + (to - from) * progress;
}

function diceMotionEaseOutCubic(progress) {
  const remaining = 1 - diceMotionClamp(progress);
  return 1 - remaining * remaining * remaining;
}

function diceMotionEaseInOutCubic(progress) {
  const value = diceMotionClamp(progress);
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function diceFaceArea(points) {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0)) / 2;
}

function diceFaceCentroid(points) {
  return points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
    .map(value => value / points.length);
}

function diceFaceTextAngle(points) {
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
  return angle;
}

function diceFaceLabel(canvas, sides, value) {
  if (Number(sides) !== 10 || !canvas?.classList?.contains('percentile-die')) return String(value);
  if (canvas.classList.contains('percentile-die-first')) {
    return Number(value) === 100 ? '00' : String(Math.floor(Number(value) / 10) * 10).padStart(2, '0');
  }
  return Number(value) === 100 ? '0' : String(Number(value) % 10);
}

function drawDieFaceTexture(context, points, faceIndex, brightness) {
  const centroid = diceFaceCentroid(points);
  context.save();
  context.beginPath();
  points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
  context.closePath();
  context.clip();
  context.fillStyle = `rgba(73, 48, 28, ${0.018 + (1 - brightness) * 0.025})`;
  for (let index = 0; index < 7; index += 1) {
    const angle = (faceIndex * 1.73 + index * 2.19) % (Math.PI * 2);
    const distance = 4 + ((faceIndex * 11 + index * 7) % 13);
    const radius = 0.45 + ((faceIndex + index * 3) % 4) * 0.22;
    context.beginPath();
    context.arc(centroid[0] + Math.cos(angle) * distance, centroid[1] + Math.sin(angle) * distance, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawDieFaceValue(context, face, label, isLight) {
  const points = face.points;
  const centroid = diceFaceCentroid(points);
  const area = diceFaceArea(points);
  const angle = diceFaceTextAngle(points);
  const sizeFactor = label.length > 1 ? 0.54 : 0.72;
  const fontSize = diceMotionClamp(Math.sqrt(area) * sizeFactor, 17, label.length > 1 ? 35 : 44);

  context.save();
  context.beginPath();
  points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
  context.closePath();
  context.clip();
  context.translate(centroid[0], centroid[1]);
  context.rotate(angle);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `700 ${fontSize}px Georgia, "Times New Roman", serif`;
  context.lineJoin = 'round';
  context.lineWidth = Math.max(1.2, fontSize * 0.07);
  context.strokeStyle = isLight ? 'rgba(255, 247, 225, .34)' : 'rgba(244, 225, 187, .24)';
  context.strokeText(label, 0, fontSize * 0.035);
  context.fillStyle = isLight ? 'rgba(54, 35, 24, .94)' : 'rgba(42, 29, 21, .95)';
  context.fillText(label, 0, fontSize * 0.035);
  context.restore();
}

paintResultDie = function paintResultDieAsCarvedBone(canvas, sides, rotation, lift = 0) {
  const context = canvas?.getContext?.('2d');
  if (!context) return false;
  const bounds = canvas.getBoundingClientRect();
  const cssSize = Math.max(104, Math.round(Math.min(bounds.width || 132, bounds.height || 132)));
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
  const radius = cssSize * (mesh.sides === 4 ? 0.42 : 0.39);
  const project = point => {
    const perspective = 3.8 / (3.8 - point[2]);
    return [center + point[0] * radius * perspective, center + lift + point[1] * radius * perspective];
  };
  const light = vectorNormalize([-0.42, -0.62, 0.82]);
  const isLight = document.documentElement.dataset.theme === 'light';
  const visibleFaces = mesh.faces.map((face, faceIndex) => {
    const [a, b, c] = face.map(index => transformed[index]);
    const normal = vectorNormalize(vectorCross(
      b.map((entry, axis) => entry - a[axis]),
      c.map((entry, axis) => entry - a[axis])
    ));
    const depth = face.reduce((sum, index) => sum + transformed[index][2], 0) / face.length;
    const points = face.map(index => project(transformed[index]));
    return { face, faceIndex, normal, depth, points, area: diceFaceArea(points) };
  }).filter(entry => entry.normal[2] > -0.03).sort((left, right) => left.depth - right.depth);

  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const entry of visibleFaces) {
    const brightness = diceMotionClamp(0.28 + Math.max(0, vectorDot(entry.normal, light)) * 0.72, 0.28, 1);
    const xs = entry.points.map(point => point[0]);
    const ys = entry.points.map(point => point[1]);
    const gradient = context.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    const baseLightness = isLight ? 58 + brightness * 20 : 43 + brightness * 21;
    gradient.addColorStop(0, `hsl(39 29% ${Math.min(83, baseLightness + 6)}%)`);
    gradient.addColorStop(0.58, `hsl(38 27% ${baseLightness}%)`);
    gradient.addColorStop(1, `hsl(35 25% ${Math.max(31, baseLightness - 8)}%)`);

    context.beginPath();
    entry.points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
    context.closePath();
    context.fillStyle = gradient;
    context.fill();
    drawDieFaceTexture(context, entry.points, entry.faceIndex, brightness);
    context.lineWidth = 2.15;
    context.strokeStyle = isLight ? 'rgba(78, 51, 31, .78)' : 'rgba(58, 39, 27, .88)';
    context.stroke();
    context.lineWidth = 0.7;
    context.strokeStyle = 'rgba(255, 241, 207, .28)';
    context.stroke();
  }

  const object = canvas.closest?.('.result-die-object');
  const value = Number(object?.dataset?.value);
  const showValue = object && !object.classList.contains('is-tumbling') && Number.isFinite(value);
  if (showValue && visibleFaces.length) {
    const frontFace = visibleFaces.reduce((best, entry) => {
      const score = entry.normal[2] * 0.72 + entry.depth * 0.18 + Math.min(0.22, entry.area / 4200);
      return !best || score > best.score ? { entry, score } : best;
    }, null)?.entry;
    if (frontFace) drawDieFaceValue(context, frontFace, diceFaceLabel(canvas, sides, value), isLight);
  }
  return true;
};

function diceMotionTravel(stage, object) {
  const stageWidth = stage?.clientWidth || stage?.getBoundingClientRect?.().width || 320;
  const objectWidth = object?.offsetWidth || object?.getBoundingClientRect?.().width || 136;
  return Math.max(72, Math.min(132, (stageWidth - objectWidth) / 2 - 4));
}

function diceMotionPaint(entry, rotation, lift = 0) {
  entry.canvases.forEach((canvas, index) => paintResultDie(
    canvas,
    entry.sides === 100 ? 10 : entry.sides,
    { ...rotation, x: rotation.x + index * 0.44, y: rotation.y + index * 0.72 },
    lift + (index ? 2 : -2)
  ));
}

function diceMotionEntry(scene, roll) {
  const sides = DICE_SIDES.includes(Number(roll.sides)) ? Number(roll.sides) : 6;
  const value = Number(roll.value);
  return {
    scene,
    object: scene.querySelector('.result-die-object'),
    shadow: scene.querySelector('.result-die-shadow'),
    number: scene.querySelector('.result-die-value'),
    canvases: [...scene.querySelectorAll('.result-die-canvas')],
    sides,
    value,
    finalRotation: finalDieRotation(sides, value)
  };
}

function diceMotionSetEntryPosition(entry, x, y, opacity = 1, scale = 1) {
  entry.scene.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  entry.scene.style.opacity = String(opacity);
  if (entry.shadow) {
    const height = Math.max(0, -y);
    entry.shadow.style.opacity = String(Math.max(0, opacity * (0.48 - Math.min(0.28, height * 0.012))));
    entry.shadow.style.transform = `scaleX(${0.9 - Math.min(0.3, height * 0.012)})`;
  }
}

function diceMotionSetObjectPosition(entry, x, y, shadowScale = 0.82) {
  entry.object.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  if (entry.shadow) {
    entry.shadow.style.transform = `translate3d(${x}px, 0, 0) scaleX(${shadowScale})`;
  }
}

animateDiceResult = function animateDiceResultWithTrajectory(container, value, label, sides = 6, tone = 'neutral') {
  if (!container) return;
  const token = ++diceAnimationToken;
  const numericSides = DICE_SIDES.includes(Number(sides)) ? Number(sides) : 6;
  const reduced = shouldReduceMotion();
  const shell = createDiceResultVisual(value, label, numericSides, tone, !reduced);
  const scene = shell.querySelector('.result-die-scene');
  const copy = shell.querySelector('.result-die-copy');
  const entry = diceMotionEntry(scene, { sides: numericSides, value });
  scene.classList.add('die-motion-stage');
  if (!reduced) shell.setAttribute('aria-hidden', 'true');
  container.replaceChildren(shell);

  if (reduced) {
    triggerHaptic(resultHapticForTone(tone));
    return;
  }

  const started = performance.now();
  const travel = diceMotionTravel(scene, entry.object);
  let nextHapticTick = 0;
  let edgeImpactTriggered = false;

  const tick = now => {
    if (token !== diceAnimationToken || !shell.isConnected) return;
    const progress = Math.min(1, (now - started) / DICE_MOTION_DURATION);
    let x;
    let y;
    let rollingProgress;

    if (progress < 0.54) {
      const phase = progress / 0.54;
      const eased = diceMotionEaseInOutCubic(phase);
      x = diceMotionLerp(-travel, travel, eased);
      y = -Math.abs(Math.sin(phase * Math.PI * 3.15)) * (21 - phase * 7);
      rollingProgress = phase * 0.58;
    } else if (progress < 0.72) {
      const phase = (progress - 0.54) / 0.18;
      const eased = diceMotionEaseOutCubic(phase);
      x = diceMotionLerp(travel, travel * 0.27, eased);
      y = -Math.sin(phase * Math.PI) * 31;
      rollingProgress = 0.58 + phase * 0.2;
      if (!edgeImpactTriggered) {
        edgeImpactTriggered = true;
        triggerHaptic('impact');
      }
    } else {
      const phase = (progress - 0.72) / 0.28;
      const eased = diceMotionEaseOutCubic(phase);
      const spring = Math.sin(phase * Math.PI * 4) * (1 - phase) * 14;
      x = diceMotionLerp(travel * 0.27, 0, eased) + spring;
      y = -Math.abs(Math.sin(phase * Math.PI * 3)) * (1 - phase) * 18;
      rollingProgress = 0.78 + phase * 0.22;
    }

    const remaining = 1 - rollingProgress;
    const rotation = {
      x: entry.finalRotation.x + remaining * Math.PI * 3.2,
      y: entry.finalRotation.y + remaining * Math.PI * 4.4,
      z: entry.finalRotation.z + remaining * Math.PI * 1.5
    };
    diceMotionSetObjectPosition(entry, x, y, 0.58 + (1 - Math.min(1, Math.abs(y) / 32)) * 0.3);
    diceMotionPaint(entry, rotation, y * 0.08);

    while (nextHapticTick < DIE_HAPTIC_TICKS.length && progress >= DIE_HAPTIC_TICKS[nextHapticTick]) {
      triggerHaptic('tick');
      nextHapticTick += 1;
    }

    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }

    entry.number.textContent = String(value);
    copy.textContent = label;
    shell.removeAttribute('aria-hidden');
    shell.classList.remove('rolling');
    shell.classList.add('settled');
    entry.object.classList.remove('is-tumbling');
    diceMotionSetObjectPosition(entry, 0, 0);
    diceMotionPaint(entry, entry.finalRotation);
    triggerHaptic(resultHapticForTone(tone));
  };

  requestAnimationFrame(tick);
};

function animateHighestDamageDice(container, rolls, total, label = 'obrażeń', tone = 'success') {
  if (!container || !Array.isArray(rolls) || rolls.length !== 2) {
    animateDiceResult(container, total, label, rolls?.[0]?.sides || 6, tone);
    return;
  }

  const normalizedRolls = rolls.map(roll => ({
    sides: DICE_SIDES.includes(Number(roll.sides)) ? Number(roll.sides) : 6,
    value: Number(roll.value)
  }));
  const winnerIndex = normalizedRolls.findIndex(roll => roll.value === Number(total));
  const resolvedWinnerIndex = winnerIndex >= 0 ? winnerIndex : 0;
  const loserIndex = resolvedWinnerIndex === 0 ? 1 : 0;
  const reduced = shouldReduceMotion();

  if (reduced) {
    container.replaceChildren(createDiceResultVisual(
      normalizedRolls[resolvedWinnerIndex].value,
      label,
      normalizedRolls[resolvedWinnerIndex].sides,
      tone,
      false
    ));
    triggerHaptic(resultHapticForTone(tone));
    return;
  }

  const token = ++diceAnimationToken;
  const scenes = normalizedRolls.map((roll, index) => {
    const scene = createResultDie(roll.value, roll.sides, true);
    scene.classList.add('damage-die-scene', index === resolvedWinnerIndex ? 'damage-die-winner' : 'damage-die-loser');
    scene.dataset.rollIndex = String(index);
    return scene;
  });
  const stage = createEl('div', { className: 'dual-dice-stage' }, scenes);
  const copy = createEl('span', { className: 'result-die-copy', text: 'Kości w ruchu…' });
  const shell = createEl('div', {
    className: 'dual-dice-result rolling',
    attrs: { 'data-tone': tone, 'aria-hidden': 'true' }
  }, [stage, copy]);
  container.replaceChildren(shell);

  const entries = scenes.map((scene, index) => diceMotionEntry(scene, normalizedRolls[index]));
  const started = performance.now();
  let collisionTriggered = false;
  let nextHapticTick = 0;

  requestAnimationFrame(() => {
    const stageWidth = stage.clientWidth || 320;
    entries.forEach(entry => {
      const sceneWidth = entry.scene.offsetWidth || 152;
      entry.scene.style.left = `${(stageWidth - sceneWidth) / 2}px`;
    });
    const travel = Math.max(82, Math.min(138, (stageWidth - (entries[0].object.offsetWidth || 136)) / 2 - 2));
    const collisionOffset = Math.min(52, (entries[0].object.offsetWidth || 136) * 0.38);

    const tick = now => {
      if (token !== diceAnimationToken || !shell.isConnected) return;
      const progress = Math.min(1, (now - started) / DICE_COLLISION_DURATION);
      const beforeCollision = progress < DICE_COLLISION_AT;
      const pre = diceMotionClamp(progress / DICE_COLLISION_AT);
      const post = diceMotionClamp((progress - DICE_COLLISION_AT) / (1 - DICE_COLLISION_AT));
      const preEased = diceMotionEaseInOutCubic(pre);

      entries.forEach((entry, index) => {
        const side = index === 0 ? -1 : 1;
        const collisionX = side * collisionOffset;
        let x;
        let y;
        let opacity = 1;
        let scale = 1;
        let rollingProgress;

        if (beforeCollision) {
          x = diceMotionLerp(side * travel, collisionX, preEased);
          y = -Math.abs(Math.sin(pre * Math.PI * 2.2 + index * 0.35)) * (19 - pre * 5);
          rollingProgress = pre * 0.52;
        } else if (index === resolvedWinnerIndex) {
          const eased = diceMotionEaseOutCubic(post);
          const horizontalSpring = -side * Math.sin(post * Math.PI * 4) * (1 - post) * 17;
          x = diceMotionLerp(collisionX, 0, eased) + horizontalSpring;
          y = -Math.abs(Math.sin(post * Math.PI * 3)) * (1 - post) * 22;
          rollingProgress = 0.52 + post * 0.48;
        } else {
          const eased = diceMotionEaseOutCubic(post);
          x = diceMotionLerp(collisionX, side * travel * 1.05, eased);
          y = -Math.sin(post * Math.PI) * 40 + Math.abs(Math.sin(post * Math.PI * 2.4)) * (1 - post) * -10 + post * 18;
          opacity = 1 - diceMotionClamp((post - 0.18) / 0.62);
          scale = 1 - post * 0.24;
          rollingProgress = 0.52 + post * 0.48;
        }

        const remaining = 1 - rollingProgress;
        const rotation = {
          x: entry.finalRotation.x + remaining * Math.PI * (index === 0 ? 3.4 : -3.1),
          y: entry.finalRotation.y + remaining * Math.PI * (index === 0 ? 4.6 : -4.2),
          z: entry.finalRotation.z + remaining * Math.PI * (index === 0 ? 1.7 : -1.6)
        };
        diceMotionSetEntryPosition(entry, x, y, opacity, scale);
        diceMotionPaint(entry, rotation, y * 0.08);
      });

      if (!collisionTriggered && progress >= DICE_COLLISION_AT) {
        collisionTriggered = true;
        triggerHaptic('impact');
      }

      while (nextHapticTick < DIE_HAPTIC_TICKS.length && progress >= DIE_HAPTIC_TICKS[nextHapticTick]) {
        triggerHaptic('tick');
        nextHapticTick += 1;
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
        return;
      }

      const winner = entries[resolvedWinnerIndex];
      entries[loserIndex].scene.remove();
      winner.number.textContent = String(winner.value);
      diceMotionSetEntryPosition(winner, 0, 0, 1, 1);
      winner.object.classList.remove('is-tumbling');
      diceMotionPaint(winner, winner.finalRotation);
      copy.textContent = label;
      shell.removeAttribute('aria-hidden');
      shell.classList.remove('rolling');
      shell.classList.add('settled');
      triggerHaptic(resultHapticForTone(tone));
    };

    requestAnimationFrame(tick);
  });
}

openItemDamageResultSheet = function openItemDamageResultSheetWithCollision(item, result, options = {}) {
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
    animateHighestDamageDice(resultPanel, result.rolls, result.total, 'obrażeń', 'success');
    return;
  }

  animateDiceResult(
    resultPanel,
    result.total,
    'obrażeń',
    mode === 'impaired' ? 4 : mode === 'enhanced' ? 12 : (result.rolls?.[0]?.sides || 6),
    'success'
  );
};

installDiceMotionStyles();