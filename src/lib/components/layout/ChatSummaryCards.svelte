<script lang="ts">
	import ParticipantsSummaryCard from './ParticipantsSummaryCard.svelte';
	import TotalMessagesCard from './TotalMessagesCard.svelte';
	import type { AppTheme } from '$lib';
	import type { TelegramAnalysisReport } from '$lib/analyzers/telegram-analysis';

	type Props = {
		report: TelegramAnalysisReport;
		activeTheme: AppTheme;
	};

	let { report, activeTheme }: Props = $props();
</script>

<section class="mb-4 grid gap-4 pt-4 lg:grid-cols-3" aria-label="Chat summary">
	<TotalMessagesCard {report} />

	<ParticipantsSummaryCard participantTimeline={report.participantTimeline} {activeTheme} />
</section>