'use strict';

(() => {
  const LOCK_START = 0.72;
  const LOCK_END = 0.84;

  function hash(seed) {
    const value = Math.sin(Number(seed) * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function heroRotation(sides) {
    const presets = {
      4: { x: -0.38, y: 0.44, z: 0 },
      6: { x: -0.31, y: 0.42, z: 0 },
      8: { x: -0.36, y: 0.41, z: 0 },
      10: { x: -0.34, y: 0.40, z: 0 },
      12: { x: -0.33, y: 0.39, z: 0 },
      20: { x: -0.34, y: 0.40, z: 0 },
      100: { x: -0.32, y: 0.41, z: 0 }
    };
    return presets[Number(sides)] || presets[20];
  }

  if (typeof finalDieRotation === 'function') {
    finalDieRotation = function stableCarvedResultRotation(sides) {
      return { ...heroRotation(sides) };
    };
  }

  if (typeof physicalAdvanceSpin === 'function') {
    const advanceSpin = physicalAdvanceSpin;
    physicalAdvanceSpin = function advanceAndHardLockResult(spin, finalRotation, deltaSeconds, progress, pose) {
      advanceSpin(spin, finalRotation, deltaSeconds, progress, pose);
      if (progress < LOCK_START) return;

      if (!spin.v4LockFrom) spin.v4LockFrom = { ...spin.orientation };
      const phase = physicalClamp((progress - LOCK_START) / (LOCK_END - LOCK_START));
      spin.orientation = physicalQuatSlerp(
        spin.v4LockFrom,
        spin.settleTarget,
        physicalSmootherStep(phase)
      );
      if (progress >= LOCK_END) spin.orientation = { ...spin.settleTarget };
      spin.rotation = physicalEulerFromQuat(spin.orientation);
    };
  }

  // Never paint the value while the die is still moving. The existing animation removes
  // `is-tumbling`, snaps the object to its final pose and only then calls this function again.
  if (typeof physicalPaintEntry === 'function') {
    const paintEntry = physicalPaintEntry;
    physicalPaintEntry = function paintOnlyStableResult(entry, rotation, lift = 0) {
      if (entry?.object?.classList?.contains('is-tumbling')) {
        entry.object.dataset.faceReveal = '0';
      }
      return paintEntry(entry, rotation, lift);
    };
  }

  function faceBounds(points) {
    const xs = points.map(point => point[0]);
    const ys = points.map(point => point[1]);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  }

  function faceLocalAngle(points) {
    const centroid = physicalFaceCentroid(points);
    const edges = points.map((start, index) => {
      const end = points[(index + 1) % points.length];
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      let angle = Math.atan2(dy, dx);
      if (angle > Math.PI / 2) angle -= Math.PI;
      if (angle < -Math.PI / 2) angle += Math.PI;
      const midpointY = (start[1] + end[1]) / 2;
      const length = Math.hypot(dx, dy);
      const upperBias = midpointY <= centroid[1] ? -0.08 : 0;
      return { angle, length, score: Math.abs(angle) + 18 / Math.max(18, length) + upperBias };
    });
    const edge = edges.sort((a, b) => a.score - b.score)[0];
    return physicalClamp(edge?.angle || 0, -0.34, 0.34);
  }

  if (typeof drawPhysicalTexture === 'function') {
    const drawBaseTexture = drawPhysicalTexture;
    drawPhysicalTexture = function drawLayeredMossStone(context, face, sides, isLight, canvas) {
      drawBaseTexture(context, face, sides, isLight, canvas);
      if (!face?.points?.length) return;

      const bounds = faceBounds(face.points);
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      const centroid = physicalFaceCentroid(face.points);
      const seed = Math.round(centroid[0] * 19 + centroid[1] * 31 + Number(sides) * 47);

      context.save();
      physicalPath(context, face.points);
      context.clip();

      const cloud = context.createRadialGradient(
        bounds.minX + width * 0.27,
        bounds.minY + height * 0.20,
        1,
        centroid[0],
        centroid[1],
        Math.max(width, height) * 0.82
      );
      cloud.addColorStop(0, 'rgba(232, 241, 201, .13)');
      cloud.addColorStop(0.38, 'rgba(126, 153, 84, .035)');
      cloud.addColorStop(0.72, 'rgba(42, 71, 35, .075)');
      cloud.addColorStop(1, 'rgba(9, 25, 13, .18)');
      context.fillStyle = cloud;
      context.fillRect(bounds.minX - 3, bounds.minY - 3, width + 6, height + 6);

      // Broad mineral veins and short abrasion marks create depth without decorative dots.
      for (let index = 0; index < 5; index += 1) {
        const a = hash(seed + index * 13);
        const b = hash(seed + index * 19 + 5);
        const c = hash(seed + index * 29 + 9);
        const startX = bounds.minX - width * 0.10;
        const startY = bounds.minY + height * (0.12 + a * 0.76);
        const endX = bounds.maxX + width * 0.10;
        const endY = bounds.minY + height * (0.10 + b * 0.78);
        context.beginPath();
        context.moveTo(startX, startY);
        context.bezierCurveTo(
          bounds.minX + width * (0.28 + b * 0.14),
          bounds.minY + height * (0.04 + c * 0.56),
          bounds.minX + width * (0.67 + c * 0.16),
          bounds.minY + height * (0.42 + a * 0.48),
          endX,
          endY
        );
        context.lineCap = 'round';
        context.lineWidth = 0.42 + hash(seed + index * 37) * 0.78;
        context.strokeStyle = index % 2
          ? 'rgba(229, 237, 197, .09)'
          : 'rgba(25, 52, 27, .18)';
        context.stroke();
      }

      for (let index = 0; index < 7; index += 1) {
        const x = bounds.minX + width * (0.12 + hash(seed + index * 41) * 0.76);
        const y = bounds.minY + height * (0.10 + hash(seed + index * 43 + 2) * 0.80);
        const length = width * (0.035 + hash(seed + index * 47 + 4) * 0.065);
        const angle = -0.45 + hash(seed + index * 53 + 6) * 0.90;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
        context.lineWidth = 0.45;
        context.strokeStyle = 'rgba(238, 243, 215, .10)';
        context.stroke();
      }

      context.restore();
    };
  }

  function carvedFontSize(face, label) {
    const area = physicalFaceArea(face.points);
    const factor = label.length > 1 ? 0.34 : 0.46;
    return physicalClamp(Math.sqrt(area) * factor, 14, label.length > 1 ? 26 : 34);
  }

  function drawRecessedInlay(context, label, fontSize, reveal) {
    const baseline = fontSize * 0.015;
    context.font = `700 ${fontSize}px "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.miterLimit = 2;
    context.globalAlpha = reveal;

    // Deep cut in the stone.
    context.save();
    context.lineWidth = Math.max(3.5, fontSize * 0.115);
    context.strokeStyle = 'rgba(4, 14, 7, .92)';
    context.shadowColor = 'rgba(0, 0, 0, .28)';
    context.shadowBlur = Math.max(0.9, fontSize * 0.028);
    context.strokeText(label, 0, baseline);
    context.fillStyle = 'rgba(10, 25, 12, .90)';
    context.fillText(label, 0, baseline);
    context.restore();

    // Lit lower wall of the carving.
    context.save();
    context.translate(0.55, 0.68);
    context.scale(0.90, 0.90);
    context.lineWidth = Math.max(1.15, fontSize * 0.037);
    context.strokeStyle = 'rgba(244, 249, 224, .62)';
    context.strokeText(label, 0, baseline);
    context.restore();

    // Slightly inset white fill, leaving a visible dark cavity around it.
    context.save();
    context.scale(0.86, 0.86);
    context.lineWidth = Math.max(0.8, fontSize * 0.026);
    context.strokeStyle = 'rgba(45, 64, 38, .68)';
    context.strokeText(label, 0, baseline);
    const fill = context.createLinearGradient(0, -fontSize * 0.54, 0, fontSize * 0.50);
    fill.addColorStop(0, 'rgba(255, 255, 247, .99)');
    fill.addColorStop(0.52, 'rgba(238, 243, 222, .99)');
    fill.addColorStop(1, 'rgba(198, 211, 176, .99)');
    context.fillStyle = fill;
    context.fillText(label, 0, baseline);
    context.restore();

    // Occlusion on the upper-left inner wall reinforces the recessed direction.
    context.save();
    context.translate(-0.44, -0.50);
    context.scale(0.86, 0.86);
    context.globalAlpha = reveal * 0.34;
    context.lineWidth = Math.max(0.65, fontSize * 0.021);
    context.strokeStyle = 'rgba(12, 27, 14, .80)';
    context.strokeText(label, 0, baseline);
    context.restore();
  }

  if (typeof drawPhysicalFaceValue === 'function') {
    drawPhysicalFaceValue = function drawFaceAlignedCarvedValue(context, face, label, reveal) {
      if (!face?.points?.length || reveal <= 0) return;
      const centroid = physicalFaceCentroid(face.points);
      const fontSize = carvedFontSize(face, label);
      const angle = faceLocalAngle(face.points);

      context.save();
      physicalPath(context, face.points);
      context.clip();
      context.translate(centroid[0], centroid[1]);
      context.rotate(angle);
      context.scale(0.98 + reveal * 0.02, 0.98 + reveal * 0.02);
      drawRecessedInlay(context, label, fontSize, reveal);
      context.restore();
    };
  }

  const style = document.createElement('style');
  style.textContent = `
    html[data-dice-face-v4="true"] .result-die-canvas {
      filter: saturate(.90) contrast(1.07) drop-shadow(0 8px 10px rgba(0, 0, 0, .28));
    }
    html[data-dice-face-v4="true"] .result-die-object:not(.is-tumbling) .result-die-canvas {
      filter: saturate(.89) contrast(1.08) drop-shadow(0 10px 13px rgba(0, 0, 0, .34));
    }
  `;
  document.head.append(style);
  delete document.documentElement.dataset.diceFaceV3;
  document.documentElement.dataset.diceFaceV4 = 'true';
})();
