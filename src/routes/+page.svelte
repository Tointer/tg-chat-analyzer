<script lang="ts">
	import ChartJS from 'chart.js/auto';
	import type {
		BorderRadius,
		Chart,
		ChartData,
		ChartOptions,
		ScriptableContext,
		TooltipItem
	} from 'chart.js';
	import { fromStore } from 'svelte/store';
	import AnimatedNumber from '$lib/AnimatedNumber.svelte';
	import MiniAreaChart from '$lib/MiniAreaChart.svelte';
	import { activeThemeName, cycleTheme, getTheme, themeOrder } from '$lib';
	import type { TelegramAnalysisReport } from '$lib/telegram-analysis';

	type PeriodKey = 'day' | 'week';

	type PageData = {
		selectedPeriod: 'day' | 'week';
		periodReports: Record<PeriodKey, TelegramAnalysisReport>;
	};

	let { data }: { data: PageData } = $props();
	let selectedPeriod = $state<PeriodKey>('week');

	const currentReport = $derived(data.periodReports[selectedPeriod]);
	const themeName = fromStore(activeThemeName);
	const activeTheme = $derived(getTheme(themeName.current));
	const nextTheme = $derived(getTheme(themeOrder[(themeOrder.indexOf(themeName.current) + 1) % themeOrder.length] ?? themeOrder[0]));

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	let chart: Chart | undefined;
	const periodButtonBaseClass =
		'inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors transition-shadow duration-150';

	function getChartDatasets(
		report: TelegramAnalysisReport,
		theme = activeTheme
	): ChartData<'bar'>['datasets'] {
		return [
			{
				label: 'Media only',
				data: report.messageBuckets.mediaOnlyValues,
				backgroundColor: theme.chart.mediaBar,
				hoverBackgroundColor: theme.chart.mediaBarHover,
				borderRadius: getMediaBorderRadius,
				borderSkipped: false,
				stack: 'messages',
				maxBarThickness: 28
			},
			{
				label: 'With text',
				data: report.messageBuckets.textValues,
				backgroundColor: theme.chart.textBar,
				hoverBackgroundColor: theme.chart.textBarHover,
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

	function getChartData(report: TelegramAnalysisReport, theme = activeTheme): ChartData<'bar'> {
		const labels = report.messageBuckets.labels;
		const textValues = report.messageBuckets.textValues;
		const mediaOnlyValues = report.messageBuckets.mediaOnlyValues;
		const datasets = getChartDatasets(report, theme);

		return {
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
		};
	}

	function getChartOptions(report: TelegramAnalysisReport, theme = activeTheme): ChartOptions<'bar'> {
		return {
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
						color: theme.chart.legendText,
						usePointStyle: true,
						pointStyle: 'rectRounded',
						boxWidth: 12,
						padding: 18
					}
				},
				tooltip: {
					displayColors: false,
					backgroundColor: theme.chart.tooltipBackground,
					borderColor: theme.chart.tooltipBorder,
					borderWidth: 1,
					titleColor: theme.chart.tooltipTitle,
					bodyColor: theme.chart.tooltipBody,
					footerColor: theme.chart.tooltipFooter,
					cornerRadius: 12,
					padding: 12,
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
						color: theme.chart.axisText,
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
						color: theme.chart.axisText
					},
					grid: {
						color: theme.chart.grid
					}
				}
			}
		};
	}

	function syncChart(report: TelegramAnalysisReport, theme = activeTheme) {
		if (!canvas) {
			chart?.destroy();
			chart = undefined;
			return;
		}

		if (!chart) {
			chart = new ChartJS(canvas, {
				type: 'bar',
				data: getChartData(report, theme),
				options: getChartOptions(report, theme)
			});
			return;
		}

		chart.data = getChartData(report, theme);
		chart.options = getChartOptions(report, theme);
		chart.update();
	}

	function selectPeriod(period: PeriodKey) {
		selectedPeriod = period;
	}

	$effect(() => {
		syncChart(currentReport, activeTheme);
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

<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
	<section class="relative z-10 mb-2">
		<div class="flex items-end justify-between gap-4">
			<div class="min-w-0">
				<p class="m-0 text-sm uppercase tracking-widest text-app-accent">Chat Stats</p>
				<h1 class="mt-2 mb-0 text-5xl leading-none font-display sm:text-6xl lg:text-7xl">
					{currentReport.chatName}
				</h1>
			</div>
			<button
				type="button"
				class="relative ml-auto inline-flex h-9 w-16 shrink-0 translate-y-3 items-center rounded-full border border-app-border bg-app-surface-alt p-1 shadow-app-card transition-colors duration-150 hover:bg-app-surface"
				aria-label={`Switch theme. Current theme: ${activeTheme.label}. Next theme: ${nextTheme.label}.`}
				onclick={cycleTheme}
			>
				<span class="sr-only">Toggle theme</span>
				<span
					class={`block h-7 w-7 rounded-full bg-app-accent-strong shadow-app-button transition-transform duration-200 ${themeName.current === 'midnight' ? 'translate-x-0' : 'translate-x-7'}`}
				></span>
			</button>
		</div>
	</section>

	<section class="mb-4 grid gap-4 pt-4 lg:grid-cols-3" aria-label="Chat summary">
		<article class="surface-card p-5 sm:p-6">
			<p class="m-0 text-sm uppercase tracking-widest text-app-accent">Total messages</p>
			<strong class="mt-2 block text-3xl leading-none font-display sm:text-4xl">
				<AnimatedNumber value={currentReport.totalMessages} />
			</strong>
			<div class="mt-4 border-t border-app-border pt-3 text-app-muted">
				<span class="block text-xs uppercase tracking-wide text-app-subtle">
					Media-only messages
				</span>
				<b class="mt-1.5 block text-base font-semibold text-app-text font-display">
					<AnimatedNumber value={currentReport.mediaOnlyMessages} duration={700} />
				</b>
			</div>
		</article>

		<article class="surface-card flex flex-col justify-between gap-4 p-5 sm:p-6 lg:col-span-2">
			<div>
				<div class="flex max-w-full flex-wrap items-baseline gap-x-4 gap-y-2 sm:flex-nowrap">
					<div class="flex items-baseline gap-2 whitespace-nowrap text-app-text">
						<strong class="text-3xl leading-none font-semibold text-app-accent font-display">
							<AnimatedNumber value={currentReport.participantTimeline.currentCount} />
						</strong>
						<span class="text-xs uppercase tracking-widest text-app-subtle">
							Participants
						</span>
					</div>
					<div
						class="flex items-baseline gap-2 whitespace-nowrap"
						style={`color: ${activeTheme.miniArea.overlay}`}
					>
						<b class="text-xl leading-none font-semibold font-display">
							<AnimatedNumber
								value={currentReport.participantTimeline.currentActiveCount}
								duration={700}
							/>
						</b>
						<span class="text-xs uppercase tracking-widest">Active</span>
					</div>
				</div>
			</div>
			<MiniAreaChart
				labels={currentReport.participantTimeline.labels}
				values={currentReport.participantTimeline.values}
				overlayValues={currentReport.participantTimeline.activeValues}
				lineColor={activeTheme.miniArea.line}
				fillColor={activeTheme.miniArea.fill}
				overlayLineColor={activeTheme.miniArea.overlay}
			/>
		</article>
	</section>

	<section class="surface-card p-5 sm:p-6">
		<div class="mb-4 flex flex-wrap items-end justify-between gap-4">
			<div>
				<h2 class="mt-1 mb-0 text-2xl font-display sm:text-3xl">
					{currentReport.messageBuckets.title}
				</h2>
			</div>
			<div class="inline-flex rounded-full border border-app-border bg-app-surface-alt p-1" aria-label="Message period selector">
				<button
					aria-pressed={selectedPeriod === 'week'}
					class={`${periodButtonBaseClass} ${selectedPeriod === 'week' ? 'bg-app-accent-strong text-app-accent-contrast shadow-app-button' : 'text-app-muted hover:text-app-text'}`}
					type="button"
					onclick={() => selectPeriod('week')}
				>
					Weeks
				</button>
				<button
					aria-pressed={selectedPeriod === 'day'}
					class={`${periodButtonBaseClass} ${selectedPeriod === 'day' ? 'bg-app-accent-strong text-app-accent-contrast shadow-app-button' : 'text-app-muted hover:text-app-text'}`}
					type="button"
					onclick={() => selectPeriod('day')}
				>
					Days
				</button>
			</div>
		</div>

		<div class="min-h-88 h-80 sm:h-96 lg:h-136">
			{#if currentReport.messageBuckets.labels.length > 0}
				<canvas bind:this={canvas} class="h-full w-full" aria-label={`${currentReport.messageBuckets.title} bar chart`}></canvas>
			{:else}
				<p class="grid h-full place-items-center rounded-2xl border border-dashed border-app-border bg-app-empty p-6 text-center text-base text-app-muted">
					Not enough complete periods to draw this chart yet.
				</p>
			{/if}
		</div>
	</section>
</div>
