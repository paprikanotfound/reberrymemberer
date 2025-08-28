<script lang="ts">
	import '../app.css';
	// import { setLocale, getLocale } from '$lib/paraglide/runtime';
	let { children } = $props();
	// setLocale("");
</script>
<!-- {getLocale()} -->
{@render children()}
