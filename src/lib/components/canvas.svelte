<script lang="ts">
  import { onMount, untrack } from 'svelte';
	import type { CanvasTool, Point, Stroke } from '$lib/components/canvas.types';
	import { getStroke } from 'perfect-freehand';
	import { resizeImage } from '$lib/utils/utils.image';
	import { base64ToBlob, fileToBase64, normalizeFiles } from '$lib/utils/utils.file';
	import { SvelteSet } from 'svelte/reactivity';
	import type { PersistedPage } from './canvas-persisted-page.svelte';


  interface Props {
    persistedPage: PersistedPage;
    tool: CanvasTool
    opts: {
      color: string;
      size: number;
    }
    locked: boolean;
    aspect: string;
    class?: string;
		inPenMode?: boolean;
		[key: string]: any;
  }

  const MIN_DISTANCE = .5; // Adjust to your desired precision

  let { 
    persistedPage=$bindable(),
    opts:options=$bindable(), 
    tool=$bindable(), 
    inPenMode=$bindable(false), 
    locked, 
    aspect, 
    class: restClasses, 
    ...restProps  
  }: Props = $props()

  
  let elmInputBg: HTMLInputElement | undefined = $state()
  let elmBg: HTMLImageElement | undefined = $state();
  let elmBox: HTMLDivElement | undefined = $state();
  let boxWidth: number = $state(0);
  let boxHeight: number = $state(0);


  let mainPointer = -1;
  let initPointerCoors: { x: number; y: number }|null = null;
  let isClickAction = false;

  let activeStroke: Stroke|undefined = $state();
  let erasedStrokeIds = new SvelteSet();
  
  let blockReloadBg = false;
  let isDraggingImage = $state(false);
  let activeOffset = $state({ x: 0, y: 0 });

  

  function getCanvasCoords(e: PointerEvent): [number, number] {
    if (!elmBox) return [0, 0];
    const rect = elmBox.getBoundingClientRect();
    const scaleX = elmBox.clientWidth / rect.width;
    const scaleY = elmBox.clientHeight / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    return [x, y];
  }
  
  function handlePointerDown(e: PointerEvent) {
    if (mainPointer !== -1 || (e.pointerType !== "pen" && inPenMode)) return
    
    if (e.pointerType === "pen") {
      inPenMode = true
      // console.log("Likely Apple Pencil (on iPad)");
    }

    e.preventDefault()

    const [x, y] = getCanvasCoords(e);

    // detect click action vs swipes
    mainPointer = e.pointerId;
    initPointerCoors = { x, y };
    isClickAction = true;

    if (tool == "brush") {
      activeStroke = {
        points: [[x, y, e.pressure]],
        options: {
          size: options.size,
          thinning: .5,
          smoothing: .5,
          streamline: .7,
          easing: (t) => t,
          simulatePressure: true,
          last: true
        },
        color:options.color,
        box: { w: elmBox!.clientWidth, h: elmBox!.clientHeight }
      };
    } else if (tool == "eraser") {
      erasedStrokeIds.clear();
    } else if (tool == "bg") {
      activeOffset = { x: persistedPage.content.bgOffsetX, y: persistedPage.content.bgOffsetY }
      isDraggingImage = true;
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (e.pointerId !== mainPointer || (e.pointerType !== "pen" && inPenMode)) return;
    
    e.preventDefault();

    const [x, y] = getCanvasCoords(e);
    
    // cancel click actions
    if (initPointerCoors) {
      const deltaX = x - initPointerCoors.x;
      const deltaY = y - initPointerCoors.y;
      const distSq = deltaX * deltaX + deltaY * deltaY;
      if (distSq > 1) {
        isClickAction = false
      }
    }
    
    if (tool === 'bg' && isDraggingImage && elmBg && elmBox && initPointerCoors) {

      const initOffsetY = persistedPage.content.bgOffsetY / 100 * elmBg.clientHeight;
      const deltaY = y - initPointerCoors.y;
      const maxOffsetY = Math.max(0, (elmBg.clientHeight - elmBox.clientHeight) / 2);
      const newY = Math.max(-maxOffsetY, Math.min(initOffsetY + deltaY, maxOffsetY));
      activeOffset.y = (newY / elmBg.clientHeight) * 100;
      
      // if (imgWidth > elmBox.clientWidth && imgWidth >= imgHeight) {
      // } else if (imgHeight > elmBox.clientHeight) {}

    } else if (tool === "brush" && activeStroke) {
      
      // detect distance and ignore redundant movements
      const last = activeStroke.points.at(-1);
      if (!last) return;
      const dx = x - last[0];
      const dy = y - last[1];
      const distSq = dx * dx + dy * dy;
      if (distSq < MIN_DISTANCE * MIN_DISTANCE) return; // Ignore small moves
      
      // add point to active stroke
      activeStroke.points.push([x, y, e.pressure]);
      
    } else if (tool === 'eraser') {

      let index = 0;
      for (let stroke of persistedPage.content.strokes) {
        // Scale stroke to match its original box size
        const scaleX = boxWidth / stroke.box.w;
        const scaleY = boxHeight / stroke.box.h;
        const scale = Math.min(scaleX, scaleY);

        if (!erasedStrokeIds.has(index) && areStrokesIntersecting(
          stroke.points, stroke.options.size ?? 1, scale, [[x, y, e.pressure]], 10)) {
          erasedStrokeIds.add(index);
        }
        index++;
      }
    }
  }

  function handlePointerUp(e: PointerEvent) { 
    if (e.pointerId == mainPointer) finishGesture(); 
  }


  function finishGesture(cancelled: boolean = false) {
    if (!cancelled) {
      if (tool == "bg") {
        if (isClickAction) {
          selectBgPicture()
        } else {
          persistedPage.content = { bgOffset: activeOffset }
        }
      } else if (tool === 'eraser' && erasedStrokeIds.size > 0) {
        persistedPage.content = { strokes: persistedPage.content.strokes.filter((_, i) => !erasedStrokeIds.has(i)) };
      } else if (tool === 'brush' && activeStroke) {
        persistedPage.content = { strokes: [...persistedPage.content.strokes, activeStroke], };
      }
    }

    mainPointer = -1;
    activeStroke = undefined;
    
    isDraggingImage = false;
    
    erasedStrokeIds.clear();

    initPointerCoors = null;
    isClickAction = false;
  }


  export function undo() { 
    persistedPage.history.undo() 
    reloadBgImage(persistedPage.content.bg ? base64ToBlob(persistedPage.content.bg) : undefined);
  }  

  export function redo() { 
    persistedPage.history.redo();
    reloadBgImage(persistedPage.content.bg ? base64ToBlob(persistedPage.content.bg) : undefined);
  }

  export async function clear() {
    persistedPage.resetContent();
    reloadBgImage(undefined);
  }

  export function selectBgPicture() { 
    elmInputBg?.click() 
  }

  
  function areStrokesIntersecting(aPoints: Point[], sizeA: number, scaleA: number, bPoints: Point[], sizeB: number): boolean {
    
    const threshold = Math.max(sizeA, sizeB, 3); // enforce a minimum threshold radius

    // Single-point fallback (e.g., tap gesture)
    if (aPoints.length === 1) {
      const [ax, ay] = aPoints[0];
      return bPoints.some(([bx, by]) => {
        const dx = ax * scaleA - bx;
        const dy = ay * scaleA - by;
        return dx * dx + dy * dy <= threshold * threshold;
      });
    }

    // if (bPoints.length === 1) {
    //   const [bx, by] = bPoints[0];
    //   return aPoints.some(([ax, ay]) => {
    //     const dx = ax * scaleA - bx;
    //     const dy = ay * scaleA - by;
    //     return dx * dx + dy * dy <= threshold * threshold;
    //   });
    // }

    // Segment-to-segment proximity
    for (let i = 1; i < aPoints.length; i++) {
      const [ax1, ay1] = aPoints[i - 1];
      const [ax2, ay2] = aPoints[i];
      for (let j = 0; j < bPoints.length; j++) {
        const [bx1, by1] = bPoints[j];
        const [bx2, by2] = bPoints.length === 1 ? bPoints[j] : bPoints[j+1];
        if (segmentsClose(ax1 * scaleA, ay1, ax2 * scaleA, ay2 * scaleA, bx1, by1, bx2 , by2, threshold)) {
          return true;
        }
      }
    }

    return false;
  }

  function segmentsClose(
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number,
    threshold: number
  ): boolean {
    const thresholdSq = threshold * threshold;

    // Calculate squared distance between two segments
    const distSqSegmentToSegment = (): number => {
      // Helper to compute distance squared from a point to a segment
      const pointSegmentDistSq = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return (px - x1) ** 2 + (py - y1) ** 2;
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * (x2 - x1);
        const projY = y1 + t * (y2 - y1);
        return (px - projX) ** 2 + (py - projY) ** 2;
      };

      return Math.min(
        pointSegmentDistSq(x1, y1, x3, y3, x4, y4),
        pointSegmentDistSq(x2, y2, x3, y3, x4, y4),
        pointSegmentDistSq(x3, y3, x1, y1, x2, y2),
        pointSegmentDistSq(x4, y4, x1, y1, x2, y2)
      );
    };

    // Optionally check actual segment intersection too
    // const segmentsIntersect = (): boolean => {
    //   const ccw = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number): boolean =>
    //     (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
      
    //   return (
    //     ccw(x1, y1, x3, y3, x4, y4) !== ccw(x2, y2, x3, y3, x4, y4) &&
    //     ccw(x1, y1, x2, y2, x3, y3) !== ccw(x1, y1, x2, y2, x4, y4)
    //   );
    // };

    return distSqSegmentToSegment() <= thresholdSq// || segmentsIntersect();
  }

  function getSvgPathFromStroke(str: Stroke) {
    const stroke = getStroke(str.points, str.options)
    if (!stroke.length) return '';

    // Scale stroke to match its original box size
    const scaleX = boxWidth / str.box.w;
    const scaleY = boxHeight / str.box.h;
    const scale = Math.min(scaleX, scaleY);

    const d = stroke.reduce(
      (acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length]
        // Apply scale to coordinates
        const sx0 = x0 * scale;
        const sy0 = y0 * scale;
        const sx1 = x1 * scale;
        const sy1 = y1 * scale;
        acc.push(sx0, sy0, (sx0 + sx1) / 2, (sy0 + sy1) / 2);
        // acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
        return acc
      },
      ["M", ...stroke[0].map(c => c * scale), "Q"]
    )
    d.push("Z")
    return d.join(" ")
  }

  async function onPictureLoaded(e: Event & { currentTarget: EventTarget & HTMLInputElement; }) {
    e.preventDefault();

		const files = e.currentTarget.files;
		const normalized = files && files.length > 0 ? await normalizeFiles(files) : [];
    const resized = await resizeImage(normalized[0]);
    const base64 = await fileToBase64(resized);

    blockReloadBg = true

    persistedPage.content = ({ bg: base64, bgOffset: { x: 0, y: 0 } })
    reloadBgImage(resized);

    // clear input element
    if (elmInputBg) elmInputBg.value = ''

    setTimeout(() => { blockReloadBg = false });
  }

  function reloadBgImage(image: File|Blob|undefined) {
    if (!elmBg) return

    if (!image) {
      elmBg?.setAttribute('src', '');
      return
    }

    const url = URL.createObjectURL(image);
    elmBg.onload = () => {
      URL.revokeObjectURL(url);
    };
    elmBg.onerror = () => {
      URL.revokeObjectURL(url);
    };
    elmBg.src = url;
  }
  
  $effect(() => {
    if (persistedPage.content.bg) {
      untrack(() => {
        if (persistedPage.content.bg && !blockReloadBg) {
          const base64 = base64ToBlob(persistedPage.content.bg)
          reloadBgImage(base64);
        }
      })
    }
  });

  $effect(() => {
    if (locked) {
      untrack(() => finishGesture(true))
    }
  });
  
  onMount(() => {
    elmBox?.addEventListener('pointerdown', handlePointerDown, { passive: false });
    elmBox?.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);



    return () => {
      elmBox?.removeEventListener('pointerdown', handlePointerDown);
      elmBox?.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }
  });
  
</script>


<input 
  bind:this={elmInputBg}
  onchange={(e) => onPictureLoaded(e)}
  type="file" 
  accept="image/jpeg,image/png,image/webp"
  multiple={false} 
  hidden
/>

<div
  bind:this={elmBox}
  bind:clientWidth={boxWidth}
  bind:clientHeight={boxHeight}
  data-dragging={isDraggingImage}
  data-tool={tool}
  id="canvas-html" 
  class="
    relative touch-none overflow-hidden 
    data-[dragging='true']:overflow-visible 
    data-[tool='brush']:cursor-crosshair
    data-[tool='eraser']:cursor-crosshair
    data-[tool='bg']:cursor-move
    data-[tool='bg']:data-[dragging='true']:cursor-grabbing
    {restClasses}
  " 
  {...restProps}
> 
  <img 
    bind:this={elmBg} alt=""
    class:hidden={!persistedPage.content.bg}
    class="absolute -z-1 top-1/2 left-1/2 will-change-transform min-w-full min-h-full object-cover"
    style="transform: translate(-50%, -50%) translateY({isDraggingImage ? activeOffset.y : persistedPage.content.bgOffsetY}%);"
  />
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {boxWidth} {boxHeight}">
    {#each persistedPage.content.strokes as stroke, index}
      {#if stroke.points.length}
        <path
          d={getSvgPathFromStroke(stroke)} fill={stroke.color} 
          fill-opacity={erasedStrokeIds.has(index) ? 0.5 : 1.0}
          stroke-linecap="round" stroke-linejoin="round" stroke-width="0" stroke="transparent"
        />
      {/if}
    {/each}
    {#if activeStroke}
      {#if activeStroke.points.length}
        <path
          d={getSvgPathFromStroke(activeStroke)} fill={activeStroke.color} 
          stroke-linecap="round" stroke-linejoin="round" stroke-width="0" stroke="transparent"
        />
      {/if}
    {/if}
  </svg>
</div>