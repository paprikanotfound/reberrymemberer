<script lang="ts">
	import { browser } from "$app/environment";
	import Postcard from "$lib/components/postcard.svelte";
	import { m } from "$lib/paraglide/messages";
	import { POSTCARD } from "$lib/types";
	import { PersistedState } from "runed";
	import { onMount } from "svelte";

  const samples = [
    { front: "./IMG_3423front.jpg", back: "./back2.jpg"},
    { front: "./IMG_3423front.jpg", back: "./back3.jpg"},
    { front: "./IMG_3423front.jpg", back: "./back4.jpg"}
  ]
  
  let infoPageVisible = $state(false);
  const pindex = new PersistedState("pindex", 0);
  const pflipped = new PersistedState("pflipped", true);
  
  onMount(() => {
    if (browser) {
      pindex.current = (Number(localStorage.getItem("pindex") ?? 0) + 1) % samples.length;
    }
  });
</script>

<div class="p-3 sm:p-4 w-full h-full relative aspect-container">
  <div id="info" class:hidden={!infoPageVisible} class="flex-1 w-full flex flex-col items-start gap-8">
    <span>
      (<button class="hover:underline" onclick={() => { infoPageVisible = false }}>{m.close()}</button>)
    </span>
    <section class="_max-w-2xl leading-tight">
      <p class="leading-tight">{m.intro_paragraph()}</p>
      <br>
      <p>{m.postcard_details({ cost_label: POSTCARD.cost_label })}</p>
      <p>
        {m.shipping_info()}
        (<a href="{POSTCARD.url_delivery_times}" target="_blank" rel="noopener noreferrer">{m.delivery_times()}</a> →)
      </p>
      <br>
      <p class="text-sm">{m.credit_photography()} <a href="https://instagram.com/hoyeonwang/" target="_blank" class="italic">Wang Hoyeon</a></p>
      <p class="text-sm">{m.credit_design()} <a href="https://paprika.fyi" target="_blank" class="italic">Paprika®</a></p>
    </section>
  </div> 
  <div id="postcard" class:hidden={infoPageVisible}
    class="
      absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
      h-auto w-full max-w-[89%] max-h-[75%] md:max-w-[45rem]
      flex flex-col gap-12 mt-12 pb-12
    " 
    style:aspect-ratio={POSTCARD.size.w/POSTCARD.size.h}
    >
    <Postcard
      class="size-full"
      initSpin={pflipped.current ? 180 : 0}
      onspin={(spin) => { 
        pflipped.current = (Math.floor(Math.abs(spin) / 180) % 2) === 1; 
      }}
      front={samples[pindex.current].front} 
      back={samples[pindex.current].back} 
    />
    <div class="flex flex-col gap-2">
      <span class="self-center leading-none _text-center">{m.tagline()}</span>
      <div class="w-full flex gap-1 justify-center items-center leading-none">
        <a href="/send">{m.write()}</a> – <button onclick={() => { infoPageVisible = !infoPageVisible }}>{m.info()}</button>
      </div>
    </div>
  </div>
</div>