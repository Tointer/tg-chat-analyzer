<script lang="ts">
	import type { AppTheme } from '$lib';
	import MessageBucketsChart from './MessageBucketsChart.svelte';
	import MessagePeriodToggle from './MessagePeriodToggle.svelte';
	import type { TelegramAnalysisReport } from '$lib/telegram-analysis';

	type PeriodKey = 'day' | 'week';

	type Props = {
		report: TelegramAnalysisReport;
		activeTheme: AppTheme;
		selectedPeriod: PeriodKey;
		onSelectPeriod: (period: PeriodKey) => void;
	};

	let { report, activeTheme, selectedPeriod, onSelectPeriod }: Props = $props();
</script>

<section class="surface-card p-5 sm:p-6">
	<div class="mb-4 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h2 class="mt-1 mb-0 text-2xl font-display sm:text-3xl">{report.messageBuckets.title}</h2>
		</div>
		<MessagePeriodToggle {selectedPeriod} {onSelectPeriod} />
	</div>

	<MessageBucketsChart messageBuckets={report.messageBuckets} {activeTheme} />
</section>