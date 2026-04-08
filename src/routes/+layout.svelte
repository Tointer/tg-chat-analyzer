<script lang="ts">
	import { onMount } from 'svelte';
	import { fromStore } from 'svelte/store';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { activeThemeName, getTheme, initializeThemeStore } from '$lib';

	let { children } = $props();
	const themeName = fromStore(activeThemeName);
	const activeTheme = $derived(getTheme(themeName.current));

	onMount(() => {
		initializeThemeStore();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="color-scheme" content="dark light" />
</svelte:head>

<div class={`theme-root ${activeTheme.className}`}>
	{@render children()}
</div>
