<script lang="ts">
	import AnimatedNumber from '../charts/AnimatedNumber.svelte';
	import MiniAreaChart from '../charts/MiniAreaChart.svelte';
	import type { AppTheme } from '$lib';
	import type { TelegramAnalysisReport } from '$lib/analyzers/telegram-analysis';

	type Props = {
		participantTimeline: TelegramAnalysisReport['participantTimeline'];
		activeTheme: AppTheme;
	};

	let { participantTimeline, activeTheme }: Props = $props();

	function withAlpha(hexColor: string, alpha: number): string {
		const normalized = hexColor.replace('#', '');
		const expanded =
			normalized.length === 3
				? normalized
						.split('')
						.map((character) => character + character)
						.join('')
				: normalized;

		if (expanded.length !== 6) {
			return hexColor;
		}

		const red = Number.parseInt(expanded.slice(0, 2), 16);
		const green = Number.parseInt(expanded.slice(2, 4), 16);
		const blue = Number.parseInt(expanded.slice(4, 6), 16);

		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	const participantLineColor = $derived(activeTheme.chart.nonReplyBar);
	const participantFillColor = $derived(withAlpha(activeTheme.chart.nonReplyBar, 0.16));
	const activeParticipantColor = $derived(activeTheme.chart.replyBar);
	const activeParticipantFillColor = $derived(withAlpha(activeTheme.chart.replyBar, 0.08));
</script>

<article class="surface-card flex flex-col justify-between gap-4 p-5 sm:p-6 lg:col-span-2">
	<div>
		<div class="flex max-w-full flex-wrap items-baseline gap-x-4 gap-y-2 sm:flex-nowrap">
			<div class="flex items-baseline gap-2 whitespace-nowrap text-app-text">
				<strong class="text-3xl leading-none font-semibold text-app-accent font-display">
					<AnimatedNumber value={participantTimeline.currentCount} />
				</strong>
				<span class="text-xs uppercase tracking-widest text-app-subtle">Participants</span>
			</div>
			<div class="flex items-baseline gap-2 whitespace-nowrap" style={`color: ${activeParticipantColor}`}>
				<b class="text-xl leading-none font-semibold font-display">
					<AnimatedNumber value={participantTimeline.currentActiveCount} duration={700} />
				</b>
				<span class="text-xs uppercase tracking-widest">Active</span>
			</div>
		</div>
	</div>
	<MiniAreaChart
		labels={participantTimeline.labels}
		values={participantTimeline.values}
		overlayValues={participantTimeline.activeValues}
		lineColor={participantLineColor}
		fillColor={participantFillColor}
		overlayLineColor={activeParticipantColor}
		overlayFillColor={activeParticipantFillColor}
	/>
</article>