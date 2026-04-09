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
	const containerClass = $derived(
		isTabsVariant
			? 'grid w-full grid-cols-2 gap-1 rounded-2xl border border-app-border bg-app-surface-strong/35 p-1 sm:grid-cols-4'
			: 'inline-flex rounded-full border border-app-border bg-app-surface-alt p-1'
	);
	const buttonBaseClass = $derived(
		isTabsVariant
			? 'inline-flex min-w-0 items-center justify-center rounded-xl border border-transparent px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] transition-colors transition-shadow duration-150 sm:text-sm'
			: 'inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors transition-shadow duration-150'
	);
</script>

<div class={containerClass} aria-label={ariaLabel}>
	{#each options as option}
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