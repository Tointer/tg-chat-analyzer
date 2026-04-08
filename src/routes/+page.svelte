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
	const periodButtonBaseClass =
		'inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors transition-shadow duration-150';

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

<div class="min-h-screen">
	<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
		<section class="mb-6">
			<div>
				<p class="m-0 text-sm uppercase tracking-widest text-teal-700">Chat Stats</p>
				<h1
					class="mt-2 mb-0 text-5xl leading-none font-display sm:text-6xl lg:text-7xl"
				>
					{currentReport.chatName}
				</h1>
			</div>
		</section>

		<section
			class="mb-4 grid gap-4 lg:grid-cols-3"
			aria-label="Chat summary"
		>
			<article class="surface-card p-5 sm:p-6">
				<p class="m-0 text-sm uppercase tracking-widest text-teal-700">Total messages</p>
				<strong
					class="mt-2 block text-3xl leading-none font-display sm:text-4xl"
				>
					<AnimatedNumber value={currentReport.totalMessages} />
				</strong>
				<div class="mt-4 border-t border-teal-700/12 pt-3 text-zinc-600">
					<span class="block text-xs uppercase tracking-wide">
						Media-only messages
					</span>
					<b class="mt-1.5 block text-base font-semibold text-zinc-800 font-display">
						<AnimatedNumber value={currentReport.mediaOnlyMessages} duration={700} />
					</b>
				</div>
			</article>

			<article class="surface-card flex flex-col justify-between gap-4 p-5 sm:p-6 lg:col-span-2">
				<div>
					<div class="flex max-w-full flex-wrap items-baseline gap-x-4 gap-y-2 sm:flex-nowrap">
						<div class="flex items-baseline gap-2 whitespace-nowrap text-zinc-800">
							<strong class="text-3xl leading-none font-semibold text-teal-700 font-display">
								<AnimatedNumber value={currentReport.participantTimeline.currentCount} />
							</strong>
							<span class="text-xs uppercase tracking-widest text-zinc-600">
								Participants
							</span>
						</div>
						<div class="flex items-baseline gap-2 whitespace-nowrap text-zinc-800">
							<b class="text-xl leading-none font-semibold text-amber-500 font-display">
								<AnimatedNumber
									value={currentReport.participantTimeline.currentActiveCount}
									duration={700}
								/>
							</b>
							<span class="text-xs uppercase tracking-widest text-zinc-600">
								Active
							</span>
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

		<section
			class="surface-card p-5 sm:p-6"
		>
			<div class="mb-4 flex flex-wrap items-end justify-between gap-4">
				<div>
					<h2 class="mt-1 mb-0 text-2xl font-display sm:text-3xl">
						{currentReport.messageBuckets.title}
					</h2>
				</div>
				<div
					class="inline-flex rounded-full border border-teal-700/12 bg-slate-900/5 p-1"
					aria-label="Message period selector"
				>
					<button
						aria-pressed={selectedPeriod === 'week'}
						class={`${periodButtonBaseClass} ${selectedPeriod === 'week' ? 'bg-teal-700 text-white shadow-lg' : 'text-zinc-700 hover:text-zinc-900'}`}
						type="button"
						onclick={() => selectPeriod('week')}
					>
						Weeks
					</button>
					<button
						aria-pressed={selectedPeriod === 'day'}
						class={`${periodButtonBaseClass} ${selectedPeriod === 'day' ? 'bg-teal-700 text-white shadow-lg' : 'text-zinc-700 hover:text-zinc-900'}`}
						type="button"
						onclick={() => selectPeriod('day')}
					>
						Days
					</button>
				</div>
			</div>

			<div class="min-h-88 h-80 sm:h-96 lg:h-136">
				{#if currentReport.messageBuckets.labels.length > 0}
					<canvas
						bind:this={canvas}
						class="h-full w-full"
						aria-label={`${currentReport.messageBuckets.title} bar chart`}
					></canvas>
				{:else}
					<p
						class="grid h-full place-items-center rounded-2xl border border-dashed border-teal-700/20 bg-white/40 p-6 text-center text-base text-zinc-600"
					>
						Not enough complete periods to draw this chart yet.
					</p>
				{/if}
			</div>
		</section>
	</div>
</div>
