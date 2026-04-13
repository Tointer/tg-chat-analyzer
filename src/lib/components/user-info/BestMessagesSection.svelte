<script lang="ts">
	import type { UserInfoCardItem } from './UserInfoSection.types';

	type Props = {
		users: UserInfoCardItem[];
	};

	type BestMessageKind = 'reactions' | 'replies';

	let { users }: Props = $props();
	const countFormatter = new Intl.NumberFormat('en-US');
	const timestampFormatter = new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium',
		timeStyle: 'short',
		hour12: false
	});
	let selectedMessageKey = $state<string | null>(null);

	function compareByReactions(
		left: UserInfoCardItem['bestMessages']['mostReactions'][number],
		right: UserInfoCardItem['bestMessages']['mostReactions'][number]
	) {
		if (right.reactionCount !== left.reactionCount) {
			return right.reactionCount - left.reactionCount;
		}

		if (right.replyCount !== left.replyCount) {
			return right.replyCount - left.replyCount;
		}

		if (right.timestamp !== left.timestamp) {
			return right.timestamp - left.timestamp;
		}

		return left.messageId - right.messageId;
	}

	function compareByReplies(
		left: UserInfoCardItem['bestMessages']['mostReplies'][number],
		right: UserInfoCardItem['bestMessages']['mostReplies'][number]
	) {
		if (right.replyCount !== left.replyCount) {
			return right.replyCount - left.replyCount;
		}

		if (right.reactionCount !== left.reactionCount) {
			return right.reactionCount - left.reactionCount;
		}

		if (right.timestamp !== left.timestamp) {
			return right.timestamp - left.timestamp;
		}

		return left.messageId - right.messageId;
	}

	function getMessages(kind: BestMessageKind) {
		const allMessages = users.flatMap((user) =>
			kind === 'reactions' ? user.bestMessages.mostReactions : user.bestMessages.mostReplies
		);

		return [...allMessages]
			.sort(kind === 'reactions' ? compareByReactions : compareByReplies)
			.slice(0, 10);
	}

	function toggleMessageSelection(messageKey: string) {
		selectedMessageKey = selectedMessageKey === messageKey ? null : messageKey;
	}

</script>

	{#if users.length > 0}
		<div class="mt-8 grid items-start gap-6 lg:grid-cols-2 lg:gap-8" aria-label="Best messages">
			{#each [
					{ key: 'reactions', title: 'Most reactions' },
					{ key: 'replies', title: 'Most replies' }
			] as column (column.key)}
					<section>
						<h3 class="mb-5 text-center text-xl font-display text-app-text sm:text-2xl">{column.title}</h3>

					{#if getMessages(column.key as BestMessageKind).length > 0}
						<div class="space-y-3">
							{#each getMessages(column.key as BestMessageKind) as message, index (message.messageId)}
								{@const messageKey = `${column.key}-${message.messageId}`}
								{@const isSelected = selectedMessageKey === messageKey}
								<button
									type="button"
									class={`group relative block w-full overflow-hidden rounded-2xl border bg-app-surface px-4 py-4 text-left shadow-sm transition duration-300 ease-out hover:-translate-y-1 hover:shadow-app-card ${
										isSelected
											? 'border-app-accent/55 ring-1 ring-app-accent/35'
											: 'border-app-border hover:border-app-accent/45'
									}`}
									onclick={() => toggleMessageSelection(messageKey)}
									aria-pressed={isSelected}
								>
									<div class={`pointer-events-none absolute inset-0 bg-linear-to-r from-app-accent/10 via-transparent to-transparent transition duration-300 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></div>
									<div class="relative flex items-start gap-4">
										<div class={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-base font-display transition duration-300 ${isSelected ? 'bg-app-accent text-app-accent-contrast' : 'bg-app-surface-strong text-app-text group-hover:scale-110 group-hover:bg-app-accent group-hover:text-app-accent-contrast'}`}>
											{index + 1}
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
											<p class={`mt-2 text-sm font-semibold leading-6 text-app-text sm:text-base ${isSelected ? '' : 'message-preview'}`}>
												{message.preview}
											</p>
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
							{/each}
						</div>
					{:else}
						<p class="grid min-h-56 place-items-center rounded-2xl border border-dashed border-app-border bg-app-empty p-6 text-center text-base text-app-muted">
							No messages have enough {column.key} yet.
						</p>
					{/if}
				</section>
			{/each}
	</div>
{:else}
	<p class="mt-8 grid min-h-56 place-items-center rounded-2xl border border-dashed border-app-border bg-app-empty p-6 text-center text-base text-app-muted">
		No users found in this chat history.
	</p>
{/if}

<style>
	.message-preview {
		display: -webkit-box;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 4;
		overflow: hidden;
	}
</style>