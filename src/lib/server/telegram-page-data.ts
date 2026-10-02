import { exportLibrary } from './export-library';
import { createFileCache } from './file-cache';
import type { UserInfoCardItem } from '../components/user-info/UserInfoSection.types';
import { buildTelegramAnalyticsIndex } from '../analyzers/telegram-analytics-index';
import {
	analyzeTelegramAnalyticsIndex,
	type TelegramExport
} from '../analyzers/telegram-analysis';
import { getTelegramUserAverageMessagePattern } from '../analyzers/telegram-user-average-message-pattern';
import { getTelegramUserBestMessagesById } from '../analyzers/telegram-user-best-messages';
import { getTelegramUserMediaBuckets, getTelegramUserMetricBuckets } from '../analyzers/telegram-user-message-buckets';
import { getTelegramUserReplyFavoritesSummary } from '../analyzers/telegram-user-reply-favorites';
import { getTelegramUserStats } from '../analyzers/telegram-user-stats';
import type { TimeBucketSpec, TimeRangeSpec } from '../analyzers/telegram-analysis';
import type { MessageCountingMode } from '../analyzers/telegram-analysis-types';
import { DEFAULT_MESSAGE_COUNTING } from '../analyzers/telegram-analysis-config';

const MESSAGE_BUCKETS: Record<'day' | 'week', TimeBucketSpec> = {
	day: {
		unit: 'day',
		size: 1
	},
	week: {
		unit: 'week',
		size: 1
	}
};

export function prepareTelegramPageData(telegramExport: TelegramExport, messageCounting: MessageCountingMode = DEFAULT_MESSAGE_COUNTING) {
	const analyticsIndex = buildTelegramAnalyticsIndex(telegramExport, { messageCounting });
	const fullHistoryRange: TimeRangeSpec = {
		startTimestamp: analyticsIndex.stats.dateRange.start ?? undefined,
		endTimestamp: analyticsIndex.stats.dateRange.end ?? undefined
	};
	const userInfoCards: UserInfoCardItem[] = getTelegramUserStats(analyticsIndex).map((user) => {
		const favoriteSummary = getTelegramUserReplyFavoritesSummary(analyticsIndex, user.userId);
		const bestMessagesSummary = getTelegramUserBestMessagesById(analyticsIndex, user.userId);

		return {
			userId: user.userId,
			userName: user.userName,
			metrics: {
				messages: {
					label: 'Message count',
					totalValue: user.totalMessages,
					messageBucketsByPeriod: {
						day: getTelegramUserMetricBuckets(
							analyticsIndex,
							user.userId,
							MESSAGE_BUCKETS.day,
							fullHistoryRange,
							'messages'
						),
						week: getTelegramUserMetricBuckets(
							analyticsIndex,
							user.userId,
							MESSAGE_BUCKETS.week,
							fullHistoryRange,
							'messages'
						)
					}
				},
				characters: {
					label: 'Characters count',
					totalValue: user.totalTextLength,
					messageBucketsByPeriod: {
						day: getTelegramUserMetricBuckets(
							analyticsIndex,
							user.userId,
							MESSAGE_BUCKETS.day,
							fullHistoryRange,
							'characters'
						),
						week: getTelegramUserMetricBuckets(
							analyticsIndex,
							user.userId,
							MESSAGE_BUCKETS.week,
							fullHistoryRange,
							'characters'
						)
					}
				},
				media: {
					label: 'Media sent',
					totalValue: user.totalMediaMessages,
					messageBucketsByPeriod: {
						day: getTelegramUserMediaBuckets(
							analyticsIndex,
							user.userId,
							MESSAGE_BUCKETS.day,
							fullHistoryRange
						),
						week: getTelegramUserMediaBuckets(
							analyticsIndex,
							user.userId,
							MESSAGE_BUCKETS.week,
							fullHistoryRange
						)
					}
				}
			},
			averageMessages: {
				label: 'Average messages',
				leaderboardValue:
					user.activeDayCount > 0 ? user.totalMessages / user.activeDayCount : 0,
				leaderboardValueLabel: 'Avg per active day',
				chartsByPeriod: {
					day: getTelegramUserAverageMessagePattern(analyticsIndex, user.userId, 'day'),
					week: getTelegramUserAverageMessagePattern(analyticsIndex, user.userId, 'week')
				}
			},
			favorites: {
				label: 'Reply peers',
				leaderboardValue: favoriteSummary.repliesSent,
				leaderboardValueLabel: 'Replies sent',
				entries: favoriteSummary.favorites
			},
			bestMessages: {
				mostReactions: bestMessagesSummary?.mostReactions ?? [],
				mostReplies: bestMessagesSummary?.mostReplies ?? []
			}
		};
	});

	return {
		userInfoCards,
		periodReports: {
			day: analyzeTelegramAnalyticsIndex(analyticsIndex, {
				messageBuckets: MESSAGE_BUCKETS.day,
				timeRange: fullHistoryRange
			}),
			week: analyzeTelegramAnalyticsIndex(analyticsIndex, {
				messageBuckets: MESSAGE_BUCKETS.week,
				timeRange: fullHistoryRange
			})
		}
	};
}

let activeCache: { path: string; messageCounting: MessageCountingMode; get: ReturnType<typeof createFileCache<ReturnType<typeof prepareTelegramPageData>>> } | undefined;

export async function getTelegramPageData(override?: MessageCountingMode) {
	const selection = await exportLibrary.activeSelection();
	const { path } = selection;
	const messageCounting = override ?? selection.messageCounting;
	if (!activeCache || activeCache.path !== path || activeCache.messageCounting !== messageCounting) {
		activeCache = { path, messageCounting, get: createFileCache(path, (raw) => {
			const parsed: unknown = JSON.parse(raw);
			if (!parsed || typeof parsed !== 'object' || !('messages' in parsed) || !Array.isArray(parsed.messages)) {
				throw new Error('Expected a Telegram chat export with a messages array.');
			}
			return prepareTelegramPageData(parsed as TelegramExport, messageCounting);
		}) };
	}
	return activeCache.get();
}
