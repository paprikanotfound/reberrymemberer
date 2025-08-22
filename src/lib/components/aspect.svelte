<script lang="ts">
	import { onMount, type Snippet } from "svelte";
	import { MediaQuery } from "svelte/reactivity";

  type Props = {
    aspect: number;
    class?: string;
    style?: string;
    children: Snippet;
    [key: string]: any;
  };

  let { aspect, class: classes, style: restStyle, children, ...restProps }: Props = $props();
  let container: HTMLDivElement | undefined = $state();

	const large = new MediaQuery('min-width: 800px');
  let styleSize: string = $state(large.current ? 
		`height: 100%; width: auto; aspect-ratio: ${aspect};` : 
		`width: 100%; height: auto; aspect-ratio: ${aspect};`
	);
  // let styleSize: string = $state(`width: 100%; height: auto; aspect-ratio: ${aspect};`);

  function updateSize() {
    if (!container || !container.parentElement! || !aspect) return;

		const { clientWidth: w, clientHeight: h } = container.parentElement;
		const containerAspect = w / h;
		if (containerAspect > aspect) {
			// Screen is wider than desired ratio — limit by height
			styleSize = `height: 100%; width: auto; aspect-ratio: ${aspect};`;
		} else {
			// Screen is taller than desired ratio — limit by width
			styleSize = `width: 100%; height: auto; aspect-ratio: ${aspect};`;
		}
	}

	onMount(() => {
		const observer = new ResizeObserver(updateSize);
		observer.observe(document.body);
		updateSize();
		return () => observer.disconnect();
	});
</script>

<div bind:this={container} class={classes} {...restProps} style="{styleSize}{restStyle}">
  {@render children()}
</div>

<!-- <div class="aspect-box {classes}" style:aspect-ratio={aspect} {...restProps}>
	{@render children()}
</div>

<style>
	@container (aspect-ratio > 1) {
		.aspect-box {
			height: 100%;
			width: auto;
		}
	}
	@container (aspect-ratio <= 1) {
		.aspect-box {
			width: 100%;
			height: auto;
		}
	}
</style> -->


