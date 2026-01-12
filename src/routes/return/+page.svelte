<script lang="ts">
	import { APP_CONFIG, clearPersistedScribble } from "$lib";
  
  // reset canvas on return
  clearPersistedScribble(APP_CONFIG.scribble.persist_front);
  clearPersistedScribble(APP_CONFIG.scribble.persist_back);
</script>

<div class="p-4 flex flex-col gap-4">
  <span>(<a href="/">Close</a>)</span>
  <span>✈︎✉︎ The journey has begun! Your postcard will be on its way at the scheduled date.</span>
</div>