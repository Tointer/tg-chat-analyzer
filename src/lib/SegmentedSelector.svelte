<script lang="ts">
	type SelectorOption = {
		value: string;
		label: string;
	};

	type Props = {
		selectedValue: string;
		onSelectValue: (value: string) => void;
		options: SelectorOption[];
		ariaLabel?: string;
	};

	let {
		selectedValue,
		onSelectValue,
		options,
		ariaLabel = 'Segmented selector'
	}: Props = $props();

	const buttonBaseClass =
		'inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors transition-shadow duration-150';
</script>

<div class="inline-flex rounded-full border border-app-border bg-app-surface-alt p-1" aria-label={ariaLabel}>
	{#each options as option}
		<button
			aria-pressed={selectedValue === option.value}
			class={`${buttonBaseClass} ${selectedValue === option.value ? 'bg-app-accent-strong text-app-accent-contrast shadow-app-button' : 'text-app-muted hover:text-app-text'}`}
			type="button"
			onclick={() => onSelectValue(option.value)}
		>
			{option.label}
		</button>
	{/each}
</div>