import { buildTelegramAnalyticsIndex, type AnalyticsIndex } from './telegram-analytics-index';
import { aggregateParticipantTimeline } from './telegram-group-analyzer';
import {
	getTimeBucketGroupingLabel,
	getTimeBucketTitle,
	normalizeTimeBucket
} from './telegram-analysis-shared';
import {
	aggregateMessagesByTimeBucket,
	classifyTelegramMediaGroup,
	classifyTelegramMessage
} from './telegram-text-analyzer';
import { getTelegramReactionStatsSummary } from './telegram-reaction-stats';
import type {
	MessageBucketsChart,
	MessageBucketsChartSeries,
	TelegramAnalysisOptions,
	TelegramAnalysisReport,
	TelegramExport
} from './telegram-analysis-types';

export { classifyTelegramMediaGroup, classifyTelegramMessage };
export type {
	AverageMessagePatternChart,
	AverageMessagePatternMode,
	ChartSeriesColorKey,
	MediaMessageGroup,
	MessageBucketValueMetric,
	MessageBucketsChart,
	MessageBucketsChartSeries,
	MessageClassification,
	MessageCountingMode,
	TimeRangeSpec,
	TimeBucketSpec,
	TelegramAnalysisOptions,
	TelegramAnalysisReport,
	TelegramExport,
	TelegramExportMessage,
	TelegramTextEntity,
	TelegramTextPart,
	TelegramReaction,
	TelegramReactionRecent
} from './telegram-analysis-types';

export function analyzeTelegramExport(
	telegramExport: TelegramExport,
	options: TelegramAnalysisOptions = {}
): TelegramAnalysisReport {
	return analyzeTelegramAnalyticsIndex(buildTelegramAnalyticsIndex(telegramExport, options), options);
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
	const reactionSummary = getTelegramReactionStatsSummary(index);
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
		rawMessageCount: index.stats.rawMessageCount,
		messageCounting: index.messageCounting,
		totalMediaMessages: index.stats.totalMediaMessages,
		peopleChatted: index.stats.peopleChatted,
		totalReactions: reactionSummary.totalReactions,
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
		},
		messageSpan: {
			startTimestamp: index.stats.dateRange.start,
			endTimestamp: index.stats.dateRange.end,
			durationMs:
				index.stats.dateRange.start !== null && index.stats.dateRange.end !== null
					? Math.max(0, index.stats.dateRange.end - index.stats.dateRange.start)
					: null
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
	const replyValues = visibleMessageBuckets.map((entry) => entry.replyCount);
	const nonReplyValues = visibleMessageBuckets.map((entry) => entry.nonReplyCount);
	const series: MessageBucketsChartSeries[] = [
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

	return {
		bucket,
		title: getTimeBucketTitle(bucket),
		groupingLabel: getTimeBucketGroupingLabel(bucket),
		trimmedEdgeBucketCount: 0,
		labels: visibleMessageBuckets.map((entry) => entry.label),
		tooltipLabels: visibleMessageBuckets.map((entry) => entry.tooltipLabel),
		series,
		replyValues,
		nonReplyValues
	};
}
