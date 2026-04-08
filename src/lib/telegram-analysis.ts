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
		replyCount: messageBuckets.replyValues[dataIndex] ?? 0,
		nonReplyCount: messageBuckets.nonReplyValues[dataIndex] ?? 0
	}));
	const aggregatedMessageBuckets = aggregateMessagesByTimeBucket(
		index,
		options.messageBuckets,
		options.timeRange
	);
	const totalMessages = aggregatedMessageBuckets.reduce(
		(sum, entry) => sum + entry.replyCount + entry.nonReplyCount,
		0
	);
	const replyMessages = aggregatedMessageBuckets.reduce((sum, entry) => sum + entry.replyCount, 0);
	const nonReplyMessages = aggregatedMessageBuckets.reduce((sum, entry) => sum + entry.nonReplyCount, 0);
	const otherMessages = index.stats.classificationCounts.other;
	const lowInfoMessages = index.stats.classificationCounts['low-info'];
	const mediaOnlyMessages = index.stats.classificationCounts['media-only'];
	const busiestBucket = visibleMessageBuckets.reduce(
		(current, entry) =>
			entry.replyCount + entry.nonReplyCount > current.replyCount + current.nonReplyCount
				? entry
				: current,
		visibleMessageBuckets[0] ?? {
			label: 'N/A',
			tooltipLabel: 'N/A',
			replyCount: 0,
			nonReplyCount: 0
		}
	);

	return {
		chatName: index.chatName,
		participantTimeline,
		messageBuckets,
		totalMessages,
		replyMessages,
		nonReplyMessages,
		otherMessages,
		lowInfoMessages,
		mediaOnlyMessages,
		bucketCount: visibleMessageBuckets.length,
		busiestBucket: {
			label: busiestBucket.label,
			tooltipLabel: busiestBucket.tooltipLabel,
			count: busiestBucket.replyCount + busiestBucket.nonReplyCount
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
		replyValues: visibleMessageBuckets.map((entry) => entry.replyCount),
		nonReplyValues: visibleMessageBuckets.map((entry) => entry.nonReplyCount)
	};
}