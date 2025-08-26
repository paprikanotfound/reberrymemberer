<script lang="ts">
	import Postcard from "$lib/components/postcard.svelte";
	import { POSTCARD } from "$lib/types";
	import { onMount } from "svelte";
  let infoVisible = $state(false)
  const samples = [
    { front: "./IMG_3423front.jpg", back: "./back2.jpg"},
    { front: "./IMG_3423front.jpg", back: "./back3.jpg"},
    { front: "./IMG_3423front.jpg", back: "./back4.jpg"}
  ]
  let sample = samples[Math.floor(Math.random() * samples.length)];
  let emlPostcard: Postcard|undefined;
  
  // onMount(() => {
  //   setTimeout(() => {
  //     if (!emlPostcard) return
  //     emlPostcard.flipToBack()
  //   }, 550)
  // })
</script>

<div class="p-3 sm:p-4 w-full h-full relative aspect-container flex flex-col gap-2">
  <!-- <div id="header">
    <p class="flex gap-2">
      <span>Reberrymemberer</span>
      <span>–</span>
      <span><a href="/send">Send</a>, <button class="hover:underline" onclick={() => { infoVisible = !infoVisible }}>Info</button></span>
    </p>
    <p class="leading-tight">
      A small postal experiment for thoughts too soft for the internet and too fleeting for a full letter. 
      Write to someone far, to someone you miss, to your future self. Send a message the moment it comes, before it fades. 
    </p>
  </div> -->
  <div id="info" class:hidden={!infoVisible} class="flex-1 w-full flex flex-col items-start gap-8">
    <span>
      (<button class="hover:underline" onclick={() => { infoVisible = false }}>Close</button>)
    </span>
    <section class="_max-w-2xl leading-tight">
      <p class="leading-tight">
        Reberrymemberer – A small postal experiment for thoughts too soft for the internet and too fleeting for a full letter. 
        Send a postcard to someone far, to someone you miss, to your future self. Send a message the moment it comes, before it fades. 
      </p>
      <br>
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
      <!-- <p class="text-sm">Inspired by <a href="https://www.youtube.com/results?search_query=drop+nineteens+kick+the+tragedy" class="italic">Drop Nineteens - Kick The Tragedy</a></p> -->
      <p class="text-sm">Photography <a href="https://instagram.com/hoyeonwang/" target="_blank" class="italic">Wang Hoyeon</a></p>
      <p class="text-sm">Design & development <a href="https://paprika.fyi" target="_blank" class="italic">Paprika®</a></p>
    </section>
  </div> 
  <div id="postcard" class:hidden={infoVisible}
    class="
      absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
      h-auto w-full max-w-[89%] max-h-[75%] lg:max-w-[45vw]
      flex flex-col gap-8
    " 
    style:aspect-ratio={POSTCARD.size.w/POSTCARD.size.h}
    >
    <Postcard bind:this={emlPostcard} class="size-full" front={sample.front} back={sample.back} />
    <div class="flex flex-col gap-2">
      <span class="self-center leading-none _text-center">Reberrymemberer – A small postal experiment.</span>
      <div class="w-full flex gap-1 justify-center items-center leading-none">
        <a href="/send">Write</a> – <button onclick={() => { infoVisible = !infoVisible }}>Info</button>
      </div>
    </div>
  </div>
  <!-- <div class:hidden={infoVisible} class="flex-1"></div>
  <div class:hidden={infoVisible} class="text-xs sm:text-sm leading-tight text-end">
    Photography: <a href="https://instagram.com/hoyeonwang/" target="_blank">Wang Hoyeon</a>.
  </div> -->
</div>