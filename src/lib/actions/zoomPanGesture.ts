import type { Action } from 'svelte/action';

export interface ZoomPanState {
  scale: number;
  panX: number;
  panY: number;
  isGestureActive: boolean;
}

export interface ZoomPanGestureParams {
  onZoomPanChange: (state: ZoomPanState) => void;
  getCanvasSize: () => { width: number; height: number };
  minScale?: number;
  maxScale?: number;
  enabled?: boolean;
}

export const zoomPanGesture: Action<HTMLElement, ZoomPanGestureParams> = (node, params) => {
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let initialDistance = 0;
  let initialScale = 1;
  let lastTouchMidX = 0;
  let lastTouchMidY = 0;
  let isGestureActive = false;
  let gestureOccurred = false; // Track if any actual gesture happened

  const minScale = params.minScale ?? 1;
  const maxScale = params.maxScale ?? 2.5;
  const MOVEMENT_THRESHOLD = 10; // Pixels of movement to distinguish from tap
  const SCALE_THRESHOLD = 0.05; // 5% scale change to distinguish from tap

  function getDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getTouchMidpoint(touch1: Touch, touch2: Touch): { x: number; y: number } {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  }

  function emitState() {
    params.onZoomPanChange({ scale, panX, panY, isGestureActive });
  }

  function reset() {
    scale = 1;
    panX = 0;
    panY = 0;
    initialDistance = 0;
    initialScale = 1;
    lastTouchMidX = 0;
    lastTouchMidY = 0;
    isGestureActive = false;
    emitState();
  }

  function handleTouchStart(e: TouchEvent) {
    if (!params.enabled) return;

    if (e.touches.length === 2) {
      // Start pinch zoom and prepare for panning
      initialDistance = getDistance(e.touches[0], e.touches[1]);
      initialScale = scale;
      gestureOccurred = false; // Reset for this gesture

      // Store initial midpoint for panning
      const midpoint = getTouchMidpoint(e.touches[0], e.touches[1]);
      lastTouchMidX = midpoint.x;
      lastTouchMidY = midpoint.y;

      // Don't set isGestureActive yet - wait for actual movement
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!params.enabled) return;

    if (e.touches.length === 2 && initialDistance > 0) {
      // Handle pinch zoom
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scaleChange = currentDistance / initialDistance;
      let newScale = initialScale * scaleChange;

      // Handle two-finger panning
      const midpoint = getTouchMidpoint(e.touches[0], e.touches[1]);
      const deltaX = midpoint.x - lastTouchMidX;
      const deltaY = midpoint.y - lastTouchMidY;
      const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Check if movement exceeds threshold to activate gesture
      const scaleChangeMagnitude = Math.abs(scaleChange - 1);
      const isSignificantZoom = scaleChangeMagnitude > SCALE_THRESHOLD;
      const isSignificantPan = totalMovement > MOVEMENT_THRESHOLD;

      if (!gestureOccurred && (isSignificantZoom || isSignificantPan)) {
        // Mark that an actual gesture occurred (not just a tap)
        gestureOccurred = true;
        isGestureActive = true;
        emitState();
      }

      // Only process gesture if it's active
      if (gestureOccurred) {
        // Clamp scale between min and max
        newScale = Math.max(minScale, Math.min(maxScale, newScale));
        scale = newScale;

        // Calculate max pan distance based on scale
        const { width, height } = params.getCanvasSize();
        const maxPan = ((scale - 1) * width) / 2;
        const maxPanY = ((scale - 1) * height) / 2;

        // Update pan with limits
        panX = Math.max(-maxPan, Math.min(maxPan, panX + deltaX));
        panY = Math.max(-maxPanY, Math.min(maxPanY, panY + deltaY));

        // Update last midpoint
        lastTouchMidX = midpoint.x;
        lastTouchMidY = midpoint.y;

        // Reset pan if zoomed out to min scale
        if (scale === minScale) {
          panX = 0;
          panY = 0;
        }

        emitState();
      }
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (!params.enabled) return;

    if (e.touches.length < 2) {
      initialDistance = 0;
      isGestureActive = false;
      emitState();
    }
  }

  // Add event listeners
  node.addEventListener('touchstart', handleTouchStart, { passive: true });
  node.addEventListener('touchmove', handleTouchMove, { passive: true });
  node.addEventListener('touchend', handleTouchEnd, { passive: true });

  return {
    update(newParams: ZoomPanGestureParams) {
      params = newParams;
    },
    destroy() {
      node.removeEventListener('touchstart', handleTouchStart);
      node.removeEventListener('touchmove', handleTouchMove);
      node.removeEventListener('touchend', handleTouchEnd);
    }
  };
};

export function createZoomPanState(): ZoomPanState {
  return {
    scale: 1,
    panX: 0,
    panY: 0,
    isGestureActive: false
  };
}
