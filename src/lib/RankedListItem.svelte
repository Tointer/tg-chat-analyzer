<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		rank: number;
		selected?: boolean;
		interactive?: boolean;
		onClick?: () => void;
		containerClass?: string;
		contentClass?: string;
		rankClass?: string;
		children?: Snippet;
	};

	let {
		rank,
		selected = false,
		interactive = false,
		onClick,
		containerClass = '',
		contentClass = 'flex min-w-0 flex-1',
		rankClass = '',
		children
	}: Props = $props();

	const baseClass = 'flex w-full items-stretch gap-3 overflow-hidden rounded-2xl';
	const buttonClass = $derived(
		'pr-4 text-left transition-colors ' +
			(selected
				? 'bg-app-accent-strong text-app-accent-contrast shadow-app-button'
				: 'bg-app-surface text-app-text hover:bg-app-empty')
	);
	const articleClass = 'border border-app-border bg-app-surface shadow-sm text-app-text';
	const baseRankClass =
		'flex min-w-14 shrink-0 items-center justify-center rounded-l-2xl px-3 text-xl font-display';
	const selectedRankClass = $derived(
		selected
			? 'bg-app-accent-contrast/18 text-app-accent-contrast'
			: 'bg-app-surface-strong text-app-text'
	);
</script>

{#if interactive}
	<button
		type="button"
		class={`${baseClass} ${buttonClass} ${containerClass}`}
		onclick={() => onClick?.()}
	>
		<span class={`${baseRankClass} ${selectedRankClass} ${rankClass}`}>{rank}</span>
		<div class={contentClass}>
			{@render children?.()}
		</div>
	</button>
{:else}
	<article class={`${baseClass} ${articleClass} ${containerClass}`}>
		<span class={`${baseRankClass} ${selectedRankClass} ${rankClass}`}>{rank}</span>
		<div class={contentClass}>
			{@render children?.()}
		</div>
	</article>
{/if}