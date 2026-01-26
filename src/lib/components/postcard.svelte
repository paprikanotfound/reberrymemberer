<script lang="ts">
  import { Spring } from "svelte/motion";
	import { mapRange } from '$lib/utils/math';

  interface Props {
    front: string;
    back: string;
    onspin?: (spin: number) => void;
    aspect: number;
    class?: string;
		[key: string]: any;
  }

  let { front, back, onspin, aspect, class: restClasses, ...restProps  }: Props = $props()

	const MAX_BRIGHTNESS = 1.1

  let elm: HTMLDivElement | undefined = $state()
  let parentWidth = $state(0)
  let parentHeight = $state(0)
  let activeSpinY = $state(0)
  let tilting = new Spring({ x: 0, y: 0, bright: 1 });
  let glaring = new Spring({ posX: 50, posY: 50, alpha: 0.2 });
  let mouseOffset = $state({ x: 0, y: 0 });
  let pointerIsIn = $state(false);

	let transformProps = $derived(`
		--rotateX: ${tilting.current.x}deg;
		--rotateY: ${tilting.current.y}deg;
		--brightness: ${Math.min(tilting.current.bright, MAX_BRIGHTNESS)};
		--pointer-x: ${glaring.current.posX}%;
		--pointer-y: ${glaring.current.posY}%;
		--alpha-glare: ${glaring.current.alpha};
		aspect-ratio: ${aspect};
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

	function onMouseLeave() {
    pointerIsIn = false
    redraw()
  }

  function onMouseMove(e: PointerEvent) {
    // Skip mouse move on touch devices
    if (e.pointerType === 'touch') return

    const [x, y] = getCanvasCoords(e)
    mouseOffset.x = x
    mouseOffset.y = y
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

      $tilting = {
        x: rotateX,
        y: activeSpinY + rotateY,
        bright: brightness,
      }
      $glaring = {
        posX: glareX,
        posY: glareY,
        alpha: 0.55,
      }
    }
	}

  function flip(e: MouseEvent) {
    const [x] = getCanvasCoords(e)
    activeSpinY += x < elm!.clientWidth/2 ? 180 : -180;
    onspin?.(activeSpinY)
    redraw()
  }

  export function flipToBack() {
    activeSpinY = 180;
    onspin?.(activeSpinY)
    redraw()
  }
</script>


{#snippet page(src: string, classes?: string)}
  <div
    class="
      w-full h-full backface-hidden scale-100
      group-hover:scale-[101%] 
      group-hover:postcard-shadow-hover postcard-shadow
      transition-all duration-300 ease-out
      {classes}">
    <img
      class="w-full h-full object-cover select-none"
      style="filter: brightness(var(--brightness));"
      loading="eager"
      {src} alt=""
    />
    <div
      class="absolute inset-0 overflow-hidden transition-opacity duration-[250ms] ease-out mix-blend-overlay"
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
  onpointerenter={() => { pointerIsIn = true }}
  onpointermove={onMouseMove}
  onpointerleave={onMouseLeave}
  onkeydown={() => {}}
  class="
    group transition-[transform,filter] duration-[250ms] ease-out transform-3d 
    cursor-pointer select-none {restClasses}
  "
  style="perspective: 1000px; {transformProps}"
  {...restProps}
>
  <div
    class="relative w-full h-full select-none will-change-transform transform-3d"
    style="transform: rotateX(var(--rotateX)) rotateY(var(--rotateY)) translate3d(0px, 0px, 0.01px);">
    {@render page(front, "rotate-y-0")}
    {@render page(back, "rotate-y-180 absolute inset-0")}
  </div>
</div>

<style>
  /* Portrait orientation: constrain width, let aspect-ratio calculate height */
  @media (orientation: portrait) {
    .postcard-wrapper {
      height: auto;
    }
  }
  /* orientation: constrain height, let aspect-ratio calculate width */
  @media (orientation: landscape) {
    .postcard-wrapper {
      width: auto;
    }
  }
</style>
