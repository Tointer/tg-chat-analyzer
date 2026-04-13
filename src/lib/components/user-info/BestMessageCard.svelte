<script lang="ts">
	import BestMessageRepliesList from './BestMessageRepliesList.svelte';
	import type { BestMessageEntry } from './UserInfoSection.types';

	type Props = {
		message: BestMessageEntry;
		rank: number;
		selected: boolean;
		onToggle: () => void;
	};

	let { message, rank, selected, onToggle }: Props = $props();
	const countFormatter = new Intl.NumberFormat('en-US');
	const timestampFormatter = new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium',
		timeStyle: 'short',
		hour12: false
	});
</script>

<button
	type="button"
	class={`group relative block w-full overflow-hidden rounded-2xl border bg-app-surface px-4 py-4 text-left shadow-sm transition duration-300 ease-out hover:-translate-y-1 hover:shadow-app-card ${
		selected
			? 'border-app-accent/55 ring-1 ring-app-accent/35'
			: 'border-app-border hover:border-app-accent/45'
	}`}
	onclick={() => onToggle()}
	aria-pressed={selected}
>
	<div class={`pointer-events-none absolute inset-0 bg-linear-to-r from-app-accent/10 via-transparent to-transparent transition duration-300 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
	<div class="relative flex items-start gap-4">
		<div class={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-display transition duration-300 ${selected ? 'bg-app-accent text-app-accent-contrast' : 'bg-app-surface-strong text-app-text group-hover:scale-110 group-hover:bg-app-accent group-hover:text-app-accent-contrast'}`}>
			{rank}
		</div>
		<div class="min-w-0 flex-1">
			<p class="m-0 text-[11px] font-semibold uppercase tracking-[0.24em] text-app-accent">
				{message.authorName}
			</p>
			{#if message.forwardedFrom}
				<p class="mt-1 text-xs uppercase tracking-[0.2em] text-app-subtle">
					Forwarded from {message.forwardedFrom}
				</p>
			{/if}
			<p class={`mt-2 text-sm font-semibold leading-6 text-app-text sm:text-base ${selected ? '' : 'message-preview'}`}>
				{message.preview}
			</p>
			{#if selected && message.replies.length > 0}
				<BestMessageRepliesList replies={message.replies} />
			{/if}
			<div class="mt-3 flex items-start justify-between gap-4 text-xs uppercase tracking-[0.2em] text-app-subtle">
				<div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
					<span>{countFormatter.format(message.reactionCount)} reactions</span>
					<span>{countFormatter.format(message.replyCount)} replies</span>
				</div>
				<span class="shrink-0 text-right">{timestampFormatter.format(message.timestamp)}</span>
			</div>
		</div>
	</div>
</button>

<style>
	.message-preview {
		display: -webkit-box;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 4;
		overflow: hidden;
	}
</style>