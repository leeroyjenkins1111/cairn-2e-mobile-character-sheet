import { test, expect } from '@playwright/test';

test.describe('physical dice renderer', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.physicalDice === 'true');
  });

  test('uses a 10-face kite mesh for k10', async ({ page }) => {
    const mesh = await page.evaluate(() => {
      const result = createDieMesh(10);
      return {
        vertices: result.vertices.length,
        faces: result.faces.length,
        faceSizes: result.faces.map(face => face.length)
      };
    });

    expect(mesh.vertices).toBe(12);
    expect(mesh.faces).toBe(10);
    expect(mesh.faceSizes).toEqual(Array(10).fill(4));
  });

  test('keeps both dice visible when resolving the higher result', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const host = document.createElement('div');
      document.body.append(host);
      animateHighestDamageDice(
        host,
        [{ sides: 6, value: 3 }, { sides: 6, value: 6 }],
        6,
        'obrażeń',
        'success',
        'Krótki łuk · 2k6, zachowaj wyższy'
      );
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return {
        diceCount: host.querySelectorAll('.damage-die-scene').length,
        loserConnected: Boolean(host.querySelector('.damage-die-loser')?.isConnected),
        winnerConnected: Boolean(host.querySelector('.damage-die-winner')?.isConnected),
        context: host.querySelector('.result-die-context')?.textContent,
        result: host.querySelector('.result-die-copy')?.textContent
      };
    });

    expect(result.diceCount).toBe(2);
    expect(result.loserConnected).toBe(true);
    expect(result.winnerConnected).toBe(true);
    expect(result.context).toContain('zachowaj wyższy');
    expect(result.result).toContain('Wyższy wynik: 6');
  });

  test('renders the result on the die and exposes roll context separately', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const host = document.createElement('div');
      document.body.append(host);
      animateDiceResult(host, 17, 'wynik', 20, 'neutral');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const object = host.querySelector('.result-die-object');
      return {
        hiddenValue: host.querySelector('.result-die-value')?.textContent,
        faceReveal: object?.dataset.faceReveal,
        context: host.querySelector('.result-die-context')?.textContent,
        notationVisible: getComputedStyle(host.querySelector('.result-die-notation')).display
      };
    });

    expect(result.hiddenValue).toBe('17');
    expect(result.faceReveal).toBe('1');
    expect(result.context).toBe('Rzut k20');
    expect(result.notationVisible).toBe('none');
  });
});
