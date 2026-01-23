<script lang="ts">
	import { POSTCARD_CONFIG, ROUTES } from "$lib";
</script>

<div class="w-full min-h-full px-3 pb-3 flex flex-col">
  <section class="relative min-h-[100dvh] flex flex-col justify-center items-center">
    <img 
      class="select-none object-cover h-44 md:h-90 postcard-shadow" 
      loading="eager"
      src="./examples/front1.jpg" alt="" 
    />
    <span class="z-20">
      Reberrymemberer — A small postal experiment. An asynchronous communication network to keep in touch and for offline archival of memories. 
      It’s a tool for instant expression and calm delivery over time and distance. For selfish thoughts or shared memories.
      <span class="max-sm:hidden inline-block"><a href="{ROUTES.send}">Send</a>.</span>
    </span>
    <img 
      class="select-none object-cover h-44 md:h-90 postcard-shadow" 
      loading="eager"
      src="./examples/page_back1.jpg" alt="" 
    />
    <div class="fixed bottom-2 right-2 text-6xl sm:hidden">
      <a class="hover:italic decoration-solid" href="{ROUTES.send}">Send</a>
    </div>
  </section>
  <section class="flex flex-col gap-8">
    <hr>
    <div class="flex flex-col lg:grid lg:grid-cols-2">
      <div class="flex gap-12 mb-3">
        <span>FAQ</span>
      </div>
      <div class="flex flex-col gap-4">
        <div>
          <p class="italic">How much does it cost?</p>
          <p>{POSTCARD_CONFIG.cost_label}</p>
        </div>
        <hr>
        <div>
          <p class="italic">What size is it in?</p>
          <p>4 × 6 inches (10.16 × 15.24 cm).</p>
        </div>
        <hr>
        <div>
          <p class="italic">How long does it take to arrive?</p>
          <p>Delivery typically takes 2–5 business days within the U.S., and 1–2 weeks internationally.</p>
        </div>
        <hr>
        <div>
          <p class="italic">What does reberrymemberer mean?</p>
          <p>It's the title of a <a href="https://www.youtube.com/watch?v=WMFBLQSW8sE" target="_blank">song</a> by Drop Nineteens.</p>
        </div>
        <hr>
      </div>
    </div>
    <div class="flex flex-col lg:grid lg:grid-cols-2">
      <div class="flex gap-8 mb-3">
        <span>Shipping & Returns</span>
      </div>
      <div>
        <p class="mb-4">
          Postcards ship worldwide via USPS First-Class Mail.
        </p>
        <p class="mb-4">
          Once an order has been placed, it cannot be cancelled or refunded.
          Postcards are printed and sent shortly after submission.
          Please review the delivery address carefully before sending.
        </p>
        <p class="">
          If your address is incorrect, please immediately email <a href="mailto:{POSTCARD_CONFIG.support_email}">{POSTCARD_CONFIG.support_email}</a>.
        </p>
      </div>
    </div>
    <div class="flex flex-col lg:grid lg:grid-cols-2">
      <div class="flex gap-8 mb-3">
        <span>©</span>
      </div>
      <div class="">
        <p>Photography: <a href="https://instagram.com/hoyeonwang" target="_blank">Hoyeon Wang</a>.</p>
        <p class="mb-4"><a href="https://paprika.fyi" target="_blank">Paprika</a> © All rights reserved.</p>
      </div>
    </div>
  </section>
</div>