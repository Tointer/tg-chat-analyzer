<script lang="ts">
	import { onMount } from 'svelte';
	import ChartJS from 'chart.js/auto';
	import type { Chart } from 'chart.js';

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

	let canvas: HTMLCanvasElement;
	let chart: Chart | undefined;

	onMount(() => {
		chart = new ChartJS(canvas, {
			type: 'line',
			data: {
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
			},
			options: {
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
			}
		});

		return () => {
			chart?.destroy();
		};
	});
</script>

<div class="mini-area-chart">
	<canvas bind:this={canvas} aria-label="Participant count area chart"></canvas>
</div>

<style>
	.mini-area-chart {
		height: 9.5rem;
	}
</style>