import { buildTelegramAnalyticsIndex, type AnalyticsIndex } from './telegram-analytics-index';
import { aggregateParticipantTimeline } from './telegram-group-analyzer';
import {
	getTimeBucketGroupingLabel,
	getTimeBucketTitle,
	normalizeTimeBucket
} from './telegram-analysis-shared';
import { aggregateMessagesByTimeBucket, classifyTelegramMessage } from './telegram-text-analyzer';
import type {
	MessageBucketsChart,
	TelegramAnalysisOptions,
	TelegramAnalysisReport,
	TelegramExport
} from './telegram-analysis-types';

export { classifyTelegramMessage };
export type {
	MessageBucketValueMetric,
	MessageBucketsChart,
	MessageClassification,
	TimeRangeSpec,
	TimeBucketSpec,
	TelegramAnalysisOptions,
	TelegramAnalysisReport,
	TelegramExport,
	TelegramExportMessage,
	TelegramTextEntity,
	TelegramTextPart
} from './telegram-analysis-types';

export function analyzeTelegramExport(
	telegramExport: TelegramExport,
	options: TelegramAnalysisOptions = {}
): TelegramAnalysisReport {
	return analyzeTelegramAnalyticsIndex(buildTelegramAnalyticsIndex(telegramExport), options);
}

export function analyzeTelegramAnalyticsIndex(
	index: AnalyticsIndex,
	options: TelegramAnalysisOptions = {}
): TelegramAnalysisReport {
	const participantTimeline = aggregateParticipantTimeline(index);
	const messageBuckets = buildMessageBucketsChart(index, options);
	const visibleMessageBuckets = messageBuckets.labels.map((label, dataIndex) => ({
		label,
		tooltipLabel: messageBuckets.tooltipLabels[dataIndex] ?? label,
		otherCount: messageBuckets.otherValues[dataIndex] ?? 0,
		lowInfoCount: messageBuckets.lowInfoValues[dataIndex] ?? 0,
		mediaOnlyCount: messageBuckets.mediaOnlyValues[dataIndex] ?? 0
	}));
	const aggregatedMessageBuckets = aggregateMessagesByTimeBucket(
		index,
		options.messageBuckets,
		options.timeRange
	);
	const totalMessages = aggregatedMessageBuckets.reduce(
		(sum, entry) => sum + entry.otherCount + entry.lowInfoCount + entry.mediaOnlyCount,
		0
	);
	const otherMessages = aggregatedMessageBuckets.reduce((sum, entry) => sum + entry.otherCount, 0);
	const lowInfoMessages = aggregatedMessageBuckets.reduce((sum, entry) => sum + entry.lowInfoCount, 0);
	const mediaOnlyMessages = aggregatedMessageBuckets.reduce(
		(sum, entry) => sum + entry.mediaOnlyCount,
		0
	);
	const busiestBucket = visibleMessageBuckets.reduce(
		(current, entry) =>
			entry.otherCount + entry.lowInfoCount + entry.mediaOnlyCount >
			current.otherCount + current.lowInfoCount + current.mediaOnlyCount
				? entry
				: current,
		visibleMessageBuckets[0] ?? {
			label: 'N/A',
			tooltipLabel: 'N/A',
			otherCount: 0,
			lowInfoCount: 0,
			mediaOnlyCount: 0
		}
	);

	return {
		chatName: index.chatName,
		participantTimeline,
		messageBuckets,
		totalMessages,
		otherMessages,
		lowInfoMessages,
		mediaOnlyMessages,
		bucketCount: visibleMessageBuckets.length,
		busiestBucket: {
			label: busiestBucket.label,
			tooltipLabel: busiestBucket.tooltipLabel,
			count: busiestBucket.otherCount + busiestBucket.lowInfoCount + busiestBucket.mediaOnlyCount
		},
		range: {
			start: aggregatedMessageBuckets[0]?.start ?? 'N/A',
			end: aggregatedMessageBuckets.at(-1)?.end ?? 'N/A'
		}
	};
}

export function buildMessageBucketsChart(
	index: AnalyticsIndex,
	options: TelegramAnalysisOptions = {}
): MessageBucketsChart {
	const bucket = normalizeTimeBucket(options.messageBuckets);
	const aggregatedMessageBuckets = aggregateMessagesByTimeBucket(
		index,
		bucket,
		options.timeRange
	);
	const visibleMessageBuckets = aggregatedMessageBuckets;

	return {
		bucket,
		title: getTimeBucketTitle(bucket),
		groupingLabel: getTimeBucketGroupingLabel(bucket),
		trimmedEdgeBucketCount: 0,
		labels: visibleMessageBuckets.map((entry) => entry.label),
		tooltipLabels: visibleMessageBuckets.map((entry) => entry.tooltipLabel),
		otherValues: visibleMessageBuckets.map((entry) => entry.otherCount),
		lowInfoValues: visibleMessageBuckets.map((entry) => entry.lowInfoCount),
		mediaOnlyValues: visibleMessageBuckets.map((entry) => entry.mediaOnlyCount)
	};
}