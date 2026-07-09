/**
 * DemoGuard — Touch dynamics collector
 *
 * Listens to pointerdown, pointermove, pointerup.
 * Returns safe summary only — no raw touch traces.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardTouchSignal } from '../types';

export function collectTouch(durationMs: number = 5000): Promise<DemoGuardTouchSignal> {
  return new Promise((resolve) => {
    let touchCount = 0;
    let pointerType: string | undefined;
    let pressureSum = 0;
    let pressureSamples = 0;
    let pressureSupported = false;
    let multiTouchDetected = false;
    let downTime = 0;
    let totalMoveDistance = 0;
    let lastX = 0;
    let lastY = 0;
    let isDown = false;
    let touchDurationMs: number | undefined;

    const onDown = (e: PointerEvent) => {
      touchCount++;
      isDown = true;
      downTime = performance.now();
      lastX = e.clientX;
      lastY = e.clientY;
      pointerType = e.pointerType;
      if (e.pressure > 0) {
        pressureSupported = true;
        pressureSum += e.pressure;
        pressureSamples++;
      }
      if (e.isPrimary === false) {
        multiTouchDetected = true;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!isDown) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      totalMoveDistance += Math.sqrt(dx * dx + dy * dy);
      lastX = e.clientX;
      lastY = e.clientY;
      if (e.pressure > 0) {
        pressureSum += e.pressure;
        pressureSamples++;
      }
    };

    const onUp = () => {
      if (isDown) {
        touchDurationMs = Math.round(performance.now() - downTime);
        isDown = false;
      }
    };

    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    setTimeout(() => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);

      const pressureAvg = pressureSamples > 0 ? pressureSum / pressureSamples : undefined;
      const quality: DemoGuardTouchSignal['quality'] =
        touchCount > 0 ? 'ok' : 'missing';

      resolve({
        touch_count: touchCount,
        pointer_type: pointerType,
        pressure_supported: pressureSupported,
        pressure_avg: pressureAvg,
        touch_duration_ms: touchDurationMs,
        move_distance: Math.round(totalMoveDistance),
        multi_touch_detected: multiTouchDetected,
        quality,
      });
    }, durationMs);
  });
}
