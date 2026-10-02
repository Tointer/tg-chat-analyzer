<script lang="ts">
	type SelectorOption = {
		value: string;
		label: string;
	};

	type SelectorVariant = 'pill' | 'tabs';

	type Props = {
		selectedValue: string;
		onSelectValue: (value: string) => void;
		options: SelectorOption[];
		ariaLabel?: string;
		variant?: SelectorVariant;
	};

	let {
		selectedValue,
		onSelectValue,
		options,
		ariaLabel = 'Segmented selector',
		variant = 'pill'
	}: Props = $props();

	const isTabsVariant = $derived(variant === 'tabs');
	const tabsColumnClass = $derived(
		options.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5'
	);
	const containerClass = $derived(
		isTabsVariant
			? `grid w-full gap-1 rounded-xl border border-app-border bg-app-surface-strong/35 p-1 ${tabsColumnClass}`
			: 'inline-flex rounded-full border border-app-border bg-app-surface-alt p-1'
	);
	const buttonBaseClass = $derived(
		isTabsVariant
			? 'inline-flex min-w-0 items-center justify-center rounded-lg border border-transparent px-2.5 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors transition-shadow duration-150 sm:px-3 sm:text-xs'
			: 'inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors transition-shadow duration-150'
	);
</script>

<div class={containerClass} aria-label={ariaLabel}>
	{#each options as option (option.value)}
		<button
			aria-pressed={selectedValue === option.value}
			class={`${buttonBaseClass} ${selectedValue === option.value ? isTabsVariant ? 'border-app-tab-active-border bg-app-tab-active text-app-tab-active-text shadow-app-card' : 'bg-app-accent-strong text-app-accent-contrast shadow-app-button' : isTabsVariant ? 'text-app-muted hover:bg-app-surface-alt hover:text-app-text' : 'text-app-muted hover:text-app-text'}`}
			type="button"
			onclick={() => onSelectValue(option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>