<script lang="ts">
	import { PersistedState } from "runed";
	import BrushProps from "./brush-props.svelte";
	import { BRUSH_SIZES, type CanvasTool } from "./canvas.types";
	import { onMount, untrack } from "svelte";

  type Props = {
    key: string;
		tools: CanvasTool[];
		initValue: { tool: CanvasTool; color: string; size: number };
		onchange?: (props: { tool: CanvasTool; color: string; size: number }) => void;
		onundo?: () => void;
		onredo?: () => void;
		onclear?: () => void;
		canUndo?: boolean;
		canRedo?: boolean;
		colors: string[];
    class?: string;
    [key: string]: any;
  };

  let { 
		key, tools, initValue, canRedo, canUndo,
		onchange, onundo, onredo, onclear, 
		colors,
		class: classes, ...restProps 
	}: Props = $props();
	let loaded = $state(false)

	const tool = $derived(new PersistedState(`${key}-tool`, initValue.tool))
	const size = $derived(new PersistedState(`${key}-size`, initValue.size))
	const color = $derived(new PersistedState(`${key}-color`, initValue.color))
	
	$effect(() => { 
		// notify changes
		const updated = { 
			tool: tool.current, 
			size: size.current, 
			color: color.current 
		};
		untrack(() => { onchange?.(updated); });
	});

	// onMount(() => {
	// 	loaded = true
	// })

</script>

<div id="toolbar"
	class="
		fixed bottom-2 left-2 sm:bottom-4 sm:left-4 
		p-1 rounded-md shadow-2xl bg-white border-[.5px] border-zinc-400 
		flex items-center gap-1 max-w-[90%] overflow-x-auto
		{classes}
	"
	{...restProps}
>
	<div id="actions" class="flex">
		<button onclick={() => { onundo?.() }} disabled={!canUndo} aria-label="undo" 
			class="p-3 hover:bg-black/10 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
			>
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
				<path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
			</svg>
		</button>
		<button onclick={() => { onredo?.() }} disabled={!canRedo} aria-label="redo" 
			class="p-3 hover:bg-black/10 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
			>
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
				<path stroke-linecap="round" stroke-linejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" />
			</svg>
		</button>
		<button onclick={() => { onclear?.() }} aria-label="clear" 
			class="p-3 hover:bg-black/10 rounded-lg"
			>
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
				<path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
			</svg>
		</button>
	</div>
	<div class="h-8 w-[.5px] bg-zinc-300"></div>
	<div id="tool" class="flex">
		<button id="bg" 
			onclick={() => { tool.current = "bg" }} aria-label="bg" 
			class:hidden={!tools.includes("bg")}	
			data-selected={tool.current=="bg"} 
			class="p-3 hover:bg-black/5 active:bg-black/15 data-[selected='true']:bg-black/10 rounded-lg outline-0"
		>
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
				<path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
			</svg>
		</button>
		<button id="eraser"
			onclick={() => { tool.current = "eraser" }} aria-label="bg" 
			class:hidden={!tools.includes("eraser")}	
			data-selected={tool.current=="eraser"} 
			class="p-3 hover:bg-black/5 active:bg-black/15 data-[selected='true']:bg-black/10 rounded-lg outline-0"
		>
			<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" stroke-width="1.5" class="size-4">
				<path d="M11.1969 2.43934C11.7827 1.85355 12.7324 1.85355 13.3182 2.43934L17.5609 6.68198C18.1467 7.26777 18.1467 8.21751 17.5609 8.8033L9.36396 17.0002H14.5C14.7761 17.0002 15 17.2241 15 17.5002C15 17.7764 14.7761 18.0002 14.5 18.0002H7.81962C7.40984 18.0217 6.99291 17.876 6.67991 17.5629L2.43726 13.3203C1.85148 12.7345 1.85148 11.7848 2.43726 11.199L11.1969 2.43934ZM12.6111 3.14645C12.4159 2.95118 12.0993 2.95118 11.904 3.14645L5.53834 9.51212L10.4881 14.4619L16.8538 8.09619C17.049 7.90093 17.049 7.58435 16.8538 7.38909L12.6111 3.14645ZM9.78098 15.169L4.83123 10.2192L3.14437 11.9061C2.94911 12.1014 2.94911 12.4179 3.14437 12.6132L7.38701 16.8558C7.58227 17.0511 7.89886 17.0511 8.09412 16.8558L9.78098 15.169Z" fill="#212121"/>
			</svg>
		</button>
		<button id="brush"
			onclick={() => { tool.current = "brush" }} aria-label="bg" 
			class:hidden={!tools.includes("brush")}	
			data-selected={tool.current=="brush"} 
			class="p-3 hover:bg-black/5 active:bg-black/15 data-[selected='true']:bg-black/10 rounded-lg outline-0"
		>
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
				<path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
			</svg>
		</button>
	</div>
	<div class="h-8 w-[.5px] bg-zinc-300"></div>
	<BrushProps 
		bind:color={color.current} 
		bind:size={size.current} 
		colors={colors}
		sizes={BRUSH_SIZES}
	>
		<div id="brush" class="p-3 hover:bg-black/10 active:bg-black/15 rounded-lg">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4">
				<path stroke-linecap="round" stroke-linejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
			</svg>
		</div>
	</BrushProps>
</div>
