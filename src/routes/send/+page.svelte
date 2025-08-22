<script lang="ts">
	import { goto } from "$app/navigation";
	import { BRUSH_COLORS, BRUSH_COLORS_TEXT, BRUSH_SIZES, type CanvasContent, type CanvasTool, type Stroke } from "$lib/components/canvas.types";
	import Canvas from "$lib/components/canvas.svelte";
	import Editor from "$lib/components/editor.svelte";
	import { drawObjectCover, drawStokes } from "$lib/utils/utils.canvas";
	import { downloadBlob, loadImage } from "$lib/utils/utils.image";
	import { createCheckout } from "./send.remote";
	import { uploadContent } from "$lib/utils/utils.upload";
	import { PersistedState } from "runed";
	import { onMount, untrack } from "svelte";
	import { base64ToBlob } from "$lib/utils/utils.file";
	import CanvasToolbar from "$lib/components/canvas-toolbar.svelte";
	import type { AddressDetails } from "$lib/api.printone.server";
	import { POSTCARD } from "$lib/types";
	import { isHttpError } from "@sveltejs/kit";
	import Aspect from "$lib/components/aspect.svelte";
  import countries from '$lib/countries.json'

  type Pages = {
    front: CanvasContent;
    back: CanvasContent;
  }
  
  const DEFAULT_TOOLS_FRONT = {
    tool: <CanvasTool> "brush",
    color: "#000000",
    size: BRUSH_SIZES[2].size,
  }
  const DEFAULT_TOOLS_BACK = {
    tool: <CanvasTool> "brush",
    color: "#000000",
    size: BRUSH_SIZES[1].size,
  }

  const steps = [-1, 'front', 'back', 'address'] as const;
  type Step = typeof steps[number];
  let step: Step = $state('front')

  let elmEditor: Editor | undefined = $state()
  let elmCanvas: Canvas | undefined = $state()
  let canvasCanUndo = $state(false)
  let canvasCanRedo = $state(false)

  const pages = new PersistedState<Pages>("pages", 
    { 
      front: { strokes: [], bgOffsetX: 0, bgOffsetY: 0 }, 
      back: { strokes: [], bgOffsetX: 0, bgOffsetY: 0 },
    }, 
    { storage: "session" }
  );
  
  let sender: AddressDetails = $state({
    name: '',
    address: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    country: ''
  });
  let recipient: AddressDetails = $state({
    name: '',
    address: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    country: ''
  });

  const today = new Date().toISOString().split('T')[0];
  let dateInput: HTMLInputElement|undefined = $state();
  let sendDate = $state(today);
  let formErrors: Record<string, string> = $state({})

  $effect(() => {
    const selected = sendDate
    untrack(async () => {
      const a = new Date(selected);
      const b = new Date(today);
      if (dateInput && a < b) {
        dateInput.value = today;
      }
    })
  })

  let canvasInPenMode = $state(false)
  let curCanvasTool = $state(DEFAULT_TOOLS_FRONT)


  const onPrev = () => {
    const index = steps.indexOf(step);
    if (index > 0) loadStep(steps[index-1]);
  };
  
  const onNext = () => {
    const index = steps.indexOf(step);
    if (index < steps.length - 1) loadStep(steps[index + 1]);
  };

  onMount(async () => { loadStep(step); });


  async function onContentChanged(content: CanvasContent) {
    if (step == "front") {
      pages.current.front = content;
    } else if (step == "back") {
      pages.current.back = content
    }
  }

  async function loadStep(next: Step) {
    switch(next) {
      case -1: {
        goto('/')
        break
      }
      case 'front': {
        elmEditor?.resetZoom()
        elmCanvas?.setContent(pages.current.front);
        break
      }
      case 'back': {
        elmEditor?.resetZoom()
        elmCanvas?.setContent(pages.current.back);
        break
      }
      case 'address': {
        break
      }
    }
    step = next;
  }

  async function generatePageImage(strokes: Stroke[], bg?: File|Blob, offsetY?: number, type?: string, quality?: number) {
    return new Promise<Blob>(async (res, rej) => {
      const canvas = document.createElement("canvas");
      canvas.width = POSTCARD.size.w;
      canvas.height = POSTCARD.size.h;
      // ctx
      const ctx = canvas.getContext("2d");
      if (!ctx) return rej("No 2D context");
      // bg color
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // bg img
      if (bg) {
        const elmImage = bg ? await loadImage(bg) : null;
        if (!elmImage) return rej("Background not loaded");
        drawObjectCover(ctx, elmImage, canvas.width, canvas.height, offsetY);
      }
      // strokes
      drawStokes(ctx, canvas.width, canvas.height, strokes);
      // save
      canvas.toBlob(blob => {
        if (blob) res(blob);
        else rej("Failed to export blob");
      }, type, quality);
    })
  }

  async function requestCheckoutLink() {
    try {
      const [pageFront, pageBack] = await Promise.all([
        generatePageImage(
          pages.current.front.strokes, 
          pages.current.front.bg ? base64ToBlob(pages.current.front.bg) : undefined,
          pages.current.front.bgOffsetY,
          POSTCARD.type, 1
        ),
        generatePageImage(
          pages.current.back.strokes, undefined, 0, POSTCARD.type, 1
        )
      ]);

      const result = await createCheckout($state.snapshot({
        sender,
        recipient,
        sendDate,
        frontType: POSTCARD.type,
        frontSize: pageFront.size,
        backType: POSTCARD.type,
        backSize: pageBack.size,
      }));

      await Promise.allSettled([
        uploadContent(result.url_front, pageFront),
        uploadContent(result.url_back, pageBack),
      ])

      window.location.href = result.url_checkout;
    } catch (error) {
      if (isHttpError(error) && Array.isArray(error.body)) {
        const errors = error.body;
        const fieldErrors: Record<string, string> = {};
        for (const err of errors) {
          // Convert ["addressDetails","name"] → "addressDetails.name"
          const fieldPath = err.path.join('.');
          fieldErrors[fieldPath] = err.message;
        }
        formErrors = fieldErrors;
        return
      }
      console.log(error)
      //TODO toast error
    }
  }

</script>


<div 
  class:overflow-hidden={step !== "address"}
  class:overscroll-none={step !== "address"}
  class="relative w-full h-full select-none"
  >
  
  <div id="topbar" class="fixed top-0 left-0 w-full z-40 transform-none">
    <div id="nav" class="p-2 sm:p-4 leading-snug font-light relative flex justify-between gap-4 w-full bg-white shadow-xl shadow-white">
      <span class="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 justify-center">
        <span class:italic={step == "front"} class:underline={step == "front"}>Front</span> / 
        <span class:italic={step == "back"} class:underline={step == "back"}>Back</span> / 
        <span class:italic={step == "address"} class:underline={step == "address"}>Send</span>
      </span>
      <button onclick={onPrev} class="flex gap-2 justify-center items-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5">
          <path fill-rule="evenodd" d="M18 10a.75.75 0 0 1-.75.75H4.66l2.1 1.95a.75.75 0 1 1-1.02 1.1l-3.5-3.25a.75.75 0 0 1 0-1.1l3.5-3.25a.75.75 0 1 1 1.02 1.1l-2.1 1.95h12.59A.75.75 0 0 1 18 10Z" clip-rule="evenodd" />
        </svg>
        Back
      </button>
      <span class="">
        {#if step == "address"}
          <button onclick={requestCheckoutLink}>Checkout</button>
        {:else}
          <button onclick={onNext}>Next</button>
        {/if}
      </span>
    </div>
    
    <!-- <button onclick={async () => {
        downloadBlob(await generatePageImage(
          pages.current.back.strokes, 
          pages.current.back.bg ? base64ToBlob(pages.current.back.bg) : undefined,
          pages.current.back.bgOffsetY,
          POSTCARD.type, 1
        ), 'front.jpg')
      }}>download</button>  -->
   
  </div>


  <div class:hidden={!canvasInPenMode} class="absolute left-2 top-1/2 z-50">
    <button class="text-sm flex justify-center gap-1" onclick={() => { canvasInPenMode = false }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5">
        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
      </svg>
      Exit pen mode
    </button>
  </div>

  <Editor id="editor"
    bind:this={elmEditor}
    data-hidden={step !== "front" && step !== "back"}
    class="size-full flex flex-col items-center justify-center touch-none data-[hidden=true]:hidden"
    onzoomstart={() => {  }}
    ontaptwo={() => { elmCanvas?.undo() }}
  >
    {#snippet children(isPanningZooming, details)}
      <Aspect 
        aspect={POSTCARD.size.w/POSTCARD.size.h} 
        class="relative max-w-[80vw] max-h-[75vh]"
        style="transform: translate({details.x}px, {details.y}px); scale: {details.scale};"
        >
        <div id="canvas-grid" class="grid-overlay absolute top-0 left-0 w-full h-full -z-1 pointer-events-none"></div>
        
        <Canvas id="front" 
          bind:this={elmCanvas}
          bind:canUndo={canvasCanUndo}
          bind:canRedo={canvasCanRedo}
          bind:inPenMode={canvasInPenMode}
          tool={curCanvasTool.tool}
          opts={{ color: curCanvasTool.color, size: curCanvasTool.size }}
          onchange={onContentChanged}
          aspect={`${POSTCARD.size.w}/${POSTCARD.size.h}`}
          locked={isPanningZooming}
          class="size-full border-[.5px] border-black/50 "
        />

        <div id="reserved-area" 
          class:hidden={step!=="back"} 
          class="absolute top-0 left-0 w-full h-full z-[2000] pointer-events-none">
          <div id="address-area" class="pointer-events-auto select-none cursor-default absolute border-l-[.5px] border-t-[.5px] _bg-white w-[42.37%] h-[79.16%] right-0 top-0 z-2 flex items-center justify-center">
            <p class="text-[8px] sm:text-sm p-1">Firstname Lastname<br>Street 123<br>1234 AB PLACE</p>
          </div>
          <div id="barcode-area" class="pointer-events-auto select-none cursor-default absolute border-l-[.5px] border-t-[.5px] _bg-white w-[93.21%] h-[20.84%] right-0 bottom-0 z-2 flex items-center justify-center">
            <p class="text-[8px] sm:text-sm p-1">
              Please leave this area clear for postal service barcodes.
            </p>
          </div>
          <img id="stamp" src="/stamp.png" alt="stamp" class="absolute top-2 right-0 h-15 sm:h-30 object-contain z-10" />
        </div>
        <div id="bleed" class="absolute top-0 left-0 p-[2%] size-full z-10 pointer-events-none">
          <div class="size-full border-[1px] _border-dashed border-red-600"></div>
        </div>
      </Aspect>
    {/snippet}
  </Editor>

  <CanvasToolbar
    key={step == "front" ? "tools-front" : "tools-back" } 
    initValue={step == "front" ? DEFAULT_TOOLS_FRONT : DEFAULT_TOOLS_BACK}
    tools={step == "front" ? ["bg","eraser","brush"] : ["eraser","brush"]}
    onchange={(props) => { 
      curCanvasTool = props;
      // reset zoom
      if (props.tool == "bg") {
        elmEditor?.resetZoom() 
        elmCanvas?.selectBgPicture()
      }
    }}
    onundo={() => elmCanvas?.undo()}
    onredo={() => elmCanvas?.redo()}
    onclear={() => elmCanvas?.clear()}
    canUndo={canvasCanUndo}
    canRedo={canvasCanRedo}
    colors={step == "front" ? BRUSH_COLORS : BRUSH_COLORS_TEXT}
    data-hide={step == "address"}
    class="data-[hide='true']:hidden"
  />

  <div id="page-details"
    class:hidden={step !== "address"}
    class="px-3 sm:px-4 py-20"
  >
    <div class="flex flex-col w-full gap-y-12">
      <form id="section-0" class="w-full flex flex-col lg:grid lg:grid-cols-2">
        <div class="flex gap-8 mb-3">
          <span>001</span>
          <span>From</span>
        </div>
        <div id="fields" class="flex flex-col gap-2">
          <label>
            Name:
            <input
              type="text"
              name="sender.name"
              bind:value={sender.name}
              autocomplete="section-sender name"
              required
              class="input"
            />
            {#if formErrors['sender.name']}
              <p class="text-red-500 text-sm">*</p>
            {/if}
          </label>
          <label>
            Address:
            <input
              type="text"
              name="sender.address"
              bind:value={sender.address}
              autocomplete="section-sender address-line1"
              required
              class="input"
            />
            {#if formErrors['sender.address']}
              <p class="text-red-500 text-sm">*</p>
            {/if}
          </label>
          <label>
            Address (2):
            <input
              type="text"
              name="sender.addressLine2"
              bind:value={sender.addressLine2}
              autocomplete="section-sender address-line2"
              class="input"
            />
            {#if formErrors['sender.addressLine2']}
              <p class="text-red-500 text-sm">*</p>
            {/if}
          </label>
          <label>
            Postal Code:
            <input
              type="text"
              name="sender.postalCode"
              bind:value={sender.postalCode}
              autocomplete="section-sender postal-code"
              required
              class="input"
            />
            {#if formErrors['sender.postalCode']}
              <p class="text-red-500 text-sm">*</p>
            {/if}
          </label>
          <label>
            City:
            <input
              type="text"
              name="sender.city"
              bind:value={sender.city}
              autocomplete="section-sender address-level2"
              required
              class="input"
            />
            {#if formErrors['sender.city']}
              <p class="text-red-500 text-sm">*</p>
            {/if}
          </label>
          <label>
            Country:
            <select bind:value={sender.country} 
              name="sender.country"
              required class="input" 
              autocomplete="section-sender country"
              >
              <option value="">Select country</option>
              {#each countries as ctr }
                <option value="{ctr.iso31661Alpha2}">{ctr.englishName}</option>                
              {/each}
            </select>
            {#if formErrors['sender.country']}
              <p class="text-red-500 text-sm">*</p>
            {/if}
          </label>
          <div id="errors" class="flex">
            {#if Object.keys(formErrors).length}
              <ul class="text-red-500 text-xs">
                {#each Object.values(formErrors) as errorMsg}
                  <li>{errorMsg}</li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      </form>
      <form id="section-1" class="w-full flex flex-col lg:grid lg:grid-cols-2">
        <div class="flex gap-8 mb-3">
          <span>002</span>
          <span>To</span>
        </div>
        <div id="fields" class="flex flex-col gap-2">
          <label>
            Name:
            <input
              type="text"
              bind:value={recipient.name}
              name="receiver.name"
              autocomplete="section-receiver name"
              required
              class="input"
            />
            {#if formErrors['recipient.name']}
              <p class="text-red-500 text-sm">*</p>
            {/if}
          </label>
          <label>
            Address:
            <input
              type="text"
              bind:value={recipient.address}
              name="receiver.address"
              autocomplete="section-receiver address-line1"
              required
              class="input"
            />
            {#if formErrors['recipient.address']}
              <p class="text-red-500 text-sm">*</p>
            {/if}
          </label>
          <label>
            Address (2):
            <input
              type="text"
              bind:value={recipient.addressLine2}
              name="receiver.addressLine2"
              autocomplete="section-receiver address-line2"
              class="input"
            />
            {#if formErrors['recipient.addressLine2']}
              <p class="text-red-500 text-sm">*</p>
            {/if}
          </label>
          <label>
            Postal Code:
            <input
              type="text"
              bind:value={recipient.postalCode}
              name="receiver.postalCode"
              autocomplete="section-receiver postal-code"
              required
              class="input"
            />
            {#if formErrors['recipient.postalCode']}
              <p class="text-red-500 text-sm">*</p>
            {/if}
          </label>
          <label>
            City:
            <input
              type="text"
              bind:value={recipient.city}
              name="receiver.city"
              autocomplete="section-receiver address-level2"
              required
              class="input"
            />
            {#if formErrors['recipient.city']}
              <p class="text-red-500 text-sm">*</p>
            {/if}
          </label>
          <label>
            Country:
            <select 
              bind:value={recipient.country} required 
              name="receiver.country"
              class="input" 
              autocomplete="section-receiver country"
              >
              <option value="">Select country</option>
              {#each countries as ctr }
                <option value="{ctr.iso31661Alpha2}">{ctr.englishName}</option>                
              {/each}
            </select>
            {#if formErrors['recipient.country']}
              <p class="text-red-500 text-sm">*</p>
            {/if}
          </label>
          <div id="errors" class="flex">
            {#if Object.keys(formErrors).length}
              <ul class="text-red-500 text-xs">
                {#each Object.values(formErrors) as errorMsg}
                  <li>{errorMsg}</li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      </form>
      <div id="section-2" class="flex flex-col lg:grid lg:grid-cols-2">
        <div class="flex gap-8 mb-3">
          <span>003</span>
          <span>Schedule</span>
        </div>
        <div class="flex flex-col gap-2">
          <p>Notice: All postcards are sent from the Netherlands via priority mail by PostNL.
          (<a href="https://www.postnl.nl/api/assets/blt43aa441bfc1e29f2/blt6d6203f1afe9f9aa/68199ff00c47c367afd62823/20250501-brochure-international-delivery-times.pdf" target="_blank" rel="noopener noreferrer">
            Delivery times
          </a>)</p>
          <label>
            Send Date:
            <input bind:this={dateInput} type="date" id="date" bind:value={sendDate} min={today} class="w-fit flex-none cursor-text" />
          </label>
        </div>
      </div>
    </div>
  </div>
</div>