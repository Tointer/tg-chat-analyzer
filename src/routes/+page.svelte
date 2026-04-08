<script lang="ts">
	import { onMount } from 'svelte';
	import ChartJS from 'chart.js/auto';
	import type { BorderRadius, Chart, ScriptableContext } from 'chart.js';

	type WeeklyChartData = {
		chatName: string;
		weeklyMessages: {
			labels: string[];
			textValues: number[];
			mediaOnlyValues: number[];
		};
		totalMessages: number;
		textMessages: number;
		mediaOnlyMessages: number;
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

	function getTopOnlyRadius(shouldRoundTop: boolean): BorderRadius {
		return shouldRoundTop
			? { topLeft: 10, topRight: 10, bottomLeft: 0, bottomRight: 0 }
			: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 };
	}

	function getTextBorderRadius(context: ScriptableContext<'bar'>): BorderRadius {
		const value = data.weeklyMessages.textValues[context.dataIndex] ?? 0;
		return getTopOnlyRadius(value > 0);
	}

	function getMediaBorderRadius(context: ScriptableContext<'bar'>): BorderRadius {
		const mediaValue = data.weeklyMessages.mediaOnlyValues[context.dataIndex] ?? 0;
		const textValue = data.weeklyMessages.textValues[context.dataIndex] ?? 0;
		return getTopOnlyRadius(mediaValue > 0 && textValue === 0);
	}

	onMount(() => {
		chart = new ChartJS(canvas, {
			type: 'bar',
			data: {
				labels: data.weeklyMessages.labels,
				datasets: [
					{
						label: 'Media only',
						data: data.weeklyMessages.mediaOnlyValues,
						backgroundColor: '#f59e0b',
						hoverBackgroundColor: '#d97706',
						borderRadius: getMediaBorderRadius,
						borderSkipped: false,
						stack: 'messages',
						maxBarThickness: 28
					},
					{
						label: 'With text',
						data: data.weeklyMessages.textValues,
						backgroundColor: '#0f766e',
						hoverBackgroundColor: '#115e59',
						borderRadius: getTextBorderRadius,
						borderSkipped: false,
						stack: 'messages',
						maxBarThickness: 28
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
							title(items) {
								const [item] = items;
								return item?.label ? `Week of ${item.label}` : '';
							},
							footer(items) {
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
			<p>Total classified messages</p>
			<strong>{data.totalMessages.toLocaleString()}</strong>
		</article>
		<article class="stat-card">
			<p>Messages with text</p>
			<strong>{data.textMessages.toLocaleString()}</strong>
		</article>
		<article class="stat-card">
			<p>Media-only messages</p>
			<strong>{data.mediaOnlyMessages.toLocaleString()}</strong>
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
			<p class="chart-caption">
				Stacked by text vs media-only messages. {data.weekCount} ISO weeks, starting on Monday.
			</p>
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
		grid-template-columns: repeat(4, minmax(0, 1fr));
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
