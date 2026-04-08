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
		(sum, entry) => sum + entry.textCount + entry.mediaOnlyCount,
		0
	);
	const textMessages = aggregatedMessageBuckets.reduce((sum, entry) => sum + entry.textCount, 0);
	const mediaOnlyMessages = aggregatedMessageBuckets.reduce(
		(sum, entry) => sum + entry.mediaOnlyCount,
		0
	);
	const busiestBucket = visibleMessageBuckets.reduce(
		(current, entry) =>
			entry.textCount + entry.mediaOnlyCount > current.textCount + current.mediaOnlyCount
				? entry
				: current,
		visibleMessageBuckets[0] ?? {
			label: 'N/A',
			tooltipLabel: 'N/A',
			start: 'N/A',
			end: 'N/A',
			textCount: 0,
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
			textValues: visibleMessageBuckets.map((entry) => entry.textCount),
			mediaOnlyValues: visibleMessageBuckets.map((entry) => entry.mediaOnlyCount)
		},
		totalMessages,
		textMessages,
		mediaOnlyMessages,
		bucketCount: visibleMessageBuckets.length,
		busiestBucket: {
			label: busiestBucket.label,
			tooltipLabel: busiestBucket.tooltipLabel,
			count: busiestBucket.textCount + busiestBucket.mediaOnlyCount
		},
		range: {
			start: visibleMessageBuckets[0]?.start ?? 'N/A',
			end: visibleMessageBuckets.at(-1)?.end ?? 'N/A'
		}
	};
}