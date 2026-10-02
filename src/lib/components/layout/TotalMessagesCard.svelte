<script lang="ts">
	import AnimatedNumber from '../charts/AnimatedNumber.svelte';
	import type { TelegramAnalysisReport } from '$lib/analyzers/telegram-analysis';

	type Props = {
		report: TelegramAnalysisReport;
	};

	let { report }: Props = $props();

	function formatDuration(durationMs: number | null): string {
		if (durationMs === null) {
			return 'N/A';
		}

		const totalMinutes = Math.max(0, Math.floor(durationMs / (60 * 1000)));
		const totalHours = Math.floor(totalMinutes / 60);
		const days = Math.floor(totalHours / 24);
		const hours = totalHours % 24;
		const minutes = totalMinutes % 60;

		if (days > 0) {
			return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
		}

		if (totalHours > 0) {
			return minutes > 0 ? `${totalHours}h ${minutes}m` : `${totalHours}h`;
		}

		return `${Math.max(1, totalMinutes)}m`;
	}

	const summaryItems = $derived([
		{ label: 'messages with media', value: report.totalMediaMessages, animated: true },
		{ label: 'people chatted', value: report.peopleChatted, animated: true },
		{ label: 'time elapsed', value: formatDuration(report.messageSpan.durationMs), animated: false },
		{ label: 'reactions', value: report.totalReactions, animated: true }
	]);
</script>

<article class="surface-card p-5 sm:p-6">
	<div class="flex items-end gap-2 pb-3 sm:gap-3">
		<strong class="block text-3xl leading-none font-display sm:text-4xl">
			<AnimatedNumber value={report.totalMessages} />
		</strong>
		<p class="m-0 text-sm uppercase tracking-widest text-app-accent sm:text-base">Total messages</p>
	</div>
	<p class="m-0 text-sm text-app-muted"><AnimatedNumber value={report.rawMessageCount} /> raw messages</p>
	<div class="mt-3 grid grid-cols-2 gap-3 text-app-muted">
		{#each summaryItems as item (item.label)}
			<div class="rounded-2xl  bg-app-surface-alt px-3 py-3 sm:px-4 sm:py-4">
				<b class="block text-xl leading-none font-semibold text-app-text font-display sm:text-xl lg:text-2xl">
					{#if item.animated}
						<AnimatedNumber value={item.value as number} duration={700} />
					{:else}
						{item.value}
					{/if}
				</b>
				<span class="mt-2 block text-xs leading-snug text-app-subtle sm:text-sm">
					{item.label}
				</span>
			</div>
		{/each}
	</div>
</article>
