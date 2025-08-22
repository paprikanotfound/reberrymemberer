<script>
	import Postcard from "$lib/components/postcard.svelte";
	import { POSTCARD } from "$lib/types";
  let infoVisible = $state(false)
</script>

<div class="p-3 sm:p-4 w-full h-full relative aspect-container flex flex-col gap-2">
  <div id="header">
    <p class="flex gap-2">
      <span>Reberrymemberer</span>
      <span>–</span>
      <span>
        <a href="/send">Send</a>, <button class="hover:underline" onclick={() => { infoVisible = !infoVisible }}>Info</button>
      </span>
    </p>
    <p class="leading-tight">
      A small postal experiment for thoughts too soft for the internet and too fleeting for a full letter. 
      Write to someone far, to someone you miss, to your future self. Send a message the moment it comes, before it fades. 
    </p>
  </div>
  <div id="info" class:hidden={!infoVisible} class="flex-1 w-full flex flex-col items-start gap-8">
    <span>
      (<button class="hover:underline" onclick={() => { infoVisible = false }}>Close</button>)
    </span>
    <section class="max-w-2xl leading-tight">
      <p>
        {POSTCARD.cost_label}, A6, printed in the Netherlands, worldwide delivery.  
      </p>
      <p>
        Sent via priority mail by PostNL – Dutch Postal Services. 
        (<a href="https://www.postnl.nl/api/assets/blt43aa441bfc1e29f2/blt6d6203f1afe9f9aa/68199ff00c47c367afd62823/20250501-brochure-international-delivery-times.pdf" target="_blank" rel="noopener noreferrer">
          Delivery times
        </a> →)
      </p>
      <br>
      <!-- <p class="text-sm">This page is named after a song by Drop Nineteens.</p> -->
      <!-- <p class="text-sm">The postcard example is a screengrab from <a href="https://letterboxd.com/film/lions-love/" target="_blank">Lions Love (1969)</a> directed by Agnès Varda.</p> -->
      <!-- <br/> -->
      <p class="text-sm">Designed & developed by <a href="https://paprika.fyi" target="_blank">Paprika®</a></p>
    </section>
  </div> 
  <div id="postcard" class:hidden={infoVisible}
    class="absolute left-1/2 top-[57%] sm:top-1/2 -translate-x-1/2 -translate-y-1/2 h-auto w-full max-w-[89%] max-h-[75%] md:max-w-[50rem] lg:max-w-[40vw]" 
    style:aspect-ratio={POSTCARD.size.w/POSTCARD.size.h}
    >
    <Postcard class="size-full" 
      front="./IMG_3423 copy.jpg"
      back="./back.jpg"
    />
  </div>
  <div class:hidden={infoVisible} class="flex-1"></div>
  <div class:hidden={infoVisible} class="text-xs sm:text-sm leading-tight text-end">
    Photography: <a href="https://instagram.com/hoyeonwang/" target="_blank">Wang Hoyeon</a>.
  </div>
</div>