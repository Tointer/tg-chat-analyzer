<script lang="ts">
	import ChartJS from 'chart.js/auto';
	import type { Chart, ChartData, ChartOptions } from 'chart.js';

	type Props = {
		labels: string[];
		values: number[];
		overlayValues?: number[];
		lineColor?: string;
		fillColor?: string;
		overlayLineColor?: string;
	};

	let {
		labels,
		values,
		overlayValues = [],
		lineColor = '#0f766e',
		fillColor = 'rgba(15, 118, 110, 0.16)',
		overlayLineColor = '#f59e0b'
	}: Props = $props();

	let canvas = $state<HTMLCanvasElement | undefined>(undefined);
	let chart: Chart | undefined;

	function getChartData(): ChartData<'line'> {
		return {
			labels,
			datasets: [
				{
					label: 'Participants',
					data: values,
					borderColor: lineColor,
					backgroundColor: fillColor,
					fill: true,
					tension: 0.35,
					pointRadius: 0,
					pointHoverRadius: 3,
					borderWidth: 2
				},
				{
					label: 'Active participants',
					data: overlayValues,
					borderColor: overlayLineColor,
					backgroundColor: 'transparent',
					fill: false,
					tension: 0.35,
					pointRadius: 0,
					pointHoverRadius: 3,
					borderWidth: 2
				}
			]
		};
	}

	function getChartOptions(): ChartOptions<'line'> {
		return {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					display: false
				},
				tooltip: {
					displayColors: false,
					callbacks: {
						title(items) {
							const [item] = items;
							return item?.label ?? '';
						},
						label(item) {
							const label = item.dataset.label ?? 'Participants';
							return `${label}: ${item.parsed.y ?? 0}`;
						}
					}
				}
			},
			scales: {
				x: {
					display: false,
					grid: {
						display: false
					}
				},
				y: {
					display: false,
					beginAtZero: false,
					grid: {
						display: false
					}
				}
			},
			elements: {
				line: {
					capBezierPoints: true
				}
			}
		};
	}

	function syncChart() {
		if (!canvas) {
			chart?.destroy();
			chart = undefined;
			return;
		}

		if (!chart) {
			chart = new ChartJS(canvas, {
				type: 'line',
				data: getChartData(),
				options: getChartOptions()
			});
			return;
		}

		chart.data = getChartData();
		chart.options = getChartOptions();
		chart.update();
	}

	$effect(() => {
		syncChart();
	});

	$effect(() => {
		return () => {
			chart?.destroy();
			chart = undefined;
		};
	});
</script>

<div class="h-38">
	<canvas bind:this={canvas} aria-label="Participant count area chart"></canvas>
</div>