<script lang="ts">
	import { Popover } from "bits-ui";
	import type { Snippet } from "svelte";
	import { BRUSH_SIZES } from "./canvas.types";

  type Props = {
    color: string;
    size: number;
    colors: string[];
    sizes: typeof BRUSH_SIZES;
		children: Snippet;
		onopen?: (open: boolean) => void;
    [key: string]: any;
  };

  let { color=$bindable(), onopen, size=$bindable(), colors, sizes, children }: Props = $props();
  let open = $state(false);

</script>


<Popover.Root bind:open onOpenChange={(open) => onopen?.(open) }>
	<Popover.Trigger>
		{@render children()}
	</Popover.Trigger>
	<Popover.Content 
		class="p-1 rounded-md shadow-xl bg-white border-[.5px] border-zinc-400 flex flex-col gap-1" 
		onInteractOutside={(e) => { 
			e.preventDefault(); 
			open = false;
		}}
		preventScroll={true}
	>
		<div id="size" class="grid grid-cols-5">
			{#each sizes as sizeOpt }	
				<button 
					onclick={() => { size = sizeOpt.size }} aria-label="bg" 
					data-selected={sizeOpt.size == size}
					class="p-2 hover:bg-black/10 data-[selected='true']:bg-black/20 rounded-lg text-sm font-bold font-sans outline-0"
				>
					<span class="text-sm font-bold font-sans">{sizeOpt.label}</span>
				</button>
			{/each}
		</div>
		<div id="color" class="grid grid-cols-5">
			{#each colors as colorOpt }	
				<button 
					onclick={() => { color = colorOpt; }} aria-label="bg" 
					data-selected={colorOpt == color}
					class="p-2 hover:bg-black/10 data-[selected='true']:bg-black/20 rounded-lg flex justify-center items-center outline-0"
				>
					<div style:background-color={colorOpt} class="size-4 rounded-full border-[.5px]"></div>
				</button>
			{/each}
		</div>
	</Popover.Content>
</Popover.Root>