<script lang="ts">
	import { POSTCARD, createPersistedScribble } from "$lib";
	import Scribble from "$lib/components/scribble.svelte";
  import countries from '$lib/countries.json';
  import { onMount } from 'svelte';

  let penMode = $state(false);
  // Create persisted state for both scribble instances
  const scribbleFront = createPersistedScribble('postcard-front');
  const scribbleBack = createPersistedScribble('postcard-back');

  // Detect pen interactions anywhere on the page
  onMount(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'pen' && !penMode) {
        penMode = true;
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  });
</script>

<div class="select-none flex flex-col items-start justify-center gap-8 p-3">
  <!-- exit Pen mode -->
  <div class:hidden={!penMode} class="fixed left-2 top-10 z-40">
    <button class="flex items-center justify-center gap-1" onclick={() => { penMode = false }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      Exit pen mode
    </button>
  </div>

  <a href="/">(back)</a>
  
  <div class="w-full flex flex-col gap-3 lg:grid lg:grid-cols-2">
    <div class="flex gap-4">
      <span>001</span>
      <span>Front</span>
    </div>
    <div class="w-fit min-h-52 sm:min-h-[25rem]">
      <Scribble
        class="h-52 sm:h-[25rem]"
        showBackgroundSelector={true}
        targetWidth={1819}
        targetHeight={1311}
        bind:strokes={scribbleFront.content.strokes}
        bind:color={scribbleFront.content.color}
        bind:size={scribbleFront.content.size}
        bind:backgroundImageUrl={scribbleFront.content.backgroundImageUrl}
        bind:penMode={penMode}
        onUndo={() => scribbleFront.undo()}
        onRedo={() => scribbleFront.redo()}
        canUndo={scribbleFront.canUndo}
        canRedo={scribbleFront.canRedo}
      />
    </div>
  </div>
  <div class="w-full flex flex-col gap-3 lg:grid lg:grid-cols-2">
    <div class="flex gap-4">
      <span>002</span>
      <span>Back</span>
    </div>
    <div class="w-fit min-h-52 sm:min-h-[25rem]">
      <Scribble
        class="h-52 sm:h-[25rem]"
        targetWidth={1819}
        targetHeight={1311}
        bind:strokes={scribbleBack.content.strokes}
        bind:color={scribbleBack.content.color}
        bind:size={scribbleBack.content.size}
        bind:backgroundImageUrl={scribbleBack.content.backgroundImageUrl}
        bind:penMode={penMode}
        onUndo={() => scribbleBack.undo()}
        onRedo={() => scribbleBack.redo()}
        canUndo={scribbleBack.canUndo}
        canRedo={scribbleBack.canRedo}
      />
    </div>
  </div>
  <hr>
  <div class="w-full flex flex-col gap-6 lg:grid lg:grid-cols-2 mb-4">
    <div class="flex gap-4">
      <span>003</span>
      <span>Address & Details</span>
    </div>
    <form class="flex flex-col gap-6">
      <div id="address" class="flex flex-col gap-2">
        <label>
          Name:
          <input
            type="text"
            name="sender.name"
            autocomplete="section-sender name"
            required
            
          />
        </label>
        <label>
          Address:
          <input
            type="text"
            name="sender.address"
            autocomplete="section-sender address-line1"
            required
            
          />
        </label>
        <label>
          Address (2):
          <input
            type="text"
            name="sender.addressLine2"
            autocomplete="section-sender address-line2"
            
          />
        </label>
        <label>
          Postal Code:
          <input
            type="text"
            name="sender.postalCode"
            autocomplete="section-sender postal-code"
            required
            
          />
        </label>
        <label>
          City:
          <input
            type="text"
            name="sender.city"
            autocomplete="section-sender address-level2"
            required
            
          />
        </label>
        <label>
          Country:
          <select
            name="sender.country"
            required 
            autocomplete="section-sender country"
          >
            <option value="">Select country</option>
            {#each countries as ctr }
              <option value="{ctr.iso31661Alpha2}">{ctr.englishName}</option>
            {/each}
          </select>
        </label>
      </div>
      <div id="schedule" class="flex flex-col gap-2">
        <label>
          Send Date:
          <input type="date" id="date" class="w-fit flex-none cursor-text" />
        </label>
        <p class="text-sm italic">Notice: All postcards are sent from the Netherlands via priority mail by PostNL. (<a href="{POSTCARD.url_delivery_times}" target="_blank" rel="noopener noreferrer">Delivery times</a> →)</p>
      </div>
      <div id="action" class="">
        <button class="form">Send</button>
      </div>
    </form>
  </div>
</div>