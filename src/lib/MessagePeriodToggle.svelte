<script lang="ts">
	type PeriodKey = 'day' | 'week';

	type Props = {
		selectedPeriod: PeriodKey;
		onSelectPeriod: (period: PeriodKey) => void;
		ariaLabel?: string;
	};

	let {
		selectedPeriod,
		onSelectPeriod,
		ariaLabel = 'Message period selector'
	}: Props = $props();

	const buttonBaseClass =
		'inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors transition-shadow duration-150';
</script>

<div class="inline-flex rounded-full border border-app-border bg-app-surface-alt p-1" aria-label={ariaLabel}>
	<button
		aria-pressed={selectedPeriod === 'week'}
		class={`${buttonBaseClass} ${selectedPeriod === 'week' ? 'bg-app-accent-strong text-app-accent-contrast shadow-app-button' : 'text-app-muted hover:text-app-text'}`}
		type="button"
		onclick={() => onSelectPeriod('week')}
	>
		Weeks
	</button>
	<button
		aria-pressed={selectedPeriod === 'day'}
		class={`${buttonBaseClass} ${selectedPeriod === 'day' ? 'bg-app-accent-strong text-app-accent-contrast shadow-app-button' : 'text-app-muted hover:text-app-text'}`}
		type="button"
		onclick={() => onSelectPeriod('day')}
	>
		Days
	</button>
</div>