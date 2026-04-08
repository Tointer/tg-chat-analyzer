import type { AnalyticsIndex } from './telegram-analytics-index';

export type TelegramReplyPairStats = {
	fromUserId: string;
	fromUserName: string;
	toUserId: string;
	toUserName: string;
	replyCount: number;
	totalReplyLatencyMs: number;
	averageReplyLatencyMs: number | null;
	firstReplyTimestamp: number;
	lastReplyTimestamp: number;
};

const replyPairStatsCache = new WeakMap<AnalyticsIndex, TelegramReplyPairStats[]>();

function resolveUserName(index: AnalyticsIndex, userId: string) {
	const messages = index.messagesByUserId.get(userId);

	for (const message of messages ?? []) {
		if (message.senderName) {
			return message.senderName;
		}
	}

	return userId;
}

export function getTelegramReplyPairStats(index: AnalyticsIndex): TelegramReplyPairStats[] {
	const cachedStats = replyPairStatsCache.get(index);

	if (cachedStats) {
		return cachedStats;
	}

	const stats = index.replyEdges
		.map((edge) => ({
			fromUserId: edge.fromUserId,
			fromUserName: resolveUserName(index, edge.fromUserId),
			toUserId: edge.toUserId,
			toUserName: resolveUserName(index, edge.toUserId),
			replyCount: edge.count,
			totalReplyLatencyMs: edge.totalReplyLatencyMs,
			averageReplyLatencyMs:
				edge.replyLatencyCount > 0 ? edge.totalReplyLatencyMs / edge.replyLatencyCount : null,
			firstReplyTimestamp: edge.firstReplyTimestamp,
			lastReplyTimestamp: edge.lastReplyTimestamp
		}))
		.sort((left, right) => {
			if (right.replyCount !== left.replyCount) {
				return right.replyCount - left.replyCount;
			}

			if (right.lastReplyTimestamp !== left.lastReplyTimestamp) {
				return right.lastReplyTimestamp - left.lastReplyTimestamp;
			}

			const fromComparison = left.fromUserName.localeCompare(right.fromUserName);

			if (fromComparison !== 0) {
				return fromComparison;
			}

			return left.toUserName.localeCompare(right.toUserName);
		});

	replyPairStatsCache.set(index, stats);
	return stats;
}

export function getTelegramReplyPairStatsByUsers(
	index: AnalyticsIndex,
	fromUserId: string,
	toUserId: string
) {
	return getTelegramReplyPairStats(index).find(
		(entry) => entry.fromUserId === fromUserId && entry.toUserId === toUserId
	);
}