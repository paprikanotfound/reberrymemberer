<script lang="ts">
	import { createPersistedScribble, POSTCARD_DETAILS, type ScribbleContent } from "$lib";
	import { createCheckout } from "$lib/checkout.remote";
	import { CheckoutSchema } from "$lib/checkout.types";
	import Scribble from "$lib/components/scribble.svelte";
  import countries from '$lib/countries.json';
	import { drawObjectCover, drawStokes } from "$lib/utils/canvas";
	import { base64ToBlob } from "$lib/utils/files";
	import { initForm } from "$lib/utils/forms.svelte";
	import { loadImage } from "$lib/utils/images";
  import { onMount, tick, untrack } from 'svelte';

  let penMode = $state(false);
  
  // Create persisted state for both scribble instances
  const scribbleFront = createPersistedScribble('postcard-front');
  const scribbleBack = createPersistedScribble('postcard-back');

  // Set initial Send Date value
  const today = new Date();
  initForm(createCheckout, () => {
    return {
      sendDate: today.toISOString().split('T')[0],
      country: 'KR', // Default to US
    }
  });
  // Force selected date to be today or later
  $effect(() => {
    const selected = createCheckout.fields.sendDate.value();
    untrack(async () => {
      const a = new Date(selected);
      if (a < today) createCheckout.fields.sendDate.set(today.toISOString().split('T')[0]);
    });
  });

  // Track if the selected country is US
  let isUSAddress = $derived(createCheckout.fields.country.value() === 'US');
  
  async function createPageImage(content: ScribbleContent, type?: string, quality?: number) {
    return new Promise<Blob>(async (res, rej) => {
      const canvas = document.createElement("canvas");
      canvas.width = POSTCARD_DETAILS.size.w;
      canvas.height = POSTCARD_DETAILS.size.h;
      // ctx
      const ctx = canvas.getContext("2d");
      if (!ctx) return rej("No 2D context");
      // bg color
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // bg img
      if (content.backgroundImage && content.backgroundImage.includes(',')) {
        try {
          const elmImage = await loadImage(base64ToBlob(content.backgroundImage));
          if (elmImage) {
            drawObjectCover(ctx, elmImage, canvas.width, canvas.height, 0.5);
          }
        } catch (e) {
          console.error("Failed to load background image:", e);
        }
      }
      drawStokes(ctx, canvas.width, canvas.height, content.strokes);
      // save
      canvas.toBlob(blob => {
        if (blob) res(blob);
        else rej("Failed to export blob");
      }, type, quality);
    })
  }

  async function injectImgFieldsAndSubmit(e: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement; }) {
    e.preventDefault();
    const form = e.currentTarget.form;
    
    const frontBlob = await createPageImage(scribbleFront.content, 'image/jpeg', 0.95);
    const file = new File([frontBlob], 'postcard.png', { type: 'image/png' });
    createCheckout.fields.frontImage.set(file);

    const backBlob = await createPageImage(scribbleBack.content, 'image/jpeg', 0.95);
    const fileBack = new File([backBlob], 'postcard.png', { type: 'image/png' });
    createCheckout.fields.backImage.set(fileBack);

    await tick();
    form?.requestSubmit();
  }

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

<!-- exit Pen mode -->
<div class:hidden={!penMode} class="fixed left-2 top-10 z-40 p-1 rounded-lg backdrop-blur-sm">
  <button class="flex items-center justify-center gap-1" onclick={() => { penMode = false }}>
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
    Exit pen mode
  </button>
</div>

<!-- testing image generation
<button onclick={async () => {
  // Test export and download front image
  const frontBlob = await exportImage(scribbleFront.content);
  const frontUrl = URL.createObjectURL(frontBlob);
  const frontLink = document.createElement('a');
  frontLink.href = frontUrl;
  frontLink.download = 'postcard-front.png';
  frontLink.click();
  URL.revokeObjectURL(frontUrl);
  // Test export and download back image
  const backBlob = await exportImage(scribbleBack.content);
  const backUrl = URL.createObjectURL(backBlob);
  const backLink = document.createElement('a');
  backLink.href = backUrl;
  backLink.download = 'postcard-back.png';
  backLink.click();
  URL.revokeObjectURL(backUrl);
}}>(download)</button> -->

<div class="flex flex-col items-start justify-center gap-8 sm:gap-12 p-3">
  <a href="/">(back)</a>

  <div id="font-page" class="w-full flex flex-col gap-3 md:grid md:grid-cols-2">
    <div class="flex gap-4">
      <span>001</span>
      <span>Front</span>
    </div>
    <div class="w-full" style="aspect-ratio: {POSTCARD_DETAILS.size.w/POSTCARD_DETAILS.size.h};">
      <Scribble
        class="w-full h-full"
        showBackgroundSelector={true}
        targetWidth={POSTCARD_DETAILS.size.w}
        targetHeight={POSTCARD_DETAILS.size.h}
        bind:strokes={scribbleFront.content.strokes}
        bind:color={scribbleFront.content.color}
        bind:size={scribbleFront.content.size}
        bind:backgroundImage={scribbleFront.content.backgroundImage}
        bind:penMode={penMode}
        onUndo={() => scribbleFront.undo()}
        onRedo={() => scribbleFront.redo()}
        canUndo={scribbleFront.canUndo}
        canRedo={scribbleFront.canRedo}
      />
    </div>
  </div>

  <div id="back-page" class="w-full flex flex-col gap-3  md:grid md:grid-cols-2">
    <div class="flex gap-4">
      <span>002</span>
      <span>Back</span>
    </div>
    <div class="w-full" style="aspect-ratio: {POSTCARD_DETAILS.size.w/POSTCARD_DETAILS.size.h};">
      <Scribble
        class="w-full h-full"
        targetWidth={POSTCARD_DETAILS.size.w}
        targetHeight={POSTCARD_DETAILS.size.h}
        bind:strokes={scribbleBack.content.strokes}
        bind:color={scribbleBack.content.color}
        bind:size={scribbleBack.content.size}
        bind:backgroundImage={scribbleBack.content.backgroundImage}
        bind:penMode={penMode}
        onUndo={() => scribbleBack.undo()}
        onRedo={() => scribbleBack.redo()}
        canUndo={scribbleBack.canUndo}
        canRedo={scribbleBack.canRedo}
      />
    </div>
  </div>

  <div id="form-details" class="w-full flex flex-col gap-6 md:grid  md:grid-cols-2 mb-4">
    <div class="flex gap-4">
      <span>003</span>
      <span>Address & Details</span>
    </div>
    <form {...createCheckout.preflight(CheckoutSchema)} enctype="multipart/form-data" class="flex flex-col gap-6">
      
      <input hidden {...createCheckout.fields.frontImage.as('file')} />
      <input hidden {...createCheckout.fields.backImage.as('file')} />

      <label>
        Send Date: <input {...createCheckout.fields.sendDate.as('date')} />
      </label>
      
      <div id="address" class="flex flex-col gap-2">
        <label>
          Country*:
          <select {...createCheckout.fields.country.as('select')} required>
            <option value="">Select country</option>
            {#each countries as ctr }
              <option value="{ctr.iso31661Alpha2}">{ctr.englishName}</option>
            {/each}
          </select>
        </label>

        <label>
          Name*:
          <input {...createCheckout.fields.name.as('text')} maxlength="40" required />
          <!-- <span class="form-tip">Max 40 characters</span> -->
        </label>

        <label>
          Address*:
          <input
            {...createCheckout.fields.address.as('text')}
            maxlength={isUSAddress ? 64 : 200}
            required
            placeholder={isUSAddress ? "Street address" : "Primary address line"}
          />
          <!-- <span class="form-tip">Max {isUSAddress ? 64 : 200} characters</span> -->
        </label>

        <label>
          Address Line 2:
          <input {...createCheckout.fields.addressLine2.as('text')} />
        </label>

        {#if isUSAddress}
          <!-- US-specific fields (all required) -->
          <label>
            City*:
            <input {...createCheckout.fields.city.as('text')} maxlength="200" required />
            <!-- <span class="form-tip">Max 200 characters</span> -->
          </label>

          <label>
            State*:
            <input
              {...createCheckout.fields.state.as('text')}
              maxlength="2"
              pattern="[a-zA-Z]{2}"
              placeholder="CA"
              required
            />
            <!-- <span class="form-tip">2-letter state code (e.g., CA, NY)</span> -->
          </label>

          <label>
            ZIP Code*:
            <input
              {...createCheckout.fields.postalCode.as('text')}
              pattern="\d{5}(-\d{4})?"
              placeholder="12345 or 12345-1234"
              required
            />
            <!-- <span class="form-tip">Format: 12345 or 12345-1234</span> -->
          </label>
        {:else}
          <!-- International fields (optional or less strict) -->
          <label>
            City:
            <input {...createCheckout.fields.city.as('text')} />
          </label>

          <label>
            Postal Code*:
            <input {...createCheckout.fields.postalCode.as('text')} maxlength="40" />
            <!-- <span class="form-tip">Max 40 characters</span> -->
          </label>
        {/if}
      </div>

      <div id="action+issues">
        <button class="form flex gap-1" onclick={injectImgFieldsAndSubmit}>
          {#if !!createCheckout.pending}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin lucide lucide-loader-icon lucide-loader"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
          {/if}
          <span>Checkout</span>
        </button>
        {#each createCheckout.fields.allIssues() as issue}
          <p class="form-issue">{issue.message}</p>
        {/each}
      </div>
    </form>
  </div>
</div>