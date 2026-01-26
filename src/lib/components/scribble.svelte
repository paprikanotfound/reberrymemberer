<script lang="ts">
  import { getStroke } from 'perfect-freehand';
  import { drawGesture } from '$lib/actions/drawGesture';
  import { zoomPanGesture, type ZoomPanState } from '$lib/actions/zoomPanGesture';
  import { fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { resizeImage, detectImageBrightness } from '$lib/utils/images';
  import { base64ToBlob, fileToBase64, normalizeFiles } from '$lib/utils/files';
	import { MediaQuery, SvelteSet } from 'svelte/reactivity';
	import { onMount, tick, untrack } from 'svelte';
	import type { Stroke } from './scribble-state.svelte';

  interface Props {
    strokes?: Stroke[];
    backgroundColor?: string;
    backgroundImage?: string | null;
    color?: string;
    size?: number;
    class?: string;
    targetWidth?: number;
    targetHeight?: number;
    showBackgroundSelector?: boolean;
    penMode?: boolean;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    showSafeZone?: boolean;
    safeZoneWidth?: number;
    safeZoneHeight?: number;
    showInkFreeArea?: boolean;
    inkFreeWidth?: number;
    inkFreeHeight?: number;
    inkFreeOffsetRight?: number;
    inkFreeOffsetBottom?: number;
    children?: import('svelte').Snippet;
    [key: string]: any;
  }

  let {
    strokes = $bindable([]),
    backgroundColor = $bindable("#ffffff"),
    backgroundImage = $bindable<string | null>(null),
    color = $bindable('#000000'),
    size = $bindable(5),
    targetWidth = 1800,
    targetHeight = 1200,
    showBackgroundSelector = false,
    penMode = $bindable(false),
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
    showSafeZone = false,
    safeZoneWidth,
    safeZoneHeight,
    showInkFreeArea = false,
    inkFreeWidth,
    inkFreeHeight,
    inkFreeOffsetRight,
    inkFreeOffsetBottom,
    children,
    class: restClasses,
    ...restProps
  }: Props = $props();

  // Workaround for weird reactivity issue
  let _strokes = $derived($state.snapshot(strokes))

  let elmBox: HTMLDivElement | undefined = $state();
  let elmInputBg: HTMLInputElement | undefined = $state();
  let elmBg: HTMLImageElement | undefined = $state();
  let boxWidth: number = $state(0);
  let boxHeight: number = $state(0);

  let activeStroke: Stroke | undefined = $state();
  let isFullscreen = $state(false);

  // Internal state for display URL (converted from base64)
  let displayUrl: string | null = $state(null);

  // Convert base64 to blob URL when backgroundImageUrl changes
  $effect(() => {
    backgroundImage;
    untrack(() => { onBackgroundChanged(); });
  });


  // Cleanup on unmount
  onMount(() => {
    return () => {
      if (displayUrl) {
        URL.revokeObjectURL(displayUrl);
      }
    };
  });

  // Zoom and pan state for fullscreen mode
  let zoomPanState = $state<ZoomPanState>({ scale: 1, panX: 0, panY: 0, isGestureActive: false });

  // Toolbar state
  let expandedTool: 'color' | 'size' | 'background' | null = $state(null);
  let activeTool: 'draw' | 'erase' = $state('draw');

  // Available colors and sizes - different palettes for light/dark backgrounds
  const lightBgColors = ['#000000', '#FF6B6B', '#69DB7C', '#00068E', '#CC5DE8'];
  const darkBgColors = ['#FFFFFF', '#FF6B6B', '#69DB7C', '#4A9EFF', '#CC5DE8'];
  let colors = $state<string[]>(lightBgColors);
  const sizes = [2, 5, 8, 12, 16];

  let eraserStroke: { points: [number, number, number][] } | undefined = $state();
  let erasedStrokeIndices = new SvelteSet<number>();

  // Detect if mobile based on screen width
  const isMobile = new MediaQuery('max-width: 640px');
  

  function handleStrokeComplete(stroke: Stroke) {
    if (activeTool === 'draw') {
      strokes ??= [];
	    strokes.push(stroke);
    } else if (activeTool === 'erase' && erasedStrokeIndices.size > 0) {
      strokes = strokes.filter((_, i) => !erasedStrokeIndices.has(i));
      erasedStrokeIndices.clear();
    }
    eraserStroke = undefined;
  }

  function handleActiveStrokeChange(stroke: Stroke | undefined) {
    if (activeTool === 'draw') {
      activeStroke = stroke;
    } else if (activeTool === 'erase') {
      eraserStroke = stroke ? { points: stroke.points } : undefined;

      // Check for intersections with existing strokes
      if (eraserStroke && eraserStroke.points.length > 0) {
        const lastPoint = eraserStroke.points[eraserStroke.points.length - 1];

        strokes.forEach((existingStroke, index) => {
          if (!erasedStrokeIndices.has(index) && isPointNearStroke(lastPoint, existingStroke)) {
            erasedStrokeIndices.add(index);
          }
        });
      }
    }
  }

  function isPointNearStroke(point: [number, number, number], stroke: Stroke): boolean {
    const [px, py] = point;
    const threshold = Math.max(stroke.options.size || 5, 10);
    const thresholdSq = threshold * threshold;

    for (let i = 0; i < stroke.points.length; i++) {
      const [sx, sy] = stroke.points[i];
      const dx = px - sx;
      const dy = py - sy;
      const distSq = dx * dx + dy * dy;

      if (distSq <= thresholdSq) {
        return true;
      }
    }

    return false;
  }

  function toggleEraser() {
    activeTool = activeTool === 'draw' ? 'erase' : 'draw';
    erasedStrokeIndices.clear();
    eraserStroke = undefined;
  }

  function undo() { onUndo?.(); }


  function redo() { onRedo?.(); }

  
  function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    if (isFullscreen) {
      zoomPanState = { scale: 1, panX: 0, panY: 0, isGestureActive: false };
    } else {
      expandedTool = null;
    }
  }

  function toggleTool(tool: 'color' | 'size' | 'background') {
    expandedTool = expandedTool === tool ? null : tool;
  }

  function selectColor(newColor: string) {
    color = newColor;
    expandedTool = null;
  }

  function selectSize(newSize: number) {
    size = newSize;
    expandedTool = null;
  }

  function selectBackgroundImage() {
    elmInputBg?.click();
    expandedTool = null;
  }

  function clearBackgroundImage() {
    backgroundImage = null;
    expandedTool = null;
  }

  async function onBackgroundImageLoaded(e: Event & { currentTarget: EventTarget & HTMLInputElement; }) {
    e.preventDefault();

    const files = e.currentTarget.files;
    const normalized = files && files.length > 0 ? await normalizeFiles(files) : [];
    if (normalized.length === 0) return;

    const resized = await resizeImage(normalized[0]);
    const base64 = await fileToBase64(resized);

    // Store as base64 for persistence
    backgroundImage = base64;

    // Clear input element
    if (elmInputBg) elmInputBg.value = '';
  }

  async function onBackgroundChanged() {
    if (backgroundImage && backgroundImage.startsWith('data:')) {
      try {
        // Convert base64 to blob URL for display  
        const blob = base64ToBlob(backgroundImage);
        displayUrl = URL.createObjectURL(blob);
        
        await tick(); // ensure that the image element is loaded first 
        
        if (elmBg) {
          elmBg.src = displayUrl;

          const onImageLoad = () => {
            if (!elmBg) return;
            const brightness = detectImageBrightness(elmBg);
            
            colors = brightness === 'dark' ? darkBgColors : lightBgColors;
            
            if (!colors.includes(color)) {
              color = colors[0];
            }
          };
          
          if (elmBg.complete && elmBg.naturalWidth > 0) {
            onImageLoad();
          } else {
            elmBg.addEventListener('load', onImageLoad, { once: true });
          }
        }
        
      } catch (e) {
        console.error('Failed to convert base64 to blob URL:', e);
      }
    } else {

      if (displayUrl) {
        URL.revokeObjectURL(displayUrl);
        displayUrl = null;
      }

      if (elmBg) elmBg.src = '';

      // No background image - use light background palette
      colors = lightBgColors;

      if (!colors.includes(color)) {
        color = colors[0];
      }
    }
  }

  function handleTwoFingerTap() { undo(); }

  
  function handleZoomPanChange(state: ZoomPanState) { zoomPanState = state; }


  function getSvgPathFromStroke(str: Stroke) {
    const stroke = getStroke(str.points, str.options);
    if (!stroke.length) return '';

    // Points are already in target coordinate system, no scaling needed
    const d = stroke.reduce(
      (acc, [x0, y0], i, arr) => {
        const [x1, y1] = arr[(i + 1) % arr.length];
        acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        return acc;
      },
      ["M", ...stroke[0], "Q"]
    );
    d.push("Z");
    return d.join(" ");
  }

  function clear() { strokes = []; }

</script>

<!-- Hidden file input for background image -->
<input
  bind:this={elmInputBg}
  onchange={onBackgroundImageLoaded}
  type="file"
  accept="image/jpeg,image/png,image/webp"
  multiple={false}
  hidden
/>

{#snippet actionToolbar()}
  {#if expandedTool === null}
    <div class="flex flex-row gap-2">
      <!-- Eraser button -->
      <button
        onclick={toggleEraser}
        class="btn-ui"
        class:selected={activeTool === 'erase'}
        aria-label="Eraser"
        transition:scale={{ duration: 200, start: 0.8 }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8.5 13H14M3.5 8.5L7.79289 4.20711C8.18342 3.81658 8.81658 3.81658 9.20711 4.20711L11.7929 6.79289C12.1834 7.18342 12.1834 7.81658 11.7929 8.20711L7.5 12.5L3.20711 12.5C2.81658 12.5 2.18342 12.5 1.79289 12.1095C1.40237 11.719 1.40237 11.0858 1.79289 10.6953L3.5 8.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  {/if}
{/snippet}

{#snippet toolbar()}
  <div class="relative">
    <!-- Main toolbar buttons -->
    <div class="flex flex-row items-center gap-2 min-h-10">
      {#if expandedTool === null}
        <!-- Collapsed state: show color, size, and background buttons in a row -->
        <!-- Color button -->
        <button
          onclick={() => toggleTool('color')}
          class="btn-ui"
          aria-label="Select color"
          transition:scale={{ duration: 200, start: 0.8 }}
        >
          <div class="w-5 h-5 rounded border border-white/50" style:background-color={color}></div>
        </button>

        <!-- Size button -->
        <button
          onclick={() => toggleTool('size')}
          class="btn-ui"
          aria-label="Select size"
          transition:scale={{ duration: 200, start: 0.8 }}
        >
          <div class="rounded-full bg-white" style:width="{size}px" style:height="{size}px"></div>
        </button>

        <!-- Background button (optional) -->
        {#if showBackgroundSelector}
          <button
            onclick={selectBackgroundImage}
            class="btn-ui"
            class:selected={backgroundImage !== null}
            aria-label="Select background image"
            transition:scale={{ duration: 200, start: 0.8 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image-icon lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
          </button>
          {#if backgroundImage !== null}
            <button
              onclick={clearBackgroundImage}
              class="btn-ui"
              aria-label="Clear background image"
              transition:scale={{ duration: 200, start: 0.8 }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          {/if}
        {/if}
      {/if}
    </div>

    <!-- Submenu overlays (positioned above) -->
    {#if expandedTool === 'color'}
      <div class="absolute top-0 right-0 flex flex-row items-center gap-2">
        <!-- Expanded color picker -->
        {#each colors as colorOption, i}
          <button
            onclick={() => selectColor(colorOption)}
            class="btn-ui toolbar-btn"
            style="--btn-index: {colors.length - i};"
            class:selected={color === colorOption}
            aria-label="Select color {colorOption}"
          >
            <div class="w-5 h-5 rounded border border-white/50" style:background-color={colorOption}></div>
          </button>
        {/each}
        <!-- Close button -->
        <button
          onclick={() => toggleTool('color')}
          class="btn-ui toolbar-btn"
          style="--btn-index: 0;"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg>
        </button>
      </div>
    {:else if expandedTool === 'size'}
      <div class="absolute top-0 right-0 flex flex-row items-center gap-2">
        <!-- Expanded size picker -->
        {#each sizes as sizeOption, i}
          <button
            onclick={() => selectSize(sizeOption)}
            class="btn-ui toolbar-btn flex items-center justify-center"
            style="--btn-index: {sizes.length - i};"
            class:selected={size === sizeOption}
            aria-label="Select size {sizeOption}"
          >
            <div class="rounded-full bg-white" style:width="{sizeOption}px" style:height="{sizeOption}px"></div>
          </button>
        {/each}
        <!-- Close button -->
        <button
          onclick={() => toggleTool('size')}
          class="btn-ui toolbar-btn"
          style="--btn-index: 0;"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path></svg>
        </button>
      </div>
    {/if}
  </div>
{/snippet}

{#snippet canvas(classes = '', isFullscreenCanvas = false)}
  <div
    bind:this={elmBox}
    bind:clientWidth={boxWidth}
    bind:clientHeight={boxHeight}
    use:drawGesture={{
      onStrokeComplete: handleStrokeComplete,
      getDrawingOptions: () => ({ color: activeTool === 'erase' ? '#000000' : color, size }),
      getBoxSize: () => ({ width: boxWidth, height: boxHeight }),
      getTargetSize: () => ({ width: targetWidth, height: targetHeight }),
      onActiveStrokeChange: handleActiveStrokeChange,
      onTwoFingerTap: () => { if (isFullscreen && !zoomPanState.isGestureActive) handleTwoFingerTap() },
      enabled: isFullscreenCanvas || !isMobile.current,
      penMode: penMode
    }}
    class="relative overflow-hidden cursor-crosshair {classes}"
    class:touch-none={isFullscreen}
    class:fullscreen-canvas={isFullscreenCanvas}
    style:background-color="{backgroundColor}"
    style:aspect-ratio="{targetWidth}/{targetHeight}"
    {...!isFullscreen ? restProps : {}}
  >
    <!-- Background image -->
    {#if displayUrl}
      <img
        bind:this={elmBg}
        src={displayUrl}
        alt=""
        class="absolute inset-0 w-full h-full object-cover"
        style="z-index: 0;"
      />
    {/if}
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {targetWidth} {targetHeight}" class="relative z-20 w-full h-full">
      <!-- Define turbulence filter -->
      <!-- <defs>
        <filter id="turbulence-filter">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02 0.02"
            numOctaves="1"
            result="turbulence"
            seed="0"
          >
            <animate
              attributeName="seed"
              from="0"
              to="100"
              dur="1s"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap
            in="SourceGraphic"
            in2="turbulence"
            scale="5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs> 
      filter={!isFullscreen && !isMobile.current ? "url(#turbulence-filter)" : undefined}
      -->
      {#each _strokes as stroke, index (index)}
        {#if stroke.points.length}
          <path
            d={getSvgPathFromStroke(stroke as Stroke)}
            fill={stroke.color}
            fill-opacity={erasedStrokeIndices.has(index) ? 0.3 : 1}
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="0"
            stroke="transparent"
          />
        {/if}
      {/each}
      {#if activeStroke && activeStroke.points.length && activeTool === 'draw'}
        <path
          d={getSvgPathFromStroke(activeStroke)}
          fill={activeStroke.color}
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="0"
          stroke="transparent"
        />
      {/if}
    </svg>
  </div>
  
  <!-- Overlays (absolute positioned over the canvas) -->
  {#if showSafeZone || showInkFreeArea || children}
    <div class="absolute inset-0 pointer-events-none z-20">
      <!-- Safe zone indicator (optional) -->
      {#if showSafeZone && safeZoneWidth && safeZoneHeight}
        <div
          class="absolute border border-dashed border-blue-400/50"
          style:left="{((targetWidth - safeZoneWidth) / 2 / targetWidth) * 100}%"
          style:right="{((targetWidth - safeZoneWidth) / 2 / targetWidth) * 100}%"
          style:top="{((targetHeight - safeZoneHeight) / 2 / targetHeight) * 100}%"
          style:bottom="{((targetHeight - safeZoneHeight) / 2 / targetHeight) * 100}%"
        ></div>
      {/if}

      <!-- Ink-free area indicator (optional) -->
      {#if showInkFreeArea && inkFreeWidth && inkFreeHeight && inkFreeOffsetRight !== undefined && inkFreeOffsetBottom !== undefined}
        <div
          class="pointer-events-auto cursor-not-allowed absolute bg-red-900/5 border border-dashed border-red-400/70"
          style:width="{(inkFreeWidth / targetWidth) * 100}%"
          style:height="{(inkFreeHeight / targetHeight) * 100}%"
          style:right="{(inkFreeOffsetRight / targetWidth) * 100}%"
          style:bottom="{(inkFreeOffsetBottom / targetHeight) * 100}%"
        >
          <span class="absolute top-1 left-1 text-[10px] text-red-600 font-medium">Address Area</span>
        </div>
      {/if}

      <!-- Custom snippet for additional overlays -->
      {#if children}
        {@render children()}
      {/if}
    </div>
  {/if}
{/snippet}


{#if isFullscreen}
  <!-- Fullscreen overlay -->
  <div
    class="fullscreen-overlay select-none touch-none fixed inset-0 z-50 flex items-center justify-center bg-neutral-400/95"
    transition:fade={{ duration: 200, easing: cubicOut }}
    use:zoomPanGesture={{
      onZoomPanChange: handleZoomPanChange,
      getCanvasSize: () => ({ width: boxWidth, height: boxHeight }),
      minScale: 1,
      maxScale: 5.5,
      enabled: isFullscreen
    }}
  >
    <div class="relative w-full h-full flex items-center justify-center p-3">
      <!-- Top right buttons: Undo, Redo, Close -->
      <div class="absolute top-3 right-3 z-30 flex flex-row gap-2" transition:fade={{ duration: 200, delay: 100 }}>
        <!-- Undo button -->
        <button
          onclick={undo}
          class="btn-ui"
          aria-label="Undo"
          disabled={!canUndo}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 7H11C12.6569 7 14 8.34315 14 10C14 11.6569 12.6569 13 11 13H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M6 5L4 7L6 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <!-- Redo button -->
        <button
          onclick={redo}
          class="btn-ui"
          aria-label="Redo"
          disabled={!canRedo}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 7H5C3.34315 7 2 8.34315 2 10C2 11.6569 3.34315 13 5 13H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M10 5L12 7L10 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <!-- Close button -->
        <button
          onclick={toggleFullscreen}
          class="btn-ui"
          aria-label="Exit fullscreen"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6.75 9.25H2.25M6.75 9.25V13.75M6.75 9.25L2.25 13.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M9.25 6.75L13.75 6.75M9.25 6.75L9.25 2.25M9.25 6.75L13.75 2.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>
        </button>
      </div>

      <!-- Bottom left action toolbar -->
      <div class="absolute bottom-3 left-3 z-40" transition:fade={{ duration: 200, delay: 100 }}>
        {@render actionToolbar()}
      </div>

      <!-- Bottom right toolbar -->
      <div class="absolute bottom-3 right-3 z-40" transition:fade={{ duration: 200, delay: 100 }}>
        {@render toolbar()}
      </div>

      <!-- Fullscreen canvas with aspect ratio maintained and zoom/pan transforms -->
      <div
        class="fullscreen-wrapper"
        style:aspect-ratio="{targetWidth}/{targetHeight}"
        style:transform="scale({zoomPanState.scale}) translate({zoomPanState.panX / zoomPanState.scale}px, {zoomPanState.panY / zoomPanState.scale}px)"
        style:transform-origin="center"
        style:transition={zoomPanState.scale > 1 ? 'none' : 'transform 0.2s ease-out'}
        transition:scale={{ duration: 300, start: 0.95, easing: cubicOut }}
      >
        {@render canvas(`grid-bg`, true)}
      </div>
    </div>
  </div>
{:else}
  <!-- Normal inline view -->
  <div class="relative">
    <!-- Top right buttons: Undo, Redo, Fullscreen -->
    <div class="absolute top-2 right-2 z-30 flex flex-row gap-2">
      <!-- Undo button -->
      <button
        onclick={undo}
        class="btn-ui"
        aria-label="Undo"
        disabled={!canUndo}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4 7H11C12.6569 7 14 8.34315 14 10C14 11.6569 12.6569 13 11 13H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M6 5L4 7L6 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- Redo button -->
      <button
        onclick={redo}
        class="btn-ui"
        aria-label="Redo"
        disabled={!canRedo}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 7H5C3.34315 7 2 8.34315 2 10C2 11.6569 3.34315 13 5 13H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M10 5L12 7L10 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- Fullscreen button -->
      <button
        onclick={toggleFullscreen}
        class="btn-ui"
        aria-label="Enter fullscreen"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="pointer-events: auto;"><path d="M2.25 13.75H6.75M2.25 13.75V9.25M2.25 13.75L6.75 9.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path><path d="M13.75 2.25H9.25M13.75 2.25V6.75M13.75 2.25L9.25 6.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events: auto;"></path></svg>
      </button>
    </div>

    <!-- Bottom left action toolbar (hidden on mobile, visible on desktop) -->
    <div class="absolute bottom-2 left-2 z-30 hidden sm:block">
      {@render actionToolbar()}
    </div>

    <!-- Bottom right toolbar (hidden on mobile, visible on desktop) -->
    <div class="absolute bottom-2 right-2 z-30 hidden sm:block">
      {@render toolbar()}
    </div>

    {@render canvas(`border border-zinc-200 relative ${restClasses}`)}

    <!-- Mobile tap overlay to trigger fullscreen -->
    {#if isMobile.current}
      <button
        onclick={toggleFullscreen}
        class="absolute inset-0 z-40 cursor-pointer bg-transparent"
        aria-label="Tap to enter fullscreen"
      ></button>
    {/if}
  </div>
{/if}


<style>
  /* Prevent text selection and iOS share button/callout in fullscreen */
  .fullscreen-overlay,
  .fullscreen-overlay *,
  .fullscreen-wrapper,
  .fullscreen-wrapper * {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }

  .fullscreen-overlay {
    touch-action: none;
  }

  .fullscreen-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: calc(100vw - 2rem);
    max-height: calc(100vh - 2rem);
    touch-action: none;
  }

  /* postard canvas-like grid  */
  .grid-bg {
    background-image: 
      linear-gradient(to right, #dedddd .5px, transparent .5px),
      linear-gradient(to bottom, #dedddd .5px, transparent .5px);
    background-size: 10px 10px; /* adjust grid cell size */
  }

  /* Toolbar button slide-up animation with wave effect */
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .toolbar-btn {
    animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    animation-delay: calc(var(--btn-index) * 0.05s);
    opacity: 0;
  }

  /* Portrait orientation: constrain width, let aspect-ratio calculate height */
  @media (orientation: portrait) {
    .fullscreen-wrapper {
      width: calc(100vw - 2rem);
      height: auto;
    }
    .fullscreen-canvas {
      width: 100%;
      height: 100%;
    }
  }

  /* Landscape orientation: constrain height, let aspect-ratio calculate width */
  @media (orientation: landscape) {
    .fullscreen-wrapper {
      width: auto;
      height: calc(100vh - 5rem);
    }
    .fullscreen-canvas {
      width: 100%;
      height: 100%;
    }
  }
</style>