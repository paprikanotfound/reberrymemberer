<script lang="ts">
	import { Toaster } from 'svelte-sonner'
	import { detectLocale } from '$lib/i18';
	import { setLocale } from '$lib/paraglide/runtime';
	import '../app.css';
	let { children } = $props();
	// setLocale(detectLocale());
	setLocale("en");
</script>
<Toaster />
{@render children()}
