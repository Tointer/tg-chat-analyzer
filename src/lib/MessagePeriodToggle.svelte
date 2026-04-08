<script lang="ts">
	import SegmentedSelector from '$lib/SegmentedSelector.svelte';

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

	const options = [
		{ value: 'week', label: 'Weeks' },
		{ value: 'day', label: 'Days' }
	];
</script>

<SegmentedSelector
	selectedValue={selectedPeriod}
	onSelectValue={(value) => onSelectPeriod(value as PeriodKey)}
	{options}
	{ariaLabel}
/>