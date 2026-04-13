<script lang="ts">
	import ChartJS from 'chart.js/auto';
	import type { Chart, ChartData, ChartOptions, TooltipItem } from 'chart.js';
	import type { AppTheme } from '$lib';
	import type { AverageMessagePatternChart as AverageMessagePatternChartData } from '$lib/analyzers/telegram-analysis';

	type Props = {
		chartData: AverageMessagePatternChartData;
		activeTheme: AppTheme;
		heightClass?: string;
		emptyMessage?: string;
	};

	let {
		chartData,
		activeTheme,
		heightClass = 'h-full min-h-0',
		emptyMessage = 'Not enough data to draw this user average chart yet.'
	}: Props = $props();

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	let chart: Chart | undefined;
	const averageFormatter = new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	});

	function withAlpha(hexColor: string, alpha: number) {
		const normalizedHex = hexColor.replace('#', '');

		if (normalizedHex.length !== 6) {
			return hexColor;
		}

		const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
		const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
		const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);
		return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
	}

	function getChartData(theme = activeTheme): ChartData<'line'> {
		return {
			labels: chartData.labels,
			datasets: [
				{
					label: 'Average messages',
					data: chartData.values,
					borderColor: theme.chart.nonReplyBar,
					backgroundColor: withAlpha(theme.chart.nonReplyBar, 0.16),
					pointBackgroundColor: theme.chart.nonReplyBar,
					pointBorderColor: theme.chart.tooltipTitle,
					pointHoverBackgroundColor: theme.chart.nonReplyBarHover,
					pointHoverBorderColor: theme.chart.tooltipTitle,
					fill: true,
					tension: 0.35,
					pointRadius: chartData.mode === 'week' ? 3 : 0,
					pointHoverRadius: 4,
					borderWidth: 3
				}
			]
		};
	}

	function getChartOptions(theme = activeTheme): ChartOptions<'line'> {
		return {
			responsive: true,
			maintainAspectRatio: false,
			interaction: {
				mode: 'index',
				intersect: false
			},
			plugins: {
				legend: {
					display: false
				},
				tooltip: {
					displayColors: false,
					backgroundColor: theme.chart.tooltipBackground,
					borderColor: theme.chart.tooltipBorder,
					borderWidth: 1,
					titleColor: theme.chart.tooltipTitle,
					bodyColor: theme.chart.tooltipBody,
					cornerRadius: 12,
					padding: 12,
					callbacks: {
						title(items: TooltipItem<'line'>[]) {
							const [item] = items;
							return item ? chartData.tooltipLabels[item.dataIndex] ?? item.label ?? '' : '';
						},
						label(item: TooltipItem<'line'>) {
							return `Average messages: ${averageFormatter.format(item.parsed.y ?? 0)}`;
						}
					}
				}
			},
			scales: {
				x: {
					grid: {
						display: false
					},
					ticks: {
						color: theme.chart.axisText,
						maxRotation: 0,
						autoSkip: chartData.mode === 'day',
						maxTicksLimit: chartData.mode === 'day' ? 12 : 7
					}
				},
				y: {
					beginAtZero: true,
					ticks: {
						color: theme.chart.axisText,
						callback(value) {
							return averageFormatter.format(Number(value));
						}
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
				type: 'line',
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
	{#if chartData.labels.length > 0}
		<canvas bind:this={canvas} class="h-full w-full" aria-label={`${chartData.title} line chart`}></canvas>
	{:else}
		<p class="grid h-full place-items-center rounded-2xl border border-dashed border-app-border bg-app-empty p-6 text-center text-base text-app-muted">
			{emptyMessage}
		</p>
	{/if}
</div>