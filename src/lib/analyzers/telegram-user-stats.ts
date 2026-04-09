import type { AnalyticsIndex } from './telegram-analytics-index';
import type { MediaMessageGroup, MessageClassification } from './telegram-analysis-types';

export type TelegramUserStats = {
	userId: string;
	userName: string;
	totalMessages: number;
	totalMediaMessages: number;
	imageMessages: number;
	videoMessages: number;
	gifMessages: number;
	stickerMessages: number;
	otherMessages: number;
	lowInfoMessages: number;
	mediaOnlyMessages: number;
	activeDayCount: number;
	firstMessageTimestamp: number | null;
	lastMessageTimestamp: number | null;
	totalTextLength: number;
	averageTextLength: number;
	repliesSent: number;
	repliesReceived: number;
	averageReplyLatencyMs: number | null;
};

const userStatsCache = new WeakMap<AnalyticsIndex, TelegramUserStats[]>();

function createClassificationCounts() {
	return {
		other: 0,
		'low-info': 0,
		'media-only': 0,
		ignore: 0
	} satisfies Record<MessageClassification, number>;
}

function createMediaGroupCounts() {
	return {
		image: 0,
		video: 0,
		gif: 0,
		sticker: 0
	} satisfies Record<MediaMessageGroup, number>;
}

export function getTelegramUserStats(index: AnalyticsIndex): TelegramUserStats[] {
	const cachedStats = userStatsCache.get(index);

	if (cachedStats) {
		return cachedStats;
	}

	const replySentStats = new Map<string, { count: number; totalLatencyMs: number; latencyCount: number }>();
	const repliesReceivedCounts = new Map<string, number>();

	for (const edge of index.replyEdges) {
		const currentReplyStats = replySentStats.get(edge.fromUserId) ?? {
			count: 0,
			totalLatencyMs: 0,
			latencyCount: 0
		};

		replySentStats.set(edge.fromUserId, {
			count: currentReplyStats.count + edge.count,
			totalLatencyMs: currentReplyStats.totalLatencyMs + edge.totalReplyLatencyMs,
			latencyCount: currentReplyStats.latencyCount + edge.replyLatencyCount
		});
		repliesReceivedCounts.set(
			edge.toUserId,
			(repliesReceivedCounts.get(edge.toUserId) ?? 0) + edge.count
		);
	}

	const stats = [...index.messagesByUserId.entries()]
		.map(([userId, messages]) => {
			const classificationCounts = createClassificationCounts();
			const mediaGroupCounts = createMediaGroupCounts();
			const dayLabels = new Set<string>();
			let resolvedUserName = userId;
			let totalTextLength = 0;

			for (const message of messages) {
				classificationCounts[message.classification] += 1;
				if (message.mediaGroup) {
					mediaGroupCounts[message.mediaGroup] += 1;
				}
				dayLabels.add(message.dayLabel);
				totalTextLength += message.textLength;

				if (message.senderName) {
					resolvedUserName = message.senderName;
				}
			}

			const replyStats = replySentStats.get(userId);
			const totalMessages =
				classificationCounts.other +
				classificationCounts['low-info'] +
				classificationCounts['media-only'];
			const totalMediaMessages =
				mediaGroupCounts.image +
				mediaGroupCounts.video +
				mediaGroupCounts.gif +
				mediaGroupCounts.sticker;

			return {
				userId,
				userName: resolvedUserName,
				totalMessages,
				totalMediaMessages,
				imageMessages: mediaGroupCounts.image,
				videoMessages: mediaGroupCounts.video,
				gifMessages: mediaGroupCounts.gif,
				stickerMessages: mediaGroupCounts.sticker,
				otherMessages: classificationCounts.other,
				lowInfoMessages: classificationCounts['low-info'],
				mediaOnlyMessages: classificationCounts['media-only'],
				activeDayCount: dayLabels.size,
				firstMessageTimestamp: messages[0]?.timestamp ?? null,
				lastMessageTimestamp: messages.at(-1)?.timestamp ?? null,
				totalTextLength,
				averageTextLength: totalMessages > 0 ? totalTextLength / totalMessages : 0,
				repliesSent: replyStats?.count ?? 0,
				repliesReceived: repliesReceivedCounts.get(userId) ?? 0,
				averageReplyLatencyMs:
					replyStats && replyStats.latencyCount > 0
						? replyStats.totalLatencyMs / replyStats.latencyCount
						: null
			};
		})
		.sort((left, right) => {
			if (right.totalMessages !== left.totalMessages) {
				return right.totalMessages - left.totalMessages;
			}

			if ((right.lastMessageTimestamp ?? 0) !== (left.lastMessageTimestamp ?? 0)) {
				return (right.lastMessageTimestamp ?? 0) - (left.lastMessageTimestamp ?? 0);
			}

			return left.userName.localeCompare(right.userName);
		});

	userStatsCache.set(index, stats);
	return stats;
}

export function getTelegramUserStatsById(index: AnalyticsIndex, userId: string) {
	return getTelegramUserStats(index).find((entry) => entry.userId === userId);
}