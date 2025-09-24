<script lang="ts">
	import { onMount, type Snippet } from "svelte";
	import { mapRange } from "$lib/utils/math";
	import { Spring } from "svelte/motion";

  interface Props {
    children: Snippet<[isPanningZooming: boolean, details: typeof coords['current']]>,
    onzoomstart?: () => void;
    ontaptwo?: () => void;
    class?: string;
    [key: string]: any;
  }

  let { 
    children, ontaptwo, onzoomstart, 
    class: restClasses, ...restProps 
  }: Props = $props()
  

  const DEFAULT_PROPS = { x: 0, y: 0, scale: 1 }
  const MAX_ZOOM = 10
  const MAX_TAP_DURATION = 300; // milliseconds
  const MAX_TAP_MOVE = 20; // max distance fingers can move
  

  let elmEditor: HTMLDivElement | undefined = $state()
  let coords = new Spring(DEFAULT_PROPS);
  let canvasTransform = $state(DEFAULT_PROPS);
  let prevTouches: Touch[] = [];
  let isPanningZooming = $state(false);
  let initialDistance = 0;
  let initialMidpoint = { x: 0, y: 0 };
  
  let tapStartTime = 0;
  let tapStartDistance = 0;
  

  function getTouchDistance([a, b]: Touch[]): number {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  function getMidpoint([a, b]: Touch[]): { x: number; y: number } {
    return {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2,
    };
  }

  function clampPan() {
    if (!elmEditor) return;
    
    const containerRect = elmEditor.getBoundingClientRect();
    if (!containerRect) return;

    // scale
    const minScale = Math.min(MAX_ZOOM, Math.max(1, canvasTransform.scale));
    canvasTransform.scale = minScale;

    // pan
    const diffX = (containerRect.width * minScale - containerRect.width) *  mapRange(minScale, 1, MAX_ZOOM, 0.5, 0.1);
    const diffY = (containerRect.height * minScale - containerRect.height) * mapRange(minScale, 1, MAX_ZOOM, 0.5, 0.1);
    canvasTransform.x = Math.min(diffX, Math.max(-diffX, canvasTransform.x));
    canvasTransform.y = Math.min(diffY, Math.max(-diffY, canvasTransform.y));

    // const rect = canvas.getBoundingClientRect();
    // const viewportWidth = window.innerWidth;
    // const viewportHeight = window.innerHeight;
    // const scaledWidth = canvas.width * canvasTransform.scale;
    // const scaledHeight = canvas.height * canvasTransform.scale;
    // const diffX = Math.max(0, scaledWidth - viewportWidth);
    // const diffY = Math.max(0, scaledHeight - viewportHeight);

    // canvasTransform.x = Math.min(diffX, Math.max(-diffX, canvasTransform.x));
    // canvasTransform.y = Math.min(diffY, Math.max(-diffY, canvasTransform.y));
    // canvasTransform.x = Math.min(diffX, Math.max(-diffX, canvasTransform.x));
    // canvasTransform.y = Math.min(diffY, Math.max(-diffY, canvasTransform.y));
  }

  function applyCanvasTransform() { coords.set(canvasTransform); }


  function handleTouchStart(e: TouchEvent) {
    const touches = [...e.touches];
    if (touches.length === 2) {
      isPanningZooming = true;
      prevTouches = touches;
      initialDistance = getTouchDistance(touches);
      initialMidpoint = getMidpoint(touches);
      tapStartTime = Date.now();
      tapStartDistance = initialDistance;
      onzoomstart?.();
    }
    e.preventDefault(); // 🔒 always block gestures
  }

  function handleTouchMove(e: TouchEvent) {
    const touches = [...e.touches];

    if (touches.length === 2 && isPanningZooming) {
      const newDistance = getTouchDistance(touches);
      const scaleFactor = newDistance / initialDistance;
      const newMidpoint = getMidpoint(touches);

      // Pan offset
      const dx = newMidpoint.x - initialMidpoint.x;
      const dy = newMidpoint.y - initialMidpoint.y;

      canvasTransform.scale = Math.min(MAX_ZOOM, Math.max(.9, canvasTransform.scale * scaleFactor));
      canvasTransform.x += dx * mapRange(canvasTransform.scale, 1, MAX_ZOOM, 1, .25);
      canvasTransform.y += dy * mapRange(canvasTransform.scale, 1, MAX_ZOOM, 1, .25);

      initialDistance = newDistance;
      initialMidpoint = newMidpoint;

      applyCanvasTransform();
    }

    e.preventDefault(); // 🔒 always block gestures
  }

  function handleTouchEnd(e: TouchEvent) {
    const duration = Date.now() - tapStartTime;
    
    if (isPanningZooming && e.touches.length < 2) {
      const distanceMoved = Math.abs(initialDistance - tapStartDistance);
      if (duration < MAX_TAP_DURATION && distanceMoved < MAX_TAP_MOVE) {
        ontaptwo?.();
      }
      
      isPanningZooming = false;
      clampPan();
      applyCanvasTransform();
    }

    // reset to standard position
    e.preventDefault(); // 🔒
  }

  export function resetZoom() { 
    canvasTransform = DEFAULT_PROPS;
    applyCanvasTransform();
  }

  onMount(() => {
    elmEditor?.addEventListener('touchstart', handleTouchStart, { passive: false });
    elmEditor?.addEventListener('touchmove', handleTouchMove, { passive: false });
    elmEditor?.addEventListener('touchend', handleTouchEnd, { passive: false });
    return () => {
      elmEditor?.removeEventListener('touchstart', handleTouchStart);
      elmEditor?.removeEventListener('touchmove', handleTouchMove);
      elmEditor?.removeEventListener('touchend', handleTouchEnd); 
    }
  });
  
</script>

<div bind:this={elmEditor} {...restProps} class="{restClasses}">
  {@render children(isPanningZooming, coords.current)}
</div>