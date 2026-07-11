/**
 * useStableMobileViewport — locks frame width during cognitive phases
 * to prevent layout shifts caused by Chrome address bar show/hide.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export const COGNITIVE_PHASES = new Set([
  'cognitive-intro',
  'cognitive-stroop',
  'cognitive-digit-span',
  'cognitive-nback',
  'cognitive-trail-tap',
]);

export const MAX_FRAME_WIDTH = 430;

export function isCognitivePhase(phase: string): boolean {
  return COGNITIVE_PHASES.has(phase);
}

export function computeStableFrameWidth(
  innerWidth: number,
  visualViewportWidth: number | undefined,
): number {
  const w = visualViewportWidth ?? innerWidth;
  return Math.min(w, MAX_FRAME_WIDTH);
}

export function shouldIgnoreViewportResizeDuringCognitive(
  prevWidth: number,
  newWidth: number,
  phase: string,
): boolean {
  if (!isCognitivePhase(phase)) return false;
  return Math.abs(newWidth - prevWidth) <= 50;
}

export function useStableMobileViewport(phase: string): {
  stableFrameWidth: number;
  visualViewportHeight: number;
} {
  const [stableFrameWidth, setStableFrameWidth] = useState<number>(() =>
    computeStableFrameWidth(
      typeof window !== 'undefined' ? window.innerWidth : MAX_FRAME_WIDTH,
      typeof window !== 'undefined' && window.visualViewport
        ? window.visualViewport.width
        : undefined,
    ),
  );
  const [visualViewportHeight, setVisualViewportHeight] = useState<number>(
    typeof window !== 'undefined' && window.visualViewport
      ? window.visualViewport.height
      : typeof window !== 'undefined'
        ? window.innerHeight
        : 800,
  );
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const prevWidthRef = useRef(stableFrameWidth);

  const handleResize = useCallback(() => {
    const currentPhase = phaseRef.current;
    const newWidth = computeStableFrameWidth(
      window.innerWidth,
      window.visualViewport?.width,
    );

    if (shouldIgnoreViewportResizeDuringCognitive(prevWidthRef.current, newWidth, currentPhase)) {
      if (import.meta.env?.DEV) {
        console.log(JSON.stringify({
          event: 'dg_viewport_resize_ignored',
          phase: currentPhase,
          prevWidth: prevWidthRef.current,
          newWidth,
        }));
      }
      return;
    }

    prevWidthRef.current = newWidth;
    setStableFrameWidth(newWidth);

    if (window.visualViewport) {
      setVisualViewportHeight(window.visualViewport.height);
    }

    if (import.meta.env?.DEV) {
      console.log(JSON.stringify({
        event: 'dg_viewport_metrics',
        phase: currentPhase,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        visualViewportWidth: window.visualViewport?.width,
        visualViewportHeight: window.visualViewport?.height,
        stableFrameWidth: newWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      }));
    }
  }, []);

  useEffect(() => {
    handleResize();

    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, [handleResize]);

  useEffect(() => {
    if (import.meta.env?.DEV) {
      console.log(JSON.stringify({
        event: 'dg_phase_change',
        phase,
        stableFrameWidth: prevWidthRef.current,
      }));
    }
  }, [phase]);

  return { stableFrameWidth, visualViewportHeight };
}
