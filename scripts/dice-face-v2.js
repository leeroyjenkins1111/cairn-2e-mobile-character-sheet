'use strict';

(() => {
  const FREEZE_START = 0.82;
  const FREEZE_END = 0.90;

  function heroRotation(sides) {
    const presets = {
      4: { x: -0.52, y: 0.70, z: 0.08 },
      6: { x: -0.42, y: 0.63, z: 0.03 },
      8: { x: -0.52, y: 0.58, z: 0.04 },
      10: { x: -0.48, y: 0.62, z: 0.03 },
      12: { x: -0.44, y: 0.60, z: 0.02 },
      20: { x: -0.46, y: 0.58, z: 0.02 },
      100: { x: -0.48, y: 0.62, z: 0.03 }
    };
    return presets[Number(sides)] || presets[20];
  }

  if (typeof finalDieRotation === 'function') {
    finalDieRotation = function stableFrontDieRotation(sides) {
      return { ...heroRotation(sides) };
    };
  }

  if (typeof physicalAdvanceSpin === 'function') {
    const advancePhysicalSpin = physicalAdvanceSpin;
    physicalAdvanceSpin = function advanceAndLockResultFace(spin, finalRotation, deltaSeconds, progress, pose) {
      advancePhysicalSpin(spin, finalRotation, deltaSeconds, progress, pose);
      if (progress < FREEZE_START) return;

      if (!spin.resultFaceFrom) spin.resultFaceFrom = { ...spin.orientation };
      const phase = physicalClamp((progress - FREEZE_START) / (FREEZE_END - FREEZE_START));
      const eased = physicalSmootherStep(phase);
      spin.orientation = physicalQuatSlerp(spin.resultFaceFrom, spin.settleTarget, eased);
      if (progress >= FREEZE_END) spin.orientation = { ...spin.settleTarget };
      spin.rotation = physicalEulerFromQuat(spin.orientation);
    };
  }

  function engravedFontSize(face, label) {
    const area = physicalFaceArea(face.points);
    const factor = label.length > 1 ? 0.46 : 0.64;
    return physicalClamp(Math.sqrt(area) * factor, 16, label.length > 1 ? 32 : 43);
  }

  function drawEngravedText(context, label, fontSize) {
    const y = fontSize * 0.025;
    context.font = `800 ${fontSize}px Georgia, "Times New Roman", serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.miterLimit = 2;

    context.save();
    context.translate(0.9, 1.35);
    context.lineWidth = Math.max(3.2, fontSize * 0.105);
    context.strokeStyle = 'rgba(8, 20, 10, .78)';
    context.shadowColor = 'rgba(0, 0, 0, .34)';
    context.shadowBlur = Math.max(1.2, fontSize * 0.045);
    context.strokeText(label, 0, y);
    context.restore();

    context.save();
    context.translate(-0.65, -0.75);
    context.lineWidth = Math.max(1.5, fontSize * 0.052);
    context.strokeStyle = 'rgba(218, 231, 198, .44)';
    context.strokeText(label, 0, y);
    context.restore();

    context.lineWidth = Math.max(1.1, fontSize * 0.036);
    context.strokeStyle = 'rgba(45, 64, 37, .72)';
    context.strokeText(label, 0, y);

    const fill = context.createLinearGradient(0, -fontSize * 0.56, 0, fontSize * 0.55);
    fill.addColorStop(0, 'rgba(255, 255, 247, .98)');
    fill.addColorStop(0.48, 'rgba(238, 243, 224, .98)');
    fill.addColorStop(1, 'rgba(207, 218, 188, .98)');
    context.fillStyle = fill;
    context.fillText(label, 0, y);

    context.save();
    context.globalAlpha = 0.28;
    context.translate(-0.45, -0.65);
    context.fillStyle = 'rgba(255, 255, 255, .9)';
    context.fillText(label, 0, y);
    context.restore();
  }

  if (typeof drawPhysicalFaceValue === 'function') {
    drawPhysicalFaceValue = function drawFrontFacingEngravedValue(context, face, label, reveal) {
      const centroid = physicalFaceCentroid(face.points);
      const fontSize = engravedFontSize(face, label);
      const scale = 0.96 + reveal * 0.04;

      context.save();
      physicalPath(context, face.points);
      context.clip();
      context.translate(centroid[0], centroid[1]);
      context.scale(scale, scale);
      context.globalAlpha = reveal;
      drawEngravedText(context, label, fontSize);
      context.restore();
    };
  }

  document.documentElement.dataset.diceFaceV2 = 'true';
})();
