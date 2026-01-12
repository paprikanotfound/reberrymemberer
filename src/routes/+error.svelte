<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="flex flex-col gap-3 p-3">
  <a href="/">(home)</a>
  <p>{page.error?.message}</p>
</div>