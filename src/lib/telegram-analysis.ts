import { aggregateParticipantTimeline } from './telegram-group-analyzer';
import {
	getTimeBucketGroupingLabel,
	getTimeBucketTitle,
	normalizeTimeBucket
} from './telegram-analysis-shared';
import { aggregateMessagesByTimeBucket, classifyTelegramMessage } from './telegram-text-analyzer';
import type {
	TelegramAnalysisOptions,
	TelegramAnalysisReport,
	TelegramExport
} from './telegram-analysis-types';

export { classifyTelegramMessage };
export type {
	MessageClassification,
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
	const messages = telegramExport.messages ?? [];
	const participantTimeline = aggregateParticipantTimeline(messages);
	const bucket = normalizeTimeBucket(options.messageBuckets);
	const aggregatedMessageBuckets = aggregateMessagesByTimeBucket(messages, bucket);
	const visibleMessageBuckets =
		aggregatedMessageBuckets.length > 2 ? aggregatedMessageBuckets.slice(1, -1) : [];
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
			start: 'N/A',
			end: 'N/A',
			otherCount: 0,
			lowInfoCount: 0,
			mediaOnlyCount: 0
		}
	);

	return {
		chatName: telegramExport.name ?? 'Telegram Chat',
		participantTimeline,
		messageBuckets: {
			bucket,
			title: getTimeBucketTitle(bucket),
			groupingLabel: getTimeBucketGroupingLabel(bucket),
			trimmedEdgeBucketCount:
				aggregatedMessageBuckets.length >= 2 ? Math.min(2, aggregatedMessageBuckets.length) : 0,
			labels: visibleMessageBuckets.map((entry) => entry.label),
			tooltipLabels: visibleMessageBuckets.map((entry) => entry.tooltipLabel),
			otherValues: visibleMessageBuckets.map((entry) => entry.otherCount),
			lowInfoValues: visibleMessageBuckets.map((entry) => entry.lowInfoCount),
			mediaOnlyValues: visibleMessageBuckets.map((entry) => entry.mediaOnlyCount)
		},
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
			start: visibleMessageBuckets[0]?.start ?? 'N/A',
			end: visibleMessageBuckets.at(-1)?.end ?? 'N/A'
		}
	};
}