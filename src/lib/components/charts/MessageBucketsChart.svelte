<script lang="ts">
	import ChartJS from 'chart.js/auto';
	import type {
		BorderRadius,
		Chart,
		ChartData,
		ChartOptions,
		ChartDataset,
		ScriptableContext,
		TooltipItem
	} from 'chart.js';
	import type { AppTheme } from '$lib';
	import type { MessageBucketsChart as MessageBucketsChartData } from '$lib/analyzers/telegram-analysis';

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

	function getSeriesEntries() {
		return (
			messageBuckets.series ?? [
				{
					key: 'reply',
					label: 'Replies',
					colorKey: 'reply',
					values: messageBuckets.replyValues
				},
				{
					key: 'non-reply',
					label: 'Non-replies',
					colorKey: 'nonReply',
					values: messageBuckets.nonReplyValues
				}
			]
		);
	}

	function getStackValues(dataIndex: number) {
		return getSeriesEntries().map((series) => series.values[dataIndex] ?? 0);
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

	function getSeriesColors(colorKey: string, theme = activeTheme) {
		switch (colorKey) {
			case 'reply':
				return {
					backgroundColor: theme.chart.replyBar,
					hoverBackgroundColor: theme.chart.replyBarHover
				};
			case 'nonReply':
				return {
					backgroundColor: theme.chart.nonReplyBar,
					hoverBackgroundColor: theme.chart.nonReplyBarHover
				};
			case 'image':
				return {
					backgroundColor: theme.chart.imageBar,
					hoverBackgroundColor: theme.chart.imageBarHover
				};
			case 'video':
				return {
					backgroundColor: theme.chart.videoBar,
					hoverBackgroundColor: theme.chart.videoBarHover
				};
			case 'gif':
				return {
					backgroundColor: theme.chart.gifBar,
					hoverBackgroundColor: theme.chart.gifBarHover
				};
			case 'sticker':
				return {
					backgroundColor: theme.chart.stickerBar,
					hoverBackgroundColor: theme.chart.stickerBarHover
				};
			default:
				return {
					backgroundColor: theme.chart.nonReplyBar,
					hoverBackgroundColor: theme.chart.nonReplyBarHover
				};
		}
	}

	function getChartData(theme = activeTheme): ChartData<'bar'> {
		const seriesEntries = getSeriesEntries();
		const datasets: ChartDataset<'bar'>[] = seriesEntries.map((series, seriesIndex) => {
			const colors = getSeriesColors(series.colorKey, theme);

			return {
				label: series.label,
				data: series.values,
				backgroundColor: colors.backgroundColor,
				hoverBackgroundColor: colors.hoverBackgroundColor,
				borderRadius: getDatasetBorderRadius(seriesIndex),
				borderSkipped: false,
				stack: 'messages',
				maxBarThickness: 28
			};
		});

		return {
			labels: messageBuckets.labels,
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