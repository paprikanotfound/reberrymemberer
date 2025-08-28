<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import { PersistedState } from "runed";

  const pages = new PersistedState<any>("pages", { 
    front: { strokes: [], bgOffsetX: 0, bgOffsetY: 0 }, 
    back: { strokes: [], bgOffsetX: 0, bgOffsetY: 0 },
  }, { storage: "session" });
  pages.current = { 
    front: { strokes: [], bgOffsetX: 0, bgOffsetY: 0 }, 
    back: { strokes: [], bgOffsetX: 0, bgOffsetY: 0 },
  }

</script>

<div class="p-4 flex flex-col">
  <span>(<a href="/">{m.close()}</a>)</span>
  <span>{m.thank_you()}</span>
</div>