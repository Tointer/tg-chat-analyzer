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
	import type { AppTheme } from '$lib';
	import type { TelegramAnalysisReport } from '$lib/telegram-analysis';

	type PeriodKey = 'day' | 'week';

	type Props = {
		report: TelegramAnalysisReport;
		activeTheme: AppTheme;
		selectedPeriod: PeriodKey;
		onSelectPeriod: (period: PeriodKey) => void;
	};

	let { report, activeTheme, selectedPeriod, onSelectPeriod }: Props = $props();

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	let chart: Chart | undefined;
	const periodButtonBaseClass =
		'inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors transition-shadow duration-150';

	function getStackValues(dataIndex: number) {
		return [
			report.messageBuckets.mediaOnlyValues[dataIndex] ?? 0,
			report.messageBuckets.lowInfoValues[dataIndex] ?? 0,
			report.messageBuckets.otherValues[dataIndex] ?? 0
		];
	}

	function getTopOnlyRadius(shouldRoundTop: boolean): BorderRadius {
		return shouldRoundTop
			? { topLeft: 10, topRight: 10, bottomLeft: 0, bottomRight: 0 }
			: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
	}

	function getDatasetBorderRadius(seriesIndex: number) {
		return (context: ScriptableContext<'bar'>): BorderRadius => {
			const stackValues = getStackValues(context.dataIndex);
			const topSeriesIndex = stackValues.findLastIndex((value) => value > 0);
			return getTopOnlyRadius(stackValues[seriesIndex] > 0 && topSeriesIndex === seriesIndex);
		};
	}

	function getChartDatasets(theme = activeTheme): ChartData<'bar'>['datasets'] {
		return [
			{
				label: 'Media only',
				data: report.messageBuckets.mediaOnlyValues,
				backgroundColor: theme.chart.mediaBar,
				hoverBackgroundColor: theme.chart.mediaBarHover,
				borderRadius: getDatasetBorderRadius(0),
				borderSkipped: false,
				stack: 'messages',
				maxBarThickness: 28
			},
			{
				label: 'Low info',
				data: report.messageBuckets.lowInfoValues,
				backgroundColor: theme.chart.lowInfoBar,
				hoverBackgroundColor: theme.chart.lowInfoBarHover,
				borderRadius: getDatasetBorderRadius(1),
				borderSkipped: false,
				stack: 'messages',
				maxBarThickness: 28
			},
			{
				label: 'Other messages',
				data: report.messageBuckets.otherValues,
				backgroundColor: theme.chart.otherBar,
				hoverBackgroundColor: theme.chart.otherBarHover,
				borderRadius: getDatasetBorderRadius(2),
				borderSkipped: false,
				stack: 'messages',
				maxBarThickness: 28
			}
		];
	}

	function getChartData(theme = activeTheme): ChartData<'bar'> {
		const datasets = getChartDatasets(theme);

		return {
			labels: report.messageBuckets.labels,
			datasets
		};
	}

	function getChartOptions(theme = activeTheme): ChartOptions<'bar'> {
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

	function syncChart(theme = activeTheme) {
		if (!canvas) {
			chart?.destroy();
			chart = undefined;
			return;
		}

		if (!chart) {
			chart = new ChartJS(canvas, {
				type: 'bar',
				data: getChartData(theme),
				options: getChartOptions(theme)
			});
			return;
		}

		chart.data = getChartData(theme);
		chart.options = getChartOptions(theme);
		chart.update();
	}

	$effect(() => {
		syncChart(activeTheme);
	});

	$effect(() => {
		return () => {
			chart?.destroy();
			chart = undefined;
		};
	});
</script>

<section class="surface-card p-5 sm:p-6">
	<div class="mb-4 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h2 class="mt-1 mb-0 text-2xl font-display sm:text-3xl">{report.messageBuckets.title}</h2>
		</div>
		<div class="inline-flex rounded-full border border-app-border bg-app-surface-alt p-1" aria-label="Message period selector">
			<button
				aria-pressed={selectedPeriod === 'week'}
				class={`${periodButtonBaseClass} ${selectedPeriod === 'week' ? 'bg-app-accent-strong text-app-accent-contrast shadow-app-button' : 'text-app-muted hover:text-app-text'}`}
				type="button"
				onclick={() => onSelectPeriod('week')}
			>
				Weeks
			</button>
			<button
				aria-pressed={selectedPeriod === 'day'}
				class={`${periodButtonBaseClass} ${selectedPeriod === 'day' ? 'bg-app-accent-strong text-app-accent-contrast shadow-app-button' : 'text-app-muted hover:text-app-text'}`}
				type="button"
				onclick={() => onSelectPeriod('day')}
			>
				Days
			</button>
		</div>
	</div>

	<div class="min-h-88 h-80 sm:h-96 lg:h-136">
		{#if report.messageBuckets.labels.length > 0}
			<canvas bind:this={canvas} class="h-full w-full" aria-label={`${report.messageBuckets.title} bar chart`}></canvas>
		{:else}
			<p class="grid h-full place-items-center rounded-2xl border border-dashed border-app-border bg-app-empty p-6 text-center text-base text-app-muted">
				Not enough complete periods to draw this chart yet.
			</p>
		{/if}
	</div>
</section>