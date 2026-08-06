'use strict';

(() => {
  const LOCK_START = 0.70;
  const GLYPH_OVERSAMPLE = 4;

  const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
  const seeded = seed => {
    const value = Math.sin(Number(seed) * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  function boundsFor(points) {
    const xs = points.map(point => point[0]);
    const ys = points.map(point => point[1]);
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }

  function heroRotation(sides) {
    const presets = {
      4: { x: -0.38, y: 0.44, z: 0.01 },
      6: { x: -0.31, y: 0.42, z: -0.02 },
      8: { x: -0.36, y: 0.41, z: 0.02 },
      10: { x: -0.32, y: 0.36, z: -0.04 },
      12: { x: -0.48, y: 0.27, z: 0.08 },
      20: { x: -0.46, y: 0.30, z: -0.04 },
      100: { x: -0.31, y: 0.35, z: 0.03 }
    };
    return presets[Number(sides)] || presets[20];
  }

  function advanceAndLockResult(spin, finalRotation, deltaSeconds, progress, pose, advanceSpin) {
    advanceSpin(spin, finalRotation, deltaSeconds, progress, pose);
    if (progress < LOCK_START) return;

    // Once the renderer enters its final pose, the result face must already be
    // exact. Position, lift and shadow may continue settling, but orientation
    // must not drift through another interpolation frame.
    spin.orientation = { ...spin.settleTarget };
    spin.rotation = physicalEulerFromQuat(spin.orientation);
  }

  function paintStableResult(entry, rotation, lift = 0, paintEntry) {
    if (entry?.object?.classList?.contains('is-tumbling')) entry.object.dataset.faceReveal = '0';
    return paintEntry(entry, rotation, lift);
  }

  function drawRefinedStone(context, face, sides) {
    if (!face?.points?.length) return;
    const bounds = boundsFor(face.points);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const centroid = physicalFaceCentroid(face.points);
    const seed = Math.round(centroid[0] * 31 + centroid[1] * 47 + Number(sides) * 67 + (face.faceIndex || 0) * 13);

    context.save();
    physicalPath(context, face.points);
    context.clip();

    const body = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
    body.addColorStop(0, 'rgba(248, 250, 229, .15)');
    body.addColorStop(.34, 'rgba(142, 160, 99, .045)');
    body.addColorStop(.72, 'rgba(22, 47, 28, .08)');
    body.addColorStop(1, 'rgba(3, 13, 7, .22)');
    context.fillStyle = body;
    context.fillRect(bounds.minX - 3, bounds.minY - 3, width + 6, height + 6);

    for (let index = 0; index < 18; index += 1) {
      const x = bounds.minX + width * (.08 + seeded(seed + index * 37) * .84);
      const y = bounds.minY + height * (.08 + seeded(seed + index * 43 + 5) * .84);
      const radius = .28 + seeded(seed + index * 53 + 9) * .65;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = index % 4 === 0 ? 'rgba(234, 226, 183, .12)' : 'rgba(9, 25, 12, .10)';
      context.fill();
    }

    const startY = bounds.minY + height * (.28 + seeded(seed + 101) * .38);
    context.beginPath();
    context.moveTo(bounds.minX - width * .05, startY);
    context.bezierCurveTo(
      bounds.minX + width * .28, startY - height * .18,
      bounds.minX + width * .66, startY + height * .16,
      bounds.maxX + width * .05, startY - height * .04
    );
    context.lineCap = 'round';
    context.lineWidth = .45;
    context.strokeStyle = 'rgba(230, 218, 171, .13)';
    context.stroke();

    const edgeLight = context.createRadialGradient(
      bounds.minX + width * .24,
      bounds.minY + height * .18,
      1,
      centroid[0],
      centroid[1],
      Math.max(width, height) * .88
    );
    edgeLight.addColorStop(0, 'rgba(255, 255, 241, .13)');
    edgeLight.addColorStop(.42, 'rgba(255, 255, 255, 0)');
    edgeLight.addColorStop(1, 'rgba(0, 0, 0, .09)');
    context.fillStyle = edgeLight;
    context.fillRect(bounds.minX - 2, bounds.minY - 2, width + 4, height + 4);
    context.restore();
  }

  function drawConsolidatedStone(context, face, sides, isLight, canvas, baseTexture) {
    baseTexture(context, face, sides, isLight, canvas);
    drawRefinedStone(context, face, sides);
  }

  function localFaceAngle(points) {
    const centroid = physicalFaceCentroid(points);
    const candidates = points.map((start, index) => {
      const end = points[(index + 1) % points.length];
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      let angle = Math.atan2(dy, dx);
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;
      const midpointY = (start[1] + end[1]) / 2;
      const length = Math.hypot(dx, dy);
      return { angle, score: Math.abs(angle) + (midpointY > centroid[1] ? .05 : 0) + 12 / Math.max(20, length) };
    });
    candidates.sort((left, right) => left.score - right.score);
    return physicalClamp(candidates[0]?.angle || 0, -.26, .26);
  }

  function glyphFontSize(face, label) {
    const area = physicalFaceArea(face.points);
    const factor = label.length > 1 ? .30 : .42;
    return physicalClamp(Math.sqrt(area) * factor, 12, label.length > 1 ? 23 : 31);
  }

  function renderGlyph(label, fontSize, reveal) {
    const padding = Math.ceil(fontSize * .44);
    const cssSize = Math.ceil(fontSize * 2.15 + padding * 2);
    const canvas = document.createElement('canvas');
    canvas.width = cssSize * GLYPH_OVERSAMPLE;
    canvas.height = cssSize * GLYPH_OVERSAMPLE;
    const context = canvas.getContext('2d');
    context.scale(GLYPH_OVERSAMPLE, GLYPH_OVERSAMPLE);
    context.translate(cssSize / 2, cssSize / 2);
    context.globalAlpha = clamp01(reveal);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.font = `700 ${fontSize}px "Palatino Linotype", Palatino, Georgia, serif`;

    context.lineWidth = Math.max(1.7, fontSize * .06);
    context.strokeStyle = 'rgba(5, 15, 8, .82)';
    context.shadowColor = 'rgba(0, 0, 0, .18)';
    context.shadowBlur = fontSize * .04;
    context.strokeText(label, 0, 0);

    const fill = context.createLinearGradient(0, -fontSize * .5, 0, fontSize * .5);
    fill.addColorStop(0, 'rgba(255, 254, 239, .99)');
    fill.addColorStop(.58, 'rgba(234, 232, 207, .99)');
    fill.addColorStop(1, 'rgba(184, 193, 155, .99)');
    context.fillStyle = fill;
    context.fillText(label, 0, 0);

    context.globalAlpha = clamp01(reveal) * .34;
    context.lineWidth = Math.max(.45, fontSize * .014);
    context.strokeStyle = 'rgba(255, 255, 241, .72)';
    context.strokeText(label, -fontSize * .012, -fontSize * .018);
    return { canvas, cssSize };
  }

  function drawConsolidatedFaceValue(context, face, label, reveal) {
    if (!face?.points?.length || reveal <= 0) return;
    const centroid = physicalFaceCentroid(face.points);
    const fontSize = glyphFontSize(face, label);
    const glyph = renderGlyph(label, fontSize, reveal);
    context.save();
    physicalPath(context, face.points);
    context.clip();
    context.translate(centroid[0], centroid[1]);
    context.rotate(localFaceAngle(face.points));
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(glyph.canvas, -glyph.cssSize / 2, -glyph.cssSize / 2, glyph.cssSize, glyph.cssSize);
    context.restore();
  }

  globalThis.CairnDiceRenderer.register({
    finalDieRotation: sides => ({ ...heroRotation(sides) }),
    physicalAdvanceSpin: advanceAndLockResult,
    physicalPaintEntry: paintStableResult,
    drawPhysicalTexture: drawConsolidatedStone,
    drawPhysicalFaceValue: drawConsolidatedFaceValue
  });

  document.documentElement.dataset.diceRenderer = 'consolidated';
})();
