import type { Stroke } from '$lib/components/scribble-state.svelte';
import type { Action } from 'svelte/action';

const MIN_DISTANCE = 0.5; // Precision for point sampling

export interface DrawGestureParams {
  onStrokeComplete: (stroke: Stroke) => void;
  getDrawingOptions: () => { color: string; size: number };
  getBoxSize: () => { width: number; height: number };
  getTargetSize?: () => { width: number; height: number };
  onActiveStrokeChange?: (stroke: Stroke | undefined) => void;
  onTwoFingerTap?: () => void;
  enabled?: boolean;
  penMode?: boolean;
}

export const drawGesture: Action<HTMLElement, DrawGestureParams> = (node, params) => {
  let mainPointer = -1;
  let localActiveStroke: Stroke | undefined;
  let activeTouches = new Set<number>();
  let twoFingerTapStartTime = 0;

  function getCanvasCoords(e: PointerEvent): [number, number] {
    const rect = node.getBoundingClientRect();
    const scaleX = node.clientWidth / rect.width;
    const scaleY = node.clientHeight / rect.height;
    let x = (e.clientX - rect.left) * scaleX;
    let y = (e.clientY - rect.top) * scaleY;

    // Convert to target coordinate system if provided
    const targetSize = params.getTargetSize?.();
    if (targetSize) {
      const boxSize = params.getBoxSize();
      const targetAspect = targetSize.width / targetSize.height;
      const boxAspect = boxSize.width / boxSize.height;

      // Calculate the actual drawing area that maintains target aspect ratio
      let drawWidth = boxSize.width;
      let drawHeight = boxSize.height;
      let offsetX = 0;
      let offsetY = 0;

      if (boxAspect > targetAspect) {
        // Box is wider than target - letterbox on sides
        drawWidth = boxSize.height * targetAspect;
        offsetX = (boxSize.width - drawWidth) / 2;
      } else {
        // Box is taller than target - letterbox on top/bottom
        drawHeight = boxSize.width / targetAspect;
        offsetY = (boxSize.height - drawHeight) / 2;
      }

      // Adjust for offset and scale to target coordinates
      x = ((x - offsetX) / drawWidth) * targetSize.width;
      y = ((y - offsetY) / drawHeight) * targetSize.height;
    }

    return [x, y];
  }

  function handlePointerDown(e: PointerEvent) {
    // Don't start drawing if disabled
    if (params.enabled === false) return;

    // Prevent default to stop text selection and iOS callouts
    e.preventDefault();

    // Track active touches
    activeTouches.add(e.pointerId);

    // If two or more fingers are down, cancel drawing and start two-finger tap detection
    if (activeTouches.size >= 2) {
      cancelStroke();
      twoFingerTapStartTime = Date.now();
      return;
    }

    // Only start drawing if no other pointer is active
    if (mainPointer !== -1) return;

    mainPointer = e.pointerId;

    const [x, y] = getCanvasCoords(e);
    const { color, size } = params.getDrawingOptions();
    const { width, height } = params.getBoxSize();
    const targetSize = params.getTargetSize?.();

    localActiveStroke = {
      points: [[x, y, e.pressure]],
      options: {
        size,
        thinning: 0,
        smoothing: 1,
        streamline: 0,
        easing: (t) => t,
        simulatePressure: true,
        last: true
      },
      color,
      box: { w: width, h: height },
      targetBox: targetSize ? { w: targetSize.width, h: targetSize.height } : undefined
    };

    params.onActiveStrokeChange?.(localActiveStroke);
  }

  function handlePointerMove(e: PointerEvent) {
    // Cancel drawing if multiple touches detected
    if (activeTouches.size >= 2) {
      cancelStroke();
      return;
    }

    if (e.pointerId !== mainPointer || !localActiveStroke) return;

    // Prevent default to stop text selection during drawing
    e.preventDefault();

    const [x, y] = getCanvasCoords(e);

    // Check distance to avoid redundant points
    const last = localActiveStroke.points.at(-1);
    if (!last) return;

    const dx = x - last[0];
    const dy = y - last[1];
    const distSq = dx * dx + dy * dy;

    if (distSq < MIN_DISTANCE * MIN_DISTANCE) return;
    
    // In pen mode, only allow pen input
    if (params.penMode && e.pointerType !== 'pen') {
      cancelStroke();
      return;
    }

    // Add point to active stroke
    localActiveStroke.points.push([x, y, e.pressure]);
    params.onActiveStrokeChange?.(localActiveStroke);
  }

  function handlePointerUp(e: PointerEvent) {
    activeTouches.delete(e.pointerId);

    // Check for two-finger tap gesture (quick tap, less than 300ms)
    if (activeTouches.size === 1 && twoFingerTapStartTime > 0) {
      const tapDuration = Date.now() - twoFingerTapStartTime;
      if (tapDuration < 300) {
        params.onTwoFingerTap?.();
      }
      twoFingerTapStartTime = 0;
    }

    // In pen mode, only allow pen input
    if (params.penMode && e.pointerType !== 'pen') {
      cancelStroke();
      return;
    }

    if (e.pointerId === mainPointer) {
      finishStroke();
    }
  }

  function handlePointerCancel(e: PointerEvent) {
    activeTouches.delete(e.pointerId);
    twoFingerTapStartTime = 0;

    if (e.pointerId === mainPointer) {
      cancelStroke();
    }
  }

  function finishStroke() {
    if (localActiveStroke && localActiveStroke.points.length > 0) {
      params.onStrokeComplete(localActiveStroke);
    }
    resetState();
  }

  function cancelStroke() {
    resetState();
  }

  function resetState() {
    mainPointer = -1;
    localActiveStroke = undefined;
    params.onActiveStrokeChange?.(undefined);
  }

  // Prevent touch events from triggering selection
  function handleTouchStart(e: TouchEvent) {
    if (params.enabled !== false) {
      e.preventDefault();
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (params.enabled !== false) {
      e.preventDefault();
    }
  }

  // Add event listeners
  node.addEventListener('pointerdown', handlePointerDown);
  node.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('pointercancel', handlePointerCancel);
  // Add touch event listeners to prevent default behavior (selection, callouts)
  node.addEventListener('touchstart', handleTouchStart, { passive: false });
  node.addEventListener('touchmove', handleTouchMove, { passive: false });

  return {
    destroy() {
      node.removeEventListener('pointerdown', handlePointerDown);
      node.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      node.removeEventListener('touchstart', handleTouchStart);
      node.removeEventListener('touchmove', handleTouchMove);
    }
  };
};
