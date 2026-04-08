import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildTelegramAnalyticsIndex } from '$lib/telegram-analytics-index';
import {
	analyzeTelegramAnalyticsIndex,
	type MessageBucketValueMetric,
	type MessageBucketsChart,
	type TelegramExport
} from '$lib/telegram-analysis';
import { getTelegramUserMetricBuckets } from '$lib/telegram-user-message-buckets';
import { getTelegramUserStats } from '$lib/telegram-user-stats';
import type { TimeBucketSpec, TimeRangeSpec } from '$lib/telegram-analysis';
import type { PageServerLoad } from './$types';

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
		MessageBucketValueMetric,
		{
			label: string;
			totalValue: number;
			messageBucketsByPeriod: Record<'day' | 'week', MessageBucketsChart>;
		}
	>;
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
	const userInfoCards: UserInfoCardItem[] = getTelegramUserStats(analyticsIndex).map((user) => ({
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
			}
		}
	}));
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