import type { AnalyticsIndex } from './telegram-analytics-index';

export type TelegramReactionStatsSummary = {
	totalReactions: number;
	messagesWithReactions: number;
	uniqueReactionEmojis: number;
	reactionsByEmoji: Array<{
		emoji: string;
		count: number;
	}>;
};

const reactionStatsCache = new WeakMap<AnalyticsIndex, TelegramReactionStatsSummary>();

export function getTelegramReactionStatsSummary(index: AnalyticsIndex): TelegramReactionStatsSummary {
	const cachedSummary = reactionStatsCache.get(index);

	if (cachedSummary) {
		return cachedSummary;
	}

	const reactionsByEmoji = new Map<string, number>();
	let messagesWithReactions = 0;

	for (const message of index.messages) {
		if (message.classification === 'ignore' || message.reactionCount === 0) {
			continue;
		}

		messagesWithReactions += 1;

		for (const reaction of message.original.reactions ?? []) {
			const emoji = reaction.emoji;
			const count = Math.max(0, reaction.count ?? 0);

			if (!emoji || count === 0) {
				continue;
			}

			reactionsByEmoji.set(emoji, (reactionsByEmoji.get(emoji) ?? 0) + count);
		}
	}

	const summary: TelegramReactionStatsSummary = {
		totalReactions: index.stats.totalReactions,
		messagesWithReactions,
		uniqueReactionEmojis: reactionsByEmoji.size,
		reactionsByEmoji: [...reactionsByEmoji.entries()]
			.map(([emoji, count]) => ({ emoji, count }))
			.sort((left, right) => right.count - left.count || left.emoji.localeCompare(right.emoji))
	};

	reactionStatsCache.set(index, summary);
	return summary;
}