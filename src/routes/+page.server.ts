import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildTelegramAnalyticsIndex } from '$lib/analyzers/telegram-analytics-index';
import {
	analyzeTelegramAnalyticsIndex,
	type AverageMessagePatternChart,
	type MessageBucketsChart,
	type TelegramExport
} from '$lib/analyzers/telegram-analysis';
import { getTelegramUserAverageMessagePattern } from '$lib/analyzers/telegram-user-average-message-pattern';
import { getTelegramUserBestMessagesById } from '$lib/analyzers/telegram-user-best-messages';
import { getTelegramUserMediaBuckets, getTelegramUserMetricBuckets } from '$lib/analyzers/telegram-user-message-buckets';
import { getTelegramUserReplyFavoritesSummary } from '$lib/analyzers/telegram-user-reply-favorites';
import { getTelegramUserStats } from '$lib/analyzers/telegram-user-stats';
import type { TimeBucketSpec, TimeRangeSpec } from '$lib/analyzers/telegram-analysis';
import type { PageServerLoad } from './$types';

type UserMetricKey = 'messages' | 'characters' | 'media';

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

type UserInfoCardItem = {
	userId: string;
	userName: string;
	metrics: Record<
		UserMetricKey,
		{
			label: string;
			totalValue: number;
			messageBucketsByPeriod: Record<'day' | 'week', MessageBucketsChart>;
		}
	>;
	averageMessages: {
		label: string;
		leaderboardValue: number;
		leaderboardValueLabel: string;
		chartsByPeriod: Record<'day' | 'week', AverageMessagePatternChart>;
	};
	favorites: {
		label: string;
		leaderboardValue: number;
		leaderboardValueLabel: string;
		entries: Array<{
			targetUserId: string;
			targetUserName: string;
			observedReplies: number;
			expectedReplies: number;
			residual: number;
			favoriteScore: number;
			overlapMessageCount: number;
			overlapTargetMessageCount: number;
			overlapReplyCount: number;
		}>;
	};
	bestMessages: {
		mostReactions: Array<{
			messageId: number;
			authorName: string;
			forwardedFrom: string | null;
			timestamp: number;
			preview: string;
			reactionCount: number;
			replyCount: number;
		}>;
		mostReplies: Array<{
			messageId: number;
			authorName: string;
			forwardedFrom: string | null;
			timestamp: number;
			preview: string;
			reactionCount: number;
			replyCount: number;
		}>;
	};
};

export const load: PageServerLoad = async ({ url }) => {
	const filePath = resolve('src', 'messages', 'result.json');
	const rawExport = await readFile(filePath, 'utf-8');
	const telegramExport = JSON.parse(rawExport) as TelegramExport;
	const analyticsIndex = buildTelegramAnalyticsIndex(telegramExport);
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
	const requestedPeriod = url.searchParams.get('period');
	const selectedPeriod = requestedPeriod === 'day' ? 'day' : 'week';

	return {
		selectedPeriod,
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
};