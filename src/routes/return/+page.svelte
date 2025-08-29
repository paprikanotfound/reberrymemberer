<script lang="ts">
	import { clearPersistedPage } from "$lib/components/canvas-persisted-page.svelte";
	import { m } from "$lib/paraglide/messages";
  clearPersistedPage("front")
  clearPersistedPage("back")
</script>

<div class="p-4 flex flex-col gap-4">
  <span>(<a href="/">{m.close()}</a>)</span>
  <span>{m.thank_you()}</span>
</div>