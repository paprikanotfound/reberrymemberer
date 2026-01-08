<script lang="ts">
	import { browser } from "$app/environment";
	import Postcard from "$lib/components/postcard.svelte";
	import { POSTCARD } from "$lib";
	import { PersistedState } from "runed";
	import { onMount } from "svelte";

  const samples = [
    { front: "./examples/front2.jpg", back: "./examples/back1.jpg"},
    { front: "./examples/front1.jpg", back: "./examples/back3.jpg"},
    { front: "./examples/front2.jpg", back: "./examples/back4.jpg"}
  ]
  
  let infoPageVisible = $state(false);
  const pindex = new PersistedState("pindex", 0);
  const pflipped = new PersistedState("pflipped", false);
  const localIndex = pindex.current

  onMount(() => {
    if (browser) {
      pindex.current = (Number(localStorage.getItem("pindex") ?? 0) + 1) % samples.length;
    }
  });
</script>

<div class="p-3 sm:p-4 w-full h-full relative aspect-container flex flex-col">
  <div id="info" class:hidden={!infoPageVisible} class="flex-1 w-full flex flex-col items-start gap-8">
    <span>
      (<button class="hover:underline" onclick={() => { infoPageVisible = false }}>Close</button>)
    </span>
    <section class="leading-tight">
      <p>Reberrymemberer is a small postal experiment for thoughts too soft for the internet and too fleeting for a full letter. Send a postcard to someone far, to someone you miss, to your future self. Send a message the moment it comes, before it fades.</p>
      <br>
      <br>
      <p class="text-sm">Details</p>
      <p class="text-sm">{POSTCARD.cost_label}, A6, printed in the Netherlands, worldwide delivery.</p>
      <p class="text-sm">Sent via priority mail by PostNL – Dutch Postal Services. (<a href="{POSTCARD.url_delivery_times}" target="_blank" rel="noopener noreferrer">Delivery times</a> →)</p>
      <br>
      <p class="text-sm max-w-2xl italic">Note: Once a postcard is handed over to PostNL, delivery is out of our control. We cannot offer refunds or replacements if an address is incorrect, incomplete, or if the postcard is delayed, lost, or returned. Please double-check the address before sending.</p>
      <br>
      <br>
      <p class="text-sm">Credits</p>
      <p class="text-sm">Photography <a href="https://instagram.com/hoyeonwang/" target="_blank" class="italic">Wang Hoyeon</a></p>
      <p class="text-sm">Design & development <a href="https://paprika.fyi" target="_blank" class="italic">Paprika®</a></p>
      <br>
      <p class="text-sm">Contact</p>
      <p class="text-sm"><a href="mailto:support@paprika.fyi" target="_blank" class="italic">support(at)paprika.fyi</a></p>
    </section>
  </div> 
  <div id="postcard" class:hidden={infoPageVisible}
    class="
      absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
      h-auto w-full max-w-[89%] max-h-[65%] md:max-w-[45rem]
      flex flex-col gap-12
    " 
    style:aspect-ratio={POSTCARD.size.w/POSTCARD.size.h}
    >
    <Postcard
      class="size-full"
      initSpin={pflipped.current ? 180 : 0}
      onspin={(spin) => { 
        pflipped.current = (Math.floor(Math.abs(spin) / 180) % 2) === 1; 
      }}
      front={samples[localIndex].front} 
      back={samples[localIndex].back} 
    />
    <!-- <div class="flex flex-col gap-2">
      <span class="self-center leading-none _text-center">Reberrymemberer – A small postal experiment.</span>
      <div class="w-full flex gap-2 justify-center items-center leading-none">
        <a href="/send">Write</a> – <button onclick={() => { infoPageVisible = !infoPageVisible }}>Info</button>
      </div>
    </div> -->
  </div>
  <div class="flex-1"></div>
  <div class:hidden={infoPageVisible} class="flex flex-col items-center py-8">
    <div class="">Reberrymemberer – A small postal experiment.</div>
    <div class="flex gap-2">
      <span><a href="/send">Write</a>, </span>
      <button onclick={() => { infoPageVisible = !infoPageVisible }}>Info</button>
    </div>
  </div>
</div>