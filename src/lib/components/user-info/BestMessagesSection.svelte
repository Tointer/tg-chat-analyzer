<script lang="ts">
	import BestMessageCard from './BestMessageCard.svelte';
	import type { UserInfoCardItem } from './UserInfoSection.types';

	type Props = {
		users: UserInfoCardItem[];
	};

	type BestMessageKind = 'reactions' | 'replies';

	let { users }: Props = $props();
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

	const mostReactions = $derived(getMessages('reactions'));
	const mostReplies = $derived(getMessages('replies'));

	function toggleMessageSelection(messageKey: string) {
		selectedMessageKey = selectedMessageKey === messageKey ? null : messageKey;
	}

</script>

	{#if users.length > 0}
		<div class="mt-8 grid items-start gap-6 lg:grid-cols-2 lg:gap-8" aria-label="Best messages">
			{#each [
					{ key: 'reactions', title: 'Most reactions', messages: mostReactions },
					{ key: 'replies', title: 'Most replies', messages: mostReplies }
			] as column (column.key)}
					<section>
						<h3 class="mb-5 text-center text-xl font-display text-app-text sm:text-2xl">{column.title}</h3>

					{#if column.messages.length > 0}
						<div class="space-y-3">
							{#each column.messages as message, index (message.messageId)}
								{@const messageKey = `${column.key}-${message.messageId}`}
								{@const isSelected = selectedMessageKey === messageKey}
								<BestMessageCard
									message={message}
									rank={index + 1}
									selected={isSelected}
									onToggle={() => toggleMessageSelection(messageKey)}
								/>
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
