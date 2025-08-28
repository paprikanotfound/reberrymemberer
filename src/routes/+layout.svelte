<script lang="ts">
	import { detectLocale } from '$lib/i18';
	import { setLocale } from '$lib/paraglide/runtime';
	import '../app.css';
	let { children } = $props();
	const loc = detectLocale()
	setLocale(detectLocale());
</script>
{@render children()}
