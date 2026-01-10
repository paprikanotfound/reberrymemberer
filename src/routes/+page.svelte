<script lang="ts">
	import { POSTCARD } from "$lib";
</script>

<div class="w-full min-h-full px-3 pb-3 flex flex-col">
  <section class="relative h-[100dvh] flex flex-col justify-center items-center">
    <img 
      class="select-none object-cover h-44 sm:h-80 sm:-translate-x-8 postcard-shadow" 
      loading="eager"
      src="./examples/front1.jpg" alt="" 
    />
    <span class="-my-1 z-20">
      Reberrymemberer – A small postal experiment. An asynchronous social network to keep in touch and for offline archival of memories. 
      It’s a tool for instant expression and calm delivery over time and distance. For selfish thoughts or shared memories.
      <span class="max-sm:hidden inline-block"><a href="/write">Send</a>, <a href="/receive">Receive</a>.</span>
    </span>
    <img 
      class="select-none object-cover h-44 sm:h-80 sm:translate-x-8 postcard-shadow" 
      loading="eager"
      src="./examples/back3.jpg" alt="" 
    />
    <div class="fixed bottom-2 right-2 text-6xl sm:hidden">
      <a class="hover:italic decoration-solid" href="/write">Send</a>
    </div>
  </section>
  <section class="flex flex-col gap-8">
    <hr>
    <div class="flex flex-col lg:grid lg:grid-cols-2">
      <div class="flex gap-12 mb-3">
        <span>FAQ</span>
      </div>
      <div class="flex flex-col gap-2">
        <div>
          <p class="italic">How much does it cost?</p>
          <p>{POSTCARD.cost_label}, A6, printed in the Netherlands, worldwide delivery.</p>
        </div>
        <hr>
        <div>
          <p class="italic">How long does it take to arrive?</p>
          <p>.</p>
        </div>
        <hr>
        <div>
          <p class="italic">Why did you create this?</p>
          <p>.</p>
        </div>
        <hr>
        <div>
          <p class="italic">What does reberrymemberer mean?</p>
          <p>It's the title of a song by Drop Nineteens. I liked the word and thought it would be a good fit for this project.</p>
        </div>
        <hr>
      </div>
    </div>
    <div class="flex flex-col lg:grid lg:grid-cols-2">
      <div class="flex gap-8 mb-3">
        <span>Shipping & Returns</span>
      </div>
      <div class="">
        <p>Sent via priority mail by PostNL – Dutch Postal Services. 
          (<a href="{POSTCARD.url_delivery_times}" target="_blank" rel="noopener noreferrer">Delivery times</a> →)</p>
        <p>
          Once a postcard is handed over to PostNL, delivery is out of our control. We cannot offer refunds or replacements 
          if an address is incorrect, incomplete, or if the postcard is delayed, lost, or returned. Please double-check the 
          address before sending.
        </p>
      </div>
    </div>
    <div class="flex flex-col lg:grid lg:grid-cols-2">
      <div class="flex gap-8 mb-3">
        <span>Contact</span>
      </div>
      <div class="">
        <p>Please send any questions to <a href="mailto:reberrymemberer@paprika.fyi">reberrymemberer@paprika.fyi</a>.</p>
        <p>Postcard photography: <a href="https://instagram.com/hoyeonwang" target="_blank">Hoyeon Wang</a>.</p>
        <p class="mt-4">© <a href="https://paprika.fyi" target="_blank">Paprika</a> {`{getCurrentYear()}`}</p>
      </div>
    </div>
  </section>
</div>