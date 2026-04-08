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
	import type { MessageBucketsChart as MessageBucketsChartData } from '$lib/telegram-analysis';

	type Props = {
		messageBuckets: MessageBucketsChartData;
		activeTheme: AppTheme;
		emptyMessage?: string;
		heightClass?: string;
	};

	let {
		messageBuckets,
		activeTheme,
		emptyMessage = 'Not enough data to draw this chart yet.',
		heightClass = 'min-h-88 h-80 sm:h-96 lg:h-136'
	}: Props = $props();

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	let chart: Chart | undefined;

	function getStackValues(dataIndex: number) {
		return [
			messageBuckets.mediaOnlyValues[dataIndex] ?? 0,
			messageBuckets.lowInfoValues[dataIndex] ?? 0,
			messageBuckets.otherValues[dataIndex] ?? 0
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

	function getChartData(theme = activeTheme): ChartData<'bar'> {
		return {
			labels: messageBuckets.labels,
			datasets: [
				{
					label: 'Media only',
					data: messageBuckets.mediaOnlyValues,
					backgroundColor: theme.chart.mediaBar,
					hoverBackgroundColor: theme.chart.mediaBarHover,
					borderRadius: getDatasetBorderRadius(0),
					borderSkipped: false,
					stack: 'messages',
					maxBarThickness: 28
				},
				{
					label: 'Low info',
					data: messageBuckets.lowInfoValues,
					backgroundColor: theme.chart.lowInfoBar,
					hoverBackgroundColor: theme.chart.lowInfoBarHover,
					borderRadius: getDatasetBorderRadius(1),
					borderSkipped: false,
					stack: 'messages',
					maxBarThickness: 28
				},
				{
					label: 'Other messages',
					data: messageBuckets.otherValues,
					backgroundColor: theme.chart.otherBar,
					hoverBackgroundColor: theme.chart.otherBarHover,
					borderRadius: getDatasetBorderRadius(2),
					borderSkipped: false,
					stack: 'messages',
					maxBarThickness: 28
				}
			]
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

							return messageBuckets.tooltipLabels[item.dataIndex] ?? item.label ?? '';
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

<div class={heightClass}>
	{#if messageBuckets.labels.length > 0}
		<canvas bind:this={canvas} class="h-full w-full" aria-label={`${messageBuckets.title} bar chart`}></canvas>
	{:else}
		<p class="grid h-full place-items-center rounded-2xl border border-dashed border-app-border bg-app-empty p-6 text-center text-base text-app-muted">
			{emptyMessage}
		</p>
	{/if}
</div>