'use strict';

(() => {
  const LOCK_START = 0.72;
  const LOCK_END = 0.84;
  const GLYPH_OVERSAMPLE = 4;

  const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
  const seeded = seed => {
    const value = Math.sin(Number(seed) * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  function boundsFor(points) {
    const xs = points.map(point => point[0]);
    const ys = points.map(point => point[1]);
    return {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: Math.min(...ys), maxY: Math.max(...ys)
    };
  }

  function heroRotation(sides) {
    const presets = {
      4: { x: -0.38, y: 0.44, z: 0 }, 6: { x: -0.31, y: 0.42, z: 0 },
      8: { x: -0.36, y: 0.41, z: 0 }, 10: { x: -0.34, y: 0.40, z: 0 },
      12: { x: -0.33, y: 0.39, z: 0 }, 20: { x: -0.34, y: 0.40, z: 0 },
      100: { x: -0.32, y: 0.41, z: 0 }
    };
    return presets[Number(sides)] || presets[20];
  }


  function advanceAndLockResult(spin, finalRotation, deltaSeconds, progress, pose, advanceSpin) {
      advanceSpin(spin, finalRotation, deltaSeconds, progress, pose);
      if (progress < LOCK_START) return;
      if (!spin.rendererLockFrom) spin.rendererLockFrom = { ...spin.orientation };
      const phase = physicalClamp((progress - LOCK_START) / (LOCK_END - LOCK_START));
      spin.orientation = physicalQuatSlerp(spin.rendererLockFrom, spin.settleTarget, physicalSmootherStep(phase));
      if (progress >= LOCK_END) spin.orientation = { ...spin.settleTarget };
      spin.rotation = physicalEulerFromQuat(spin.orientation);
  }

  function paintStableResult(entry, rotation, lift = 0, paintEntry) {
      if (entry?.object?.classList?.contains('is-tumbling')) entry.object.dataset.faceReveal = '0';
      return paintEntry(entry, rotation, lift);
  }

  function drawPremiumStone(context, face, sides) {
    if (!face?.points?.length) return;
    const bounds = boundsFor(face.points);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const centroid = physicalFaceCentroid(face.points);
    const seed = Math.round(centroid[0] * 37 + centroid[1] * 53 + Number(sides) * 71 + (face.faceIndex || 0) * 11);

    context.save();
    physicalPath(context, face.points);
    context.clip();

    const body = context.createRadialGradient(bounds.minX + width * 0.28, bounds.minY + height * 0.18, 1, centroid[0], centroid[1], Math.max(width, height) * 0.88);
    body.addColorStop(0, 'rgba(244, 249, 218, .16)');
    body.addColorStop(0.28, 'rgba(144, 168, 96, .055)');
    body.addColorStop(0.72, 'rgba(30, 62, 32, .07)');
    body.addColorStop(1, 'rgba(4, 18, 9, .24)');
    context.fillStyle = body;
    context.fillRect(bounds.minX - 4, bounds.minY - 4, width + 8, height + 8);

    for (let index = 0; index < 8; index += 1) {
      const a = seeded(seed + index * 17);
      const b = seeded(seed + index * 29 + 3);
      const c = seeded(seed + index * 41 + 7);
      context.beginPath();
      context.moveTo(bounds.minX - width * 0.12, bounds.minY + height * (0.06 + a * 0.88));
      context.bezierCurveTo(
        bounds.minX + width * (0.20 + b * 0.18), bounds.minY + height * (0.02 + c * 0.70),
        bounds.minX + width * (0.68 + c * 0.16), bounds.minY + height * (0.28 + a * 0.62),
        bounds.maxX + width * 0.12, bounds.minY + height * (0.06 + b * 0.88)
      );
      context.lineCap = 'round';
      context.lineWidth = 0.24 + seeded(seed + index * 47) * 0.48;
      context.strokeStyle = index % 3 === 0 ? 'rgba(221, 202, 143, .12)' : index % 2 ? 'rgba(235, 242, 207, .075)' : 'rgba(22, 46, 24, .15)';
      context.stroke();
    }

    for (let index = 0; index < 10; index += 1) {
      const x = bounds.minX + width * (0.08 + seeded(seed + index * 59) * 0.84);
      const y = bounds.minY + height * (0.08 + seeded(seed + index * 61 + 5) * 0.84);
      const length = width * (0.018 + seeded(seed + index * 67 + 9) * 0.045);
      const angle = -0.72 + seeded(seed + index * 73 + 13) * 1.44;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      context.lineWidth = 0.28;
      context.strokeStyle = 'rgba(246, 248, 224, .075)';
      context.stroke();
    }

    const polish = context.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
    polish.addColorStop(0, 'rgba(255, 255, 238, .105)');
    polish.addColorStop(0.22, 'rgba(255, 255, 255, 0)');
    polish.addColorStop(0.72, 'rgba(255, 255, 255, 0)');
    polish.addColorStop(1, 'rgba(4, 12, 7, .10)');
    context.fillStyle = polish;
    context.fillRect(bounds.minX - 2, bounds.minY - 2, width + 4, height + 4);
    context.restore();
  }

  function drawConsolidatedStone(context, face, sides, isLight, canvas, baseTexture) {
      baseTexture(context, face, sides, isLight, canvas);
      drawPremiumStone(context, face, sides);
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
      return { angle, score: Math.abs(angle) + (midpointY > centroid[1] ? 0.06 : 0) + 14 / Math.max(20, length) };
    });
    candidates.sort((left, right) => left.score - right.score);
    return physicalClamp(candidates[0]?.angle || 0, -0.31, 0.31);
  }

  function glyphFontSize(face, label) {
    const area = physicalFaceArea(face.points);
    const factor = label.length > 1 ? 0.325 : 0.435;
    return physicalClamp(Math.sqrt(area) * factor, 13, label.length > 1 ? 25 : 32);
  }

  function renderGlyph(label, fontSize, reveal) {
    const padding = Math.ceil(fontSize * 0.42);
    const cssSize = Math.ceil(fontSize * 2.2 + padding * 2);
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
    context.miterLimit = 2;
    context.font = `700 ${fontSize}px "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`;
    const baseline = fontSize * 0.01;

    context.save();
    context.lineWidth = Math.max(2.0, fontSize * 0.068);
    context.strokeStyle = 'rgba(9, 22, 11, .76)';
    context.shadowColor = 'rgba(0, 0, 0, .20)';
    context.shadowBlur = fontSize * 0.035;
    context.shadowOffsetY = fontSize * 0.015;
    context.strokeText(label, 0, baseline);
    context.restore();

    context.save();
    context.translate(fontSize * 0.012, fontSize * 0.016);
    context.scale(0.925, 0.925);
    context.lineWidth = Math.max(0.85, fontSize * 0.027);
    context.strokeStyle = 'rgba(224, 232, 196, .50)';
    context.strokeText(label, 0, baseline);
    context.restore();

    context.save();
    context.scale(0.895, 0.895);
    const fill = context.createLinearGradient(0, -fontSize * 0.52, 0, fontSize * 0.50);
    fill.addColorStop(0, 'rgba(255, 253, 239, .99)');
    fill.addColorStop(0.48, 'rgba(239, 237, 216, .99)');
    fill.addColorStop(1, 'rgba(190, 198, 164, .99)');
    context.fillStyle = fill;
    context.fillText(label, 0, baseline);
    context.restore();

    context.save();
    context.translate(-fontSize * 0.010, -fontSize * 0.012);
    context.scale(0.895, 0.895);
    context.globalAlpha = clamp01(reveal) * 0.26;
    context.lineWidth = Math.max(0.48, fontSize * 0.015);
    context.strokeStyle = 'rgba(28, 40, 24, .70)';
    context.strokeText(label, 0, baseline);
    context.restore();

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
  physicalAdvanceSpin: advanceAndLockResult,
  physicalPaintEntry: paintStableResult,
  drawPhysicalTexture: drawConsolidatedStone,
  drawPhysicalFaceValue: drawConsolidatedFaceValue
});

  document.documentElement.dataset.diceRenderer = 'consolidated';
})();
