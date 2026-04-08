import type { AnalyticsIndex, NormalizedTelegramMessage } from './telegram-analytics-index';
import {
	getTimeBucketGroupingLabel,
	getTimeBucketMetricTitle,
	getTimeBucketTitle,
	normalizeTimeRange,
	normalizeTimeBucket
} from './telegram-analysis-shared';
import { aggregateNormalizedMessagesByTimeBucket } from './telegram-text-analyzer';
import type {
	MessageBucketsChart,
	MessageBucketValueMetric,
	TimeRangeSpec,
	TimeBucketSpec
} from './telegram-analysis-types';

const userMessageBucketsCache = new WeakMap<
	AnalyticsIndex,
	Map<string, MessageBucketsChart>
>();

function createBucketCacheKey(
	userId: string,
	unit: string,
	size: number,
	metric: MessageBucketValueMetric,
	timeRange: { startTimestamp: number; endTimestamp: number } | null
) {
	if (!timeRange) {
		return `${userId}:${unit}:${size}:${metric}:full`;
	}

	return `${userId}:${unit}:${size}:${metric}:${timeRange.startTimestamp}:${timeRange.endTimestamp}`;
}

export function getTelegramUserMetricBuckets(
	index: AnalyticsIndex,
	userId: string,
	bucket?: TimeBucketSpec,
	timeRange?: TimeRangeSpec,
	metric: MessageBucketValueMetric = 'messages'
): MessageBucketsChart {
	const normalizedBucket = normalizeTimeBucket(bucket);
	const normalizedTimeRange = normalizeTimeRange(timeRange, index.stats.dateRange);
	const cacheKey = createBucketCacheKey(
		userId,
		normalizedBucket.unit,
		normalizedBucket.size,
		metric,
		normalizedTimeRange
	);
	const cacheForIndex = userMessageBucketsCache.get(index) ?? new Map<string, MessageBucketsChart>();
	const cachedChart = cacheForIndex.get(cacheKey);

	if (cachedChart) {
		return cachedChart;
	}

	const messages = index.messagesByUserId.get(userId) ?? [];
	const aggregatedBuckets = aggregateNormalizedMessagesByTimeBucket(
		messages,
		normalizedBucket,
		normalizedTimeRange,
		metric
	);
	const chart: MessageBucketsChart = {
		bucket: normalizedBucket,
		title:
			metric === 'messages'
				? getTimeBucketTitle(normalizedBucket)
				: getTimeBucketMetricTitle(metric, normalizedBucket),
		groupingLabel: getTimeBucketGroupingLabel(normalizedBucket),
		trimmedEdgeBucketCount: 0,
		labels: aggregatedBuckets.map((entry) => entry.label),
		tooltipLabels: aggregatedBuckets.map((entry) => entry.tooltipLabel),
		replyValues: aggregatedBuckets.map((entry) => entry.replyCount),
		nonReplyValues: aggregatedBuckets.map((entry) => entry.nonReplyCount)
	};

	cacheForIndex.set(cacheKey, chart);
	userMessageBucketsCache.set(index, cacheForIndex);
	return chart;
}

export function getTelegramUserMessageBuckets(
	index: AnalyticsIndex,
	userId: string,
	bucket?: TimeBucketSpec,
	timeRange?: TimeRangeSpec
): MessageBucketsChart {
	return getTelegramUserMetricBuckets(index, userId, bucket, timeRange, 'messages');
}