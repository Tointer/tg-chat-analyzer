<script lang="ts">
	import ChartJS from 'chart.js/auto';
	import type { BorderRadius, Chart, ScriptableContext, TooltipItem } from 'chart.js';
	import AnimatedNumber from '$lib/AnimatedNumber.svelte';
	import MiniAreaChart from '$lib/MiniAreaChart.svelte';
	import type { TelegramAnalysisReport } from '$lib/telegram-analysis';

	type PeriodKey = 'day' | 'week';

	type PageData = {
		selectedPeriod: 'day' | 'week';
		periodReports: Record<PeriodKey, TelegramAnalysisReport>;
	};

	let { data }: { data: PageData } = $props();
	let selectedPeriod = $state<PeriodKey>('week');

	const currentReport = $derived(data.periodReports[selectedPeriod]);

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	let chart: Chart | undefined;

	function getChartDatasets(report: TelegramAnalysisReport) {
		return [
			{
				label: 'Media only',
				data: report.messageBuckets.mediaOnlyValues,
				backgroundColor: '#f59e0b',
				hoverBackgroundColor: '#d97706',
				borderRadius: getMediaBorderRadius,
				borderSkipped: false,
				stack: 'messages',
				maxBarThickness: 28
			},
			{
				label: 'With text',
				data: report.messageBuckets.textValues,
				backgroundColor: '#0f766e',
				hoverBackgroundColor: '#115e59',
				borderRadius: getTextBorderRadius,
				borderSkipped: false,
				stack: 'messages',
				maxBarThickness: 28
			}
		];
	}

	function getTopOnlyRadius(shouldRoundTop: boolean): BorderRadius {
		return shouldRoundTop
			? { topLeft: 10, topRight: 10, bottomLeft: 0, bottomRight: 0 }
			: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
	}

	function getTextBorderRadius(context: ScriptableContext<'bar'>): BorderRadius {
		const value = currentReport.messageBuckets.textValues[context.dataIndex] ?? 0;
		return getTopOnlyRadius(value > 0);
	}

	function getMediaBorderRadius(context: ScriptableContext<'bar'>): BorderRadius {
		const mediaValue = currentReport.messageBuckets.mediaOnlyValues[context.dataIndex] ?? 0;
		const textValue = currentReport.messageBuckets.textValues[context.dataIndex] ?? 0;
		return getTopOnlyRadius(mediaValue > 0 && textValue === 0);
	}

	function syncChart(report: TelegramAnalysisReport) {
		const labels = report.messageBuckets.labels;
		const textValues = report.messageBuckets.textValues;
		const mediaOnlyValues = report.messageBuckets.mediaOnlyValues;
		const datasets = getChartDatasets(report);

		if (!canvas) {
			chart?.destroy();
			chart = undefined;
			return;
		}

		if (!chart) {
			chart = new ChartJS(canvas, {
				type: 'bar',
				data: {
					labels,
					datasets: [
						{
							...datasets[0],
							data: mediaOnlyValues
						},
						{
							...datasets[1],
							data: textValues
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					interaction: {
						mode: 'index',
						intersect: false
					},
					plugins: {
						legend: {
							display: true,
							position: 'top',
							labels: {
								color: '#27272a',
								usePointStyle: true,
								pointStyle: 'rectRounded',
								boxWidth: 12,
								padding: 18
							}
						},
						tooltip: {
							displayColors: false,
							callbacks: {
								title(items: TooltipItem<'bar'>[]) {
									const [item] = items;
									if (!item) {
										return '';
									}

									return report.messageBuckets.tooltipLabels[item.dataIndex] ?? item.label ?? '';
								},
								footer(items: TooltipItem<'bar'>[]) {
									const total = items.reduce((sum, item) => sum + (item.parsed.y ?? 0), 0);
									return `Total: ${total}`;
								}
							}
						}
					},
					scales: {
						x: {
							stacked: true,
							grid: {
								display: false
							},
							ticks: {
								color: '#3f3f46',
								maxRotation: 0,
								autoSkip: true,
								maxTicksLimit: 12
							}
						},
						y: {
							stacked: true,
							beginAtZero: true,
							ticks: {
								precision: 0,
								color: '#3f3f46'
							},
							grid: {
								color: 'rgba(15, 23, 42, 0.08)'
							}
						}
					}
				}
			});
			return;
		}

		chart.data.labels = labels;
		chart.data.datasets = [
			{
				...datasets[0],
				data: mediaOnlyValues
			},
			{
				...datasets[1],
				data: textValues
			}
		];
		chart.update();
	}

	function selectPeriod(period: PeriodKey) {
		selectedPeriod = period;
	}

	$effect(() => {
		syncChart(currentReport);
	});

	$effect(() => {
		selectedPeriod = data.selectedPeriod;
	});

	$effect(() => {
		return () => {
			chart?.destroy();
			chart = undefined;
		};
	});
</script>

<svelte:head>
	<title>Telegram Chat Analyzer</title>
	<meta
		name="description"
		content={`Analyze Telegram exports and explore message volume by ${currentReport.messageBuckets.groupingLabel}.`}
	/>
</svelte:head>

<div class="page-shell">
	<section class="hero">
		<div>
			<p class="eyebrow">Chat Stats</p>
			<h1>{currentReport.chatName}</h1>
		</div>
	</section>

	<section class="stats-grid" aria-label="Chat summary">
		<article class="stat-card">
			<p>Total messages</p>
			<strong><AnimatedNumber value={currentReport.totalMessages} /></strong>
			<div class="stat-subset">
				<span>Media-only messages</span>
				<b><AnimatedNumber value={currentReport.mediaOnlyMessages} duration={700} /></b>
			</div>
		</article>

		<article class="stat-card participant-card">
			<div class="participant-header">
				<div class="participant-metrics">
					<div class="participant-metric-row participant-metric-row-primary">
						<strong><AnimatedNumber value={currentReport.participantTimeline.currentCount} /></strong>
						<span>Participants</span>
					</div>
					<div class="participant-metric-row participant-metric-row-secondary">
						<b><AnimatedNumber value={currentReport.participantTimeline.currentActiveCount} duration={700} /></b>
						<span>Active</span>
					</div>
				</div>
			</div>
			<MiniAreaChart
				labels={currentReport.participantTimeline.labels}
				values={currentReport.participantTimeline.values}
				overlayValues={currentReport.participantTimeline.activeValues}
				lineColor="#0f766e"
				fillColor="rgba(15, 118, 110, 0.14)"
				overlayLineColor="#f59e0b"
			/>
		</article>
	</section>

	<section class="chart-card">
		<div class="chart-header">
			<div>
				<h2>{currentReport.messageBuckets.title}</h2>
			</div>
			<div class="period-switcher" aria-label="Message period selector">
				<button
					aria-pressed={selectedPeriod === 'week'}
					class:period-toggle-active={selectedPeriod === 'week'}
					class="period-toggle"
					type="button"
					onclick={() => selectPeriod('week')}
				>
					Weeks
				</button>
				<button
					aria-pressed={selectedPeriod === 'day'}
					class:period-toggle-active={selectedPeriod === 'day'}
					class="period-toggle"
					type="button"
					onclick={() => selectPeriod('day')}
				>
					Days
				</button>
			</div>
		</div>

		<div class="chart-frame">
			{#if currentReport.messageBuckets.labels.length > 0}
				<canvas
					bind:this={canvas}
					aria-label={`${currentReport.messageBuckets.title} bar chart`}
				></canvas>
			{:else}
				<p class="chart-empty">Not enough complete periods to draw this chart yet.</p>
			{/if}
		</div>
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
		background:
			radial-gradient(circle at top left, rgba(20, 184, 166, 0.16), transparent 34%),
			linear-gradient(180deg, #f7f7f5 0%, #eef4f2 100%);
		color: #18181b;
	}

	.page-shell {
		max-width: 1120px;
		margin: 0 auto;
		padding: 3rem 1.5rem 4rem;
	}

	.hero {
		display: block;
		margin-bottom: 1.5rem;
	}

	.eyebrow,
	.stat-card p {
		margin: 0;
		font-size: 0.875rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #0f766e;
	}

	h1,
	h2,
	.stat-card strong {
		font-family: 'Sora', 'Segoe UI', sans-serif;
	}

	h1 {
		margin: 0.35rem 0 0.75rem;
		font-size: clamp(2.3rem, 4vw, 4.75rem);
		line-height: 0.95;
	}

	.lede {
		max-width: 42rem;
		margin: 0;
		font-size: 1.05rem;
		line-height: 1.6;
		color: #3f3f46;
	}

	.chart-note {
		margin: 0.85rem 0 0;
		font-size: 0.92rem;
		line-height: 1.5;
		color: #52525b;
	}

	.stat-card,
	.chart-card {
		background: rgba(255, 255, 255, 0.82);
		backdrop-filter: blur(14px);
		border: 1px solid rgba(15, 118, 110, 0.12);
		box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: minmax(0, 24rem) minmax(0, 1fr);
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.stat-card {
		padding: 1.25rem;
		border-radius: 1.25rem;
	}

	.stat-card strong {
		display: block;
		margin-top: 0.45rem;
		font-size: clamp(1.8rem, 3vw, 2.6rem);
		line-height: 1;
	}

	.stat-subset {
		margin-top: 0.9rem;
		padding-top: 0.8rem;
		border-top: 1px solid rgba(15, 118, 110, 0.12);
		color: #52525b;
	}

	.stat-subset span {
		display: block;
		font-size: 0.82rem;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.stat-subset b {
		display: block;
		margin-top: 0.35rem;
		font-family: 'Sora', 'Segoe UI', sans-serif;
		font-size: 1.05rem;
		font-weight: 600;
		color: #27272a;
	}

	.participant-card {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 1rem;
	}

	.participant-header {
		display: block;
	}

	.participant-metrics {
		display: flex;
		justify-content: flex-start;
		align-items: baseline;
		gap: 0.9rem;
		flex-wrap: nowrap;
		width: fit-content;
		max-width: 100%;
	}

	.participant-metric-row {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		color: #27272a;
		white-space: nowrap;
	}

	.participant-metric-row span {
		font-size: 0.82rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #52525b;
	}

	.participant-metric-row b,
	.participant-metric-row strong {
		font-family: 'Sora', 'Segoe UI', sans-serif;
		font-size: 1.65rem;
		font-weight: 600;
		line-height: 1;
	}

	.participant-metric-row-primary strong {
		color: #0f766e;
	}

	.participant-metric-row-secondary b {
		font-size: 1.2rem;
		color: #f59e0b;
	}

	.chart-card {
		border-radius: 1.75rem;
		padding: 1.5rem;
	}

	.chart-header {
		display: flex;
		justify-content: space-between;
		align-items: end;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}

	.period-switcher {
		display: inline-flex;
		padding: 0.3rem;
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.05);
		border: 1px solid rgba(15, 118, 110, 0.12);
	}

	.period-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.55rem 0.95rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		cursor: pointer;
		font-size: 0.88rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #3f3f46;
		text-decoration: none;
		transition:
			background-color 160ms ease,
			color 160ms ease,
			box-shadow 160ms ease;
	}

	.period-toggle:hover {
		color: #18181b;
	}

	.period-toggle-active {
		background: #0f766e;
		color: white;
		box-shadow: 0 10px 24px rgba(15, 118, 110, 0.2);
	}

	h2 {
		margin: 0.25rem 0 0;
		font-size: clamp(1.5rem, 2vw, 2.25rem);
	}

	.chart-frame {
		height: min(60vh, 34rem);
		min-height: 22rem;
	}

	.chart-empty {
		display: grid;
		place-items: center;
		height: 100%;
		margin: 0;
		border-radius: 1.25rem;
		border: 1px dashed rgba(15, 118, 110, 0.18);
		background: rgba(255, 255, 255, 0.38);
		color: #52525b;
		font-size: 0.98rem;
		text-align: center;
		padding: 1.5rem;
	}

	@media (max-width: 860px) {
		.page-shell {
			padding: 1.5rem 1rem 3rem;
		}

		.stats-grid {
			grid-template-columns: 1fr;
		}

		.participant-metrics {
			flex-wrap: wrap;
		}
	}
</style>
