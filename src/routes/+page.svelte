<script lang="ts">
	import { onMount } from 'svelte';
	import ChartJS from 'chart.js/auto';
	import type { Chart } from 'chart.js';

	type WeeklyChartData = {
		chatName: string;
		weeklyMessages: {
			labels: string[];
			values: number[];
		};
		totalMessages: number;
		weekCount: number;
		busiestWeek: {
			label: string;
			count: number;
		};
		range: {
			start: string;
			end: string;
		};
	};

	let { data }: { data: WeeklyChartData } = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | undefined;

	onMount(() => {
		chart = new ChartJS(canvas, {
			type: 'bar',
			data: {
				labels: data.weeklyMessages.labels,
				datasets: [
					{
						label: 'Messages',
						data: data.weeklyMessages.values,
						backgroundColor: '#0f766e',
						hoverBackgroundColor: '#115e59',
						borderRadius: 10,
						borderSkipped: false,
						maxBarThickness: 28
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
								return item?.label ? `Week of ${item.label}` : '';
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
							color: '#3f3f46',
							maxRotation: 0,
							autoSkip: true,
							maxTicksLimit: 12
						}
					},
					y: {
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

		return () => {
			chart?.destroy();
		};
	});
</script>

<svelte:head>
	<title>Telegram Chat Analyzer</title>
	<meta
		name="description"
		content="Analyze Telegram exports and explore weekly message volume."
	/>
</svelte:head>

<div class="page-shell">
	<section class="hero">
		<div>
			<p class="eyebrow">Telegram Chat Analyzer</p>
			<h1>{data.chatName}</h1>
			<p class="lede">
				Weekly message volume for the imported Telegram history. Service events are excluded.
			</p>
		</div>

		<div class="hero-note">
			<p class="hero-label">Range</p>
			<p class="hero-value">{data.range.start} to {data.range.end}</p>
		</div>
	</section>

	<section class="stats-grid" aria-label="Chat summary">
		<article class="stat-card">
			<p>Total messages</p>
			<strong>{data.totalMessages.toLocaleString()}</strong>
		</article>
		<article class="stat-card">
			<p>Tracked weeks</p>
			<strong>{data.weekCount}</strong>
		</article>
		<article class="stat-card accent">
			<p>Busiest week</p>
			<strong>{data.busiestWeek.label}</strong>
			<span>{data.busiestWeek.count.toLocaleString()} messages</span>
		</article>
	</section>

	<section class="chart-card">
		<div class="chart-header">
			<div>
				<p class="eyebrow">Chart</p>
				<h2>Messages per week</h2>
			</div>
			<p class="chart-caption">Bars are grouped by ISO week, starting on Monday.</p>
		</div>

		<div class="chart-frame">
			<canvas bind:this={canvas} aria-label="Messages per week bar chart"></canvas>
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
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1.5rem;
		align-items: end;
		margin-bottom: 1.5rem;
	}

	.eyebrow,
	.hero-label,
	.chart-caption,
	.stat-card p,
	.hero-note p {
		margin: 0;
		font-size: 0.875rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #0f766e;
	}

	h1,
	h2,
	.hero-value,
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

	.hero-note,
	.stat-card,
	.chart-card {
		background: rgba(255, 255, 255, 0.82);
		backdrop-filter: blur(14px);
		border: 1px solid rgba(15, 118, 110, 0.12);
		box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
	}

	.hero-note {
		padding: 1rem 1.2rem;
		border-radius: 1.25rem;
		min-width: 15rem;
	}

	.hero-value {
		margin: 0.35rem 0 0;
		font-size: 1.125rem;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
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

	.stat-card span {
		display: inline-block;
		margin-top: 0.5rem;
		color: #52525b;
	}

	.stat-card.accent {
		background: linear-gradient(135deg, rgba(15, 118, 110, 0.12), rgba(255, 255, 255, 0.92));
	}

	.chart-card {
		border-radius: 1.75rem;
		padding: 1.5rem;
	}

	.chart-header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: end;
		margin-bottom: 1rem;
	}

	h2 {
		margin: 0.25rem 0 0;
		font-size: clamp(1.5rem, 2vw, 2.25rem);
	}

	.chart-caption {
		max-width: 18rem;
		text-align: right;
		line-height: 1.5;
	}

	.chart-frame {
		height: min(60vh, 34rem);
		min-height: 22rem;
	}

	@media (max-width: 860px) {
		.page-shell {
			padding: 1.5rem 1rem 3rem;
		}

		.hero,
		.stats-grid {
			grid-template-columns: 1fr;
		}

		.chart-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.chart-caption {
			max-width: none;
			text-align: left;
		}
	}
</style>
