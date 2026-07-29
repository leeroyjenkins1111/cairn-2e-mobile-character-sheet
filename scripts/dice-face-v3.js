'use strict';

(() => {
  const LOCK_START = 0.74;
  const LOCK_END = 0.86;

  function localHash(seed) {
    const value = Math.sin(Number(seed) * 12.9898 + 78.233) * 43758.5453;
    return value - Math.floor(value);
  }

  function heroRotation(sides) {
    const presets = {
      4: { x: -0.34, y: 0.43, z: 0 },
      6: { x: -0.28, y: 0.40, z: 0 },
      8: { x: -0.34, y: 0.40, z: 0 },
      10: { x: -0.32, y: 0.39, z: 0 },
      12: { x: -0.31, y: 0.38, z: 0 },
      20: { x: -0.32, y: 0.39, z: 0 },
      100: { x: -0.30, y: 0.40, z: 0 }
    };
    return presets[Number(sides)] || presets[20];
  }

  if (typeof finalDieRotation === 'function') {
    finalDieRotation = function frontFacingResultRotation(sides) {
      return { ...heroRotation(sides) };
    };
  }

  if (typeof physicalAdvanceSpin === 'function') {
    const advanceSpin = physicalAdvanceSpin;
    physicalAdvanceSpin = function advanceAndFreezeVisibleResult(spin, finalRotation, deltaSeconds, progress, pose) {
      advanceSpin(spin, finalRotation, deltaSeconds, progress, pose);
      if (progress < LOCK_START) return;

      if (!spin.visibleResultFrom) spin.visibleResultFrom = { ...spin.orientation };
      const phase = physicalClamp((progress - LOCK_START) / (LOCK_END - LOCK_START));
      spin.orientation = physicalQuatSlerp(
        spin.visibleResultFrom,
        spin.settleTarget,
        physicalSmootherStep(phase)
      );
      if (progress >= LOCK_END) spin.orientation = { ...spin.settleTarget };
      spin.rotation = physicalEulerFromQuat(spin.orientation);
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

  if (typeof drawPhysicalTexture === 'function') {
    const drawBaseTexture = drawPhysicalTexture;
    drawPhysicalTexture = function drawNaturalMossTexture(context, face, sides, isLight, canvas) {
      drawBaseTexture(context, face, sides, isLight, canvas);
      if (!face?.points?.length) return;

      const bounds = faceBounds(face.points);
      const width = bounds.maxX - bounds.minX;
      const height = bounds.maxY - bounds.minY;
      const centroid = physicalFaceCentroid(face.points);
      const seed = Math.round(centroid[0] * 17 + centroid[1] * 29 + Number(sides) * 41);

      context.save();
      physicalPath(context, face.points);
      context.clip();

      const patina = context.createRadialGradient(
        bounds.minX + width * 0.28,
        bounds.minY + height * 0.22,
        1,
        centroid[0],
        centroid[1],
        Math.max(width, height) * 0.72
      );
      patina.addColorStop(0, 'rgba(225, 239, 189, .10)');
      patina.addColorStop(0.52, 'rgba(116, 145, 79, .03)');
      patina.addColorStop(1, 'rgba(19, 43, 22, .12)');
      context.fillStyle = patina;
      context.fillRect(bounds.minX - 2, bounds.minY - 2, width + 4, height + 4);

      for (let index = 0; index < 4; index += 1) {
        const a = localHash(seed + index * 11);
        const b = localHash(seed + index * 17 + 3);
        const c = localHash(seed + index * 23 + 7);
        const startX = bounds.minX + width * (-0.08 + a * 0.40);
        const startY = bounds.minY + height * (0.12 + b * 0.70);
        const endX = bounds.maxX + width * (0.04 + c * 0.16);
        const endY = bounds.minY + height * (0.18 + localHash(seed + index * 31) * 0.66);

        context.beginPath();
        context.moveTo(startX, startY);
        context.bezierCurveTo(
          bounds.minX + width * (0.34 + b * 0.16),
          bounds.minY + height * (0.02 + c * 0.42),
          bounds.minX + width * (0.62 + c * 0.20),
          bounds.minY + height * (0.52 + a * 0.38),
          endX,
          endY
        );
        context.lineCap = 'round';
        context.lineWidth = 0.45 + localHash(seed + index * 37) * 0.70;
        context.strokeStyle = index % 2
          ? 'rgba(225, 235, 194, .08)'
          : 'rgba(34, 61, 28, .14)';
        context.stroke();
      }

      context.restore();
    };
  }

  function engravedFontSize(face, label) {
    const area = physicalFaceArea(face.points);
    const factor = label.length > 1 ? 0.35 : 0.47;
    return physicalClamp(Math.sqrt(area) * factor, 14, label.length > 1 ? 26 : 34);
  }

  function drawCarvedInlay(context, label, fontSize, reveal) {
    const family = '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
    const baseline = fontSize * 0.015;
    context.font = `700 ${fontSize}px ${family}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.miterLimit = 2;
    context.globalAlpha = reveal;

    // Dark cavity cut into the material. It stays centred so the value reads as recessed,
    // rather than as a raised glyph with a drop shadow.
    context.save();
    context.lineWidth = Math.max(3.2, fontSize * 0.105);
    context.strokeStyle = 'rgba(6, 17, 8, .88)';
    context.shadowColor = 'rgba(0, 0, 0, .24)';
    context.shadowBlur = Math.max(0.8, fontSize * 0.025);
    context.strokeText(label, 0, baseline);
    context.fillStyle = 'rgba(12, 29, 14, .86)';
    context.fillText(label, 0, baseline);
    context.restore();

    // A narrow lower-right highlight suggests the illuminated inner wall of the carving.
    context.save();
    context.translate(0.62, 0.72);
    context.scale(0.91, 0.91);
    context.lineWidth = Math.max(1.2, fontSize * 0.038);
    context.strokeStyle = 'rgba(246, 250, 228, .58)';
    context.strokeText(label, 0, baseline);
    context.restore();

    // White inlay sits inside the cavity, leaving the dark edge visible around it.
    context.save();
    context.scale(0.88, 0.88);
    context.lineWidth = Math.max(0.85, fontSize * 0.027);
    context.strokeStyle = 'rgba(49, 67, 41, .70)';
    context.strokeText(label, 0, baseline);
    const fill = context.createLinearGradient(0, -fontSize * 0.55, 0, fontSize * 0.52);
    fill.addColorStop(0, 'rgba(255, 255, 247, .99)');
    fill.addColorStop(0.50, 'rgba(237, 242, 220, .99)');
    fill.addColorStop(1, 'rgba(197, 210, 175, .99)');
    context.fillStyle = fill;
    context.fillText(label, 0, baseline);
    context.restore();

    // Subtle top-left occlusion completes the inset illusion without creating an extrusion.
    context.save();
    context.translate(-0.42, -0.48);
    context.scale(0.88, 0.88);
    context.globalAlpha = reveal * 0.32;
    context.lineWidth = Math.max(0.65, fontSize * 0.021);
    context.strokeStyle = 'rgba(17, 31, 16, .72)';
    context.strokeText(label, 0, baseline);
    context.restore();
  }

  if (typeof drawPhysicalFaceValue === 'function') {
    drawPhysicalFaceValue = function drawFrontFacingCarvedValue(context, face, label, reveal) {
      if (!face?.points?.length || reveal <= 0) return;
      const centroid = physicalFaceCentroid(face.points);
      const fontSize = engravedFontSize(face, label);

      context.save();
      physicalPath(context, face.points);
      context.clip();
      context.translate(centroid[0], centroid[1]);
      context.scale(0.98 + reveal * 0.02, 0.98 + reveal * 0.02);
      drawCarvedInlay(context, label, fontSize, reveal);
      context.restore();
    };
  }

  const style = document.createElement('style');
  style.textContent = `
    html[data-dice-face-v3="true"] .result-die-canvas {
      filter: saturate(.94) contrast(1.035) drop-shadow(0 7px 9px rgba(0, 0, 0, .25));
    }
    html[data-dice-face-v3="true"] .result-die-object:not(.is-tumbling) .result-die-canvas {
      filter: saturate(.93) contrast(1.04) drop-shadow(0 9px 11px rgba(0, 0, 0, .30));
    }
  `;
  document.head.append(style);
  document.documentElement.dataset.diceFaceV3 = 'true';
})();
