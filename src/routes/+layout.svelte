<script lang="ts">
	import { onMount } from 'svelte';
	import { fromStore } from 'svelte/store';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { activeThemeName, getTheme, initializeThemeStore } from '$lib';
	import { navigating } from '$app/state';
	import { analysisTransition } from '$lib/analysis-transition.svelte';

	let { children } = $props();
	const themeName = fromStore(activeThemeName);
	const activeTheme = $derived(getTheme(themeName.current));
	const loadingLabel = $derived(analysisTransition.label ?? (navigating.to ? 'Loading page…' : null));

	onMount(() => {
		initializeThemeStore();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="color-scheme" content="dark light" />
</svelte:head>

<div class={`theme-root ${activeTheme.className}`} aria-busy={loadingLabel !== null}>
	{#if loadingLabel}
		<div role="status" aria-live="polite" class="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-5 py-4 text-app-text shadow-app-card">
			<span aria-hidden="true" class="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-app-border border-t-app-accent motion-reduce:animate-none"></span>
			<span class="text-sm font-semibold">{loadingLabel}</span>
		</div>
	{/if}
	{@render children()}
</div>
