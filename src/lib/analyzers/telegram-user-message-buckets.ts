import type { AnalyticsIndex, NormalizedTelegramMessage } from './telegram-analytics-index';
import {
	addTimeBucket,
	getTimeBucketGroupingLabel,
	getTimeBucketMetricTitle,
	getTimeBucketTitle,
	getTimeBucketAxisLabel,
	getTimeBucketDateRange,
	getTimeBucketStart,
	getTimeBucketTooltipLabel,
	normalizeTimeRange,
	normalizeTimeBucket
} from './telegram-analysis-shared';
import { aggregateNormalizedMessagesByTimeBucket } from './telegram-text-analyzer';
import type {
	MediaMessageGroup,
	MessageBucketsChart,
	MessageBucketsChartSeries,
	MessageBucketValueMetric,
	TimeRangeSpec,
	TimeBucketSpec
} from './telegram-analysis-types';

const userMessageBucketsCache = new WeakMap<
	AnalyticsIndex,
	Map<string, MessageBucketsChart>
>();

const MEDIA_GROUPS: Array<{ key: MediaMessageGroup; label: string }> = [
	{ key: 'image', label: 'Images' },
	{ key: 'video', label: 'Videos' },
	{ key: 'gif', label: 'GIFs' },
	{ key: 'sticker', label: 'Stickers' },
	{ key: 'audio', label: 'Audio' },
	{ key: 'document', label: 'Documents' }
];

function createBucketCacheKey(
	userId: string,
	unit: string,
	size: number,
	metric: MessageBucketValueMetric | 'media',
	timeRange: { startTimestamp: number; endTimestamp: number } | null
) {
	if (!timeRange) {
		return `${userId}:${unit}:${size}:${metric}:full`;
	}

	return `${userId}:${unit}:${size}:${metric}:${timeRange.startTimestamp}:${timeRange.endTimestamp}`;
}

function createReplySplitSeries(replyValues: number[], nonReplyValues: number[]): MessageBucketsChartSeries[] {
	return [
		{
			key: 'reply',
			label: 'Replies',
			colorKey: 'reply',
			values: replyValues
		},
		{
			key: 'non-reply',
			label: 'Non-replies',
			colorKey: 'nonReply',
			values: nonReplyValues
		}
	];
}

function createEmptyMediaGroupCounts(): Record<MediaMessageGroup, number> {
	return {
		image: 0,
		video: 0,
		gif: 0,
		sticker: 0,
		audio: 0,
		document: 0
	};
}

function aggregateUserMediaMessagesByTimeBucket(
	messages: NormalizedTelegramMessage[],
	bucket?: TimeBucketSpec,
	timeRange?: TimeRangeSpec
) {
	const normalizedBucket = normalizeTimeBucket(bucket);
	const counts = new Map<string, { values: Record<MediaMessageGroup, number> }>();
	let firstBucketStart: Date | null = null;
	let lastBucketStart: Date | null = null;

	for (const message of messages) {
		if (message.classification === 'ignore' || message.mediaGroup === null) {
			continue;
		}

		const bucketStart = getTimeBucketStart(message.timestamp, normalizedBucket);
		const key = bucketStart.toISOString();

		if (firstBucketStart === null || bucketStart.getTime() < firstBucketStart.getTime()) {
			firstBucketStart = bucketStart;
		}

		if (lastBucketStart === null || bucketStart.getTime() > lastBucketStart.getTime()) {
			lastBucketStart = bucketStart;
		}

		const bucketCounts = counts.get(key) ?? { values: createEmptyMediaGroupCounts() };
		for (const group of message.mediaGroups) bucketCounts.values[group] += 1;
		counts.set(key, bucketCounts);
	}

	const fallbackRange = {
		start: firstBucketStart?.getTime() ?? null,
		end: lastBucketStart?.getTime() ?? null
	};
	const normalizedTimeRange = normalizeTimeRange(timeRange, fallbackRange);

	if (normalizedTimeRange === null) {
		return [];
	}

	const rangeStartBucket = getTimeBucketStart(normalizedTimeRange.startTimestamp, normalizedBucket);
	const rangeEndBucket = getTimeBucketStart(normalizedTimeRange.endTimestamp, normalizedBucket);
	const aggregates: Array<{
		label: string;
		tooltipLabel: string;
		values: Record<MediaMessageGroup, number>;
	}> = [];

	for (
		let bucketStart = rangeStartBucket;
		bucketStart.getTime() <= rangeEndBucket.getTime();
		bucketStart = addTimeBucket(bucketStart, normalizedBucket)
	) {
		const bucketCounts = counts.get(bucketStart.toISOString()) ?? {
			values: createEmptyMediaGroupCounts()
		};
		getTimeBucketDateRange(bucketStart, normalizedBucket);

		aggregates.push({
			label: getTimeBucketAxisLabel(bucketStart, normalizedBucket),
			tooltipLabel: getTimeBucketTooltipLabel(bucketStart, normalizedBucket),
			values: bucketCounts.values
		});
	}

	return aggregates;
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
	const replyValues = aggregatedBuckets.map((entry) => entry.replyCount);
	const nonReplyValues = aggregatedBuckets.map((entry) => entry.nonReplyCount);
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
		series: createReplySplitSeries(replyValues, nonReplyValues),
		replyValues,
		nonReplyValues
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

export function getTelegramUserMediaBuckets(
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
		'media',
		normalizedTimeRange
	);
	const cacheForIndex = userMessageBucketsCache.get(index) ?? new Map<string, MessageBucketsChart>();
	const cachedChart = cacheForIndex.get(cacheKey);

	if (cachedChart) {
		return cachedChart;
	}

	const messages = index.messagesByUserId.get(userId) ?? [];
	const aggregatedBuckets = aggregateUserMediaMessagesByTimeBucket(
		messages,
		normalizedBucket,
		normalizedTimeRange ?? undefined
	);
	const series: MessageBucketsChartSeries[] = MEDIA_GROUPS.map((group) => ({
		key: group.key,
		label: group.label,
		colorKey: group.key,
		values: aggregatedBuckets.map((entry) => entry.values[group.key])
	}));
	const chart: MessageBucketsChart = {
		bucket: normalizedBucket,
		title: `Media sent per ${getTimeBucketGroupingLabel(normalizedBucket)}`,
		groupingLabel: getTimeBucketGroupingLabel(normalizedBucket),
		trimmedEdgeBucketCount: 0,
		labels: aggregatedBuckets.map((entry) => entry.label),
		tooltipLabels: aggregatedBuckets.map((entry) => entry.tooltipLabel),
		series,
		replyValues: [],
		nonReplyValues: []
	};

	cacheForIndex.set(cacheKey, chart);
	userMessageBucketsCache.set(index, cacheForIndex);
	return chart;
}
