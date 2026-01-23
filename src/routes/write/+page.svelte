<script lang="ts">
	import { APP_CONFIG, createPersistedScribble, POSTCARD_CONFIG, type ScribbleContent } from "$lib";
	import { CreateCheckout } from "$lib/checkout.remote";
	import { CheckoutSchema } from "$lib/checkout.types";
	import Address from "$lib/components/address.svelte";
	import Scribble from "$lib/components/scribble.svelte";
	import { drawObjectCover, drawStokes } from "$lib/utils/canvas";
	import { base64ToBlob } from "$lib/utils/files";
	import { initForm } from "$lib/utils/forms.svelte";
	import { loadImage } from "$lib/utils/images";
	import { getCountryFromTimezone } from "$lib/utils/timezone";
	import { uploadContent } from "$lib/utils/upload";
  import { onMount, untrack } from 'svelte';

  let { data } = $props();

  let redirectingToCheckout = $state(false);
  let penMode = $state(false);
  
  // Create persisted state for both scribble instances
  const scribbleFront = createPersistedScribble(APP_CONFIG.scribble.persist_front);
  const scribbleBack = createPersistedScribble(APP_CONFIG.scribble.persist_back);

  // Set initial Send Date value and default country
  const today = new Date();
  initForm(CreateCheckout, () => {
    return {
      sendDate: today.toISOString().split('T')[0],
      country: 'KR', //data.prefillAddress ? data.prefillAddress.address_country : getCountryFromTimezone(),
      name: data.prefillAddress ? data.prefillAddress.name : undefined,
      address: data.prefillAddress ? data.prefillAddress.address_line1 : undefined,
      addressLine2: data.prefillAddress ? data.prefillAddress.address_line2 : undefined,
      postalCode: data.prefillAddress ? data.prefillAddress.address_zip : undefined,
      state: data.prefillAddress ? data.prefillAddress.address_state : undefined,
      city: data.prefillAddress ? data.prefillAddress.address_city : undefined,
    }
  });
  
  // Force 'Send Date' >= today
  $effect(() => {
    const selected = CreateCheckout.fields.sendDate.value();
    untrack(async () => {
      const a = new Date(selected);
      if (a < today) CreateCheckout.fields.sendDate.set(today.toISOString().split('T')[0]);
    });
  });
  
  async function createPageImage(content: ScribbleContent, type?: string, quality?: number, bgColor?: string) {
    return new Promise<Blob>(async (res, rej) => {
      const canvas = document.createElement("canvas");
      // Export with bleed dimensions
      canvas.width = POSTCARD_CONFIG.printing.bleed.w;
      canvas.height = POSTCARD_CONFIG.printing.bleed.h;

      const ctx = canvas.getContext("2d");
      if (!ctx) return rej("No 2D context");

      // Calculate bleed offset (centered)
      const offsetX = (POSTCARD_CONFIG.printing.bleed.w - POSTCARD_CONFIG.printing.trim.w) / 2;
      const offsetY = (POSTCARD_CONFIG.printing.bleed.h - POSTCARD_CONFIG.printing.trim.h) / 2;

      // Fill background
      ctx.fillStyle = bgColor ? bgColor : "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Save context state
      ctx.save();
      // Translate to center the trim area with bleed
      ctx.translate(offsetX, offsetY);

      // Draw background image (if any) - scale to trim size
      if (content.backgroundImage && content.backgroundImage.includes(',')) {
        try {
          const elmImage = await loadImage(base64ToBlob(content.backgroundImage));
          if (elmImage) {
            drawObjectCover(ctx, elmImage, POSTCARD_CONFIG.printing.trim.w, POSTCARD_CONFIG.printing.trim.h, 0.5);
          }
        } catch (e) {
          console.error("Failed to load background image:", e);
        }
      }

      // Draw strokes (coordinates are in trim space)
      drawStokes(ctx, POSTCARD_CONFIG.printing.trim.w, POSTCARD_CONFIG.printing.trim.h, content.strokes);

      // Restore context
      ctx.restore();

      // Export
      canvas.toBlob(blob => {
        if (blob) res(blob);
        else rej("Failed to export blob");
      }, type, quality);
    })
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

<div class="flex flex-col items-start justify-center gap-8 sm:gap-12 p-3">
  <div class="grid grid-cols-3 w-full">
    <a href="/">(back)</a>
  </div>

  <div id="font-page" class="w-full flex flex-col gap-3 md:grid md:grid-cols-2">
    <div class="flex gap-4">
      <span>001</span>
      <span>Front Page</span>
    </div>
    
    <div class="w-full" style="aspect-ratio: {POSTCARD_CONFIG.printing.trim.w/POSTCARD_CONFIG.printing.trim.h};">
      <Scribble
        class="w-full h-full"
        showBackgroundSelector={true}
        showSafeZone={true}
        safeZoneWidth={POSTCARD_CONFIG.printing.safe.w}
        safeZoneHeight={POSTCARD_CONFIG.printing.safe.h}
        targetWidth={POSTCARD_CONFIG.printing.trim.w}
        targetHeight={POSTCARD_CONFIG.printing.trim.h}
        backgroundColor={POSTCARD_CONFIG.printing.front_background}
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
      <span>Back Page</span>
    </div>

    <div class="w-full" style="aspect-ratio: {POSTCARD_CONFIG.printing.trim.w/POSTCARD_CONFIG.printing.trim.h};">
      <Scribble
        class="w-full h-full"
        showSafeZone={true}
        safeZoneWidth={POSTCARD_CONFIG.printing.safe.w}
        safeZoneHeight={POSTCARD_CONFIG.printing.safe.h}
        showInkFreeArea={true}
        inkFreeWidth={POSTCARD_CONFIG.printing.inkFree.w}
        inkFreeHeight={POSTCARD_CONFIG.printing.inkFree.h}
        inkFreeOffsetRight={POSTCARD_CONFIG.printing.inkFree.offsetRight}
        inkFreeOffsetBottom={POSTCARD_CONFIG.printing.inkFree.offsetBottom}
        targetWidth={POSTCARD_CONFIG.printing.trim.w}
        targetHeight={POSTCARD_CONFIG.printing.trim.h}
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

    <form {...CreateCheckout.preflight(CheckoutSchema).enhance(async ({submit, form}) => {
      await submit();

      if (CreateCheckout.result) {
        redirectingToCheckout = true;
        const { checkoutUrl, uploadUrls } = CreateCheckout.result;

        // Generate page images
        const frontBlob = await createPageImage(scribbleFront.content, 'image/jpeg', 0.95, POSTCARD_CONFIG.printing.front_background);
        const backBlob = await createPageImage(scribbleBack.content, 'image/jpeg', 0.95);

        // Upload images to R2 using multipart upload
        await Promise.allSettled([
          uploadContent(uploadUrls.front, frontBlob),
          uploadContent(uploadUrls.back, backBlob),
        ]);

        // redirect to checkout
        window.location.href = checkoutUrl;
        
        redirectingToCheckout = false;
        form.reset();
      }
    })} class="flex flex-col gap-6">
      <!-- <label>
        Send Date: <input {...createCheckout.fields.sendDate.as('date')} />
      </label> -->

      <Address bind:fields={CreateCheckout.fields} />

      <div id="issues">
        {#each CreateCheckout.fields.allIssues() as issue}
          <p class="form-issue">{issue.message}</p>
        {/each}
      </div>

      <div id="action">
        <button class="primary flex gap-1">
          {#if !!CreateCheckout.pending || redirectingToCheckout}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin lucide lucide-loader-icon lucide-loader"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
          {/if}
          <span>Checkout</span>
        </button>
      </div>
    </form>
  </div>
</div>