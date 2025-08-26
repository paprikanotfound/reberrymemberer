<script lang="ts">
	import { onMount } from 'svelte';
  import { Spring } from "svelte/motion";
	import { mapRange } from '$lib/utils/utils';

  interface Props {
    front: string;
    back: string;
    aspect?: string;
    class?: string;
		[key: string]: any;
  }

  let { front, back, locked, aspect, class: restClasses, ...restProps  }: Props = $props()

	const MAX_BRIGHTNESS = 1.1
  const FLIP_THRESHOLD = 80;
  const VELOCITY_THRESHOLD = 6;
  
  let elm: HTMLDivElement | undefined = $state()
  let parentWidth = $state(0)
  let parentHeight = $state(0)
  let activeSpinY = $state(0)
  let tilting = new Spring({ x: 0, y: 0, bright: 1 });
  let glaring = new Spring({ posX: 50, posY: 50, alpha: 0.2 });
  let mouseOffset = $state({ x: 0, y: 0 });

  let pointerIsIn = $state(false);
  let isDragging = $state(false);
  let dragStart = $state({ x: 0, y: 0 });
  let initialTilt = $state({ x: 0, y: 0 });
  let dragDelta = $state({ x: 0, y: 0 });
  let dragVelocity = $state(0);
  let lastTime: number | undefined;
  let lastX: number | undefined;
  

	let transformProps = $derived(`
		--rotateX: ${tilting.current.x}deg;
		--rotateY: ${tilting.current.y}deg;
		--brightness: ${Math.min(tilting.current.bright, MAX_BRIGHTNESS)};
		--pointer-x: ${glaring.current.posX}%;
		--pointer-y: ${glaring.current.posY}%;
		--alpha-glare: ${glaring.current.alpha};
	`)
  

  function getCanvasCoords(e: { clientX: number, clientY: number }): [number, number] {
    if (!elm) return [0, 0];
    const rect = elm.getBoundingClientRect();
    const scaleX = elm.clientWidth / rect.width;
    const scaleY = elm.clientHeight / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    return [x, y];
  }
  
	function onMouseLeave(ev: MouseEvent) { 
    pointerIsIn = false
    isDragging = false
    redraw()
  }

  function redraw() {
    if (!pointerIsIn) {
      
      $tilting = { x: 0, y: activeSpinY, bright: 1 }
		  $glaring = { posX: 50, posY: 50, alpha: 0.2 }

    } else {

      const glareX = mapRange(mouseOffset.x, 0, parentHeight, 0, 100)
      const glareY = mapRange(mouseOffset.y, 0, parentHeight, 0, 100)
      
      const range = 5
      const rotateX = mapRange(mouseOffset.y, 0, parentWidth, -range, range)
      const rotateY = mapRange(mouseOffset.x, 0, parentHeight, range, -range)
      const brightness = mapRange(mouseOffset.x, 0, parentHeight, 1, 0.9)
  
      const dx = isDragging ? mouseOffset.x - dragStart.x : 0;
      const dy = isDragging ? mouseOffset.y - dragStart.y : 0;

      $tilting = { 
        x: rotateX - dy * .1, 
        y: activeSpinY + rotateY + dx * .5, 
        bright: brightness,
      }
      $glaring = {
        posX: glareX,
        posY: glareY,
        alpha: 0.55,
      }
    }
	}

  function flip(e: MouseEvent & { currentTarget: EventTarget & HTMLDivElement; }) {
    // ignore clicks when drag occured
    if (Math.abs(dragDelta.x) > 6) return
    
    const [x, y] = getCanvasCoords(e)
    mouseOffset.x = x
    mouseOffset.y = y
    
    activeSpinY += x < elm!.clientWidth/2 ? 180 : -180;
    
    redraw()
  }

  export function flipToBack() {
    activeSpinY = 180;
    redraw()
  }

  function onPointerDown(e: PointerEvent | TouchEvent) {
    // isDragging = true;
    dragDelta = { x: 0, y: 0 };
    dragVelocity = 0;

    const [x, y] = getCanvasCoords('touches' in e ? e.touches[0] : e);
    dragStart = { x, y };
    initialTilt = { ...tilting.current };

    // Prevent default to stop scrolling on mobile
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent | TouchEvent) {
    const [x, y] = getCanvasCoords('touches' in e ? e.touches[0] : e)
    mouseOffset.x = x
    mouseOffset.y = y
    
    if (isDragging) {
      dragDelta = { x: x - dragStart.x, y: y - dragStart.y };
      const now = performance.now();
      const dt = now - (lastTime || now);
      const dx = x - (lastX || x);
      dragVelocity = dx / dt * 16; // normalize to 60fps frame time
      lastTime = now;
      lastX = x;
    }

    redraw()

    // Prevent default to stop scrolling on mobile
    e.preventDefault();
  }

  function onPointerUp(e: PointerEvent) {
    if (!isDragging) return
    
    isDragging = false;
    lastTime = undefined
    lastX = undefined

    if (dragDelta.x < FLIP_THRESHOLD && Math.abs(dragVelocity) > VELOCITY_THRESHOLD) {
      activeSpinY -= 180;
    } else if (dragDelta.x > FLIP_THRESHOLD && Math.abs(dragVelocity) > VELOCITY_THRESHOLD) {
      activeSpinY += 180;
    }

    redraw()

    e.preventDefault()
  }

  onMount(() => {
    let startX = 0;
    let startY = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      // If horizontal swipe dominates, prevent scroll
      if (dx > dy && dx > 10) {
        e.preventDefault();
      }
    };

    elm?.addEventListener("touchstart", onTouchStart, { passive: true });
    elm?.addEventListener("touchmove", onTouchMove, { passive: false }); // critical!
    elm?.addEventListener('pointerdown', onPointerDown, { passive: false });
    elm?.addEventListener('pointermove', onPointerMove, { passive: false });
    elm?.addEventListener('pointerup', onPointerUp, { passive: false });

    return () => {
      elm?.removeEventListener("touchstart", onTouchStart);
      elm?.removeEventListener("touchmove", onTouchMove);
      elm?.removeEventListener('pointerdown', onPointerDown);
      elm?.removeEventListener('pointermove', onPointerMove);
      elm?.removeEventListener('pointerup', onPointerUp);
    }
  });
</script>


{#snippet page(src: string, pos: "front"|"back")}
  <div
    class="
      absolute size-full {pos=="front" ? "rotate-y-0" : "rotate-y-180"} backface-hidden perspective-[1000px]
      scale-100 group-hover:-translate-y-[2px] group-hover:scale-[102%] data-[dragging='true']:scale-[104%] transition-all duration-300 ease-out
      postcard-shadow group-hover:postcard-shadow-hover outline-[.5px] outline-zinc-400/50
    "
    data-dragging={isDragging}>
    <img 
      class="absolute object-cover size-full select-none" 
      style="filter: brightness(var(--brightness));" 
      loading="eager"
      {src} alt="" 
      />
    <div
      class="absolute w-full h-full overflow-hidden transition-opacity duration-[250ms] ease-out mix-blend-overlay"
      style="
        transform: translateZ(1.41px);
        background-image: radial-gradient(
          farthest-corner circle at var(--pointer-x) var(--pointer-y),
          hsla(0, 0%, 100%, 0.6) 10%,
          hsla(0, 0%, 100%, 0.55) 20%,
          hsla(0, 0%, 0%, 0.5) 100%
        );
        opacity: var(--alpha-glare);
      "></div>
  </div>
{/snippet}


<div
  role="button"
  tabindex={-1}
  bind:this={elm}
  bind:clientWidth={parentWidth}
  bind:clientHeight={parentHeight}
  onclick={flip}
  onpointerenter={(e) => { pointerIsIn = true }}
  onpointerleave={(e) => { onMouseLeave(e); }}
  onkeydown={() => {}}
  class:cursor-grabbing={isDragging}
  class="group relative transition-[transform,filter] duration-[250ms] ease-out transform-3d cursor-grab select-none {restClasses}"
  style="perspective: 1000px; {transformProps}"
  {...restProps}
>
  <div
    class="relative w-full h-full select-none will-change-transform transform-3d"
    style="transform: rotateX(var(--rotateX)) rotateY(var(--rotateY)) translate3d(0px, 0px, 0.01px);">
    {@render page(front, "front")}
    {@render page(back, "back")}
  </div>
</div>