import type { AnalyticsIndex, NormalizedTelegramMessage } from './telegram-analytics-index';
import {
	getTimeBucketGroupingLabel,
	getTimeBucketTitle,
	normalizeTimeRange,
	normalizeTimeBucket
} from './telegram-analysis-shared';
import { aggregateNormalizedMessagesByTimeBucket } from './telegram-text-analyzer';
import type { MessageBucketsChart, TimeRangeSpec, TimeBucketSpec } from './telegram-analysis-types';

const userMessageBucketsCache = new WeakMap<
	AnalyticsIndex,
	Map<string, MessageBucketsChart>
>();

function createBucketCacheKey(
	userId: string,
	unit: string,
	size: number,
	timeRange: { startTimestamp: number; endTimestamp: number } | null
) {
	if (!timeRange) {
		return `${userId}:${unit}:${size}:full`;
	}

	return `${userId}:${unit}:${size}:${timeRange.startTimestamp}:${timeRange.endTimestamp}`;
}

export function getTelegramUserMessageBuckets(
	index: AnalyticsIndex,
	userId: string,
	bucket?: TimeBucketSpec,
	timeRange?: TimeRangeSpec
): MessageBucketsChart {
	const normalizedBucket = normalizeTimeBucket(bucket);
	const normalizedTimeRange = normalizeTimeRange(timeRange, index.stats.dateRange);
	const cacheKey = createBucketCacheKey(
		userId,
		normalizedBucket.unit,
		normalizedBucket.size,
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
		normalizedTimeRange
	);
	const visibleBuckets = aggregatedBuckets;
	const chart: MessageBucketsChart = {
		bucket: normalizedBucket,
		title: getTimeBucketTitle(normalizedBucket),
		groupingLabel: getTimeBucketGroupingLabel(normalizedBucket),
		trimmedEdgeBucketCount: 0,
		labels: visibleBuckets.map((entry) => entry.label),
		tooltipLabels: visibleBuckets.map((entry) => entry.tooltipLabel),
		otherValues: visibleBuckets.map((entry) => entry.otherCount),
		lowInfoValues: visibleBuckets.map((entry) => entry.lowInfoCount),
		mediaOnlyValues: visibleBuckets.map((entry) => entry.mediaOnlyCount)
	};

	cacheForIndex.set(cacheKey, chart);
	userMessageBucketsCache.set(index, cacheForIndex);
	return chart;
}