import {
	getBucketAggregateCache,
	setBucketAggregateCache,
	type AnalyticsIndex
} from './telegram-analytics-index';
import {
	addTimeBucket,
	getTimeBucketAxisLabel,
	getTimeBucketDateRange,
	getMessageTimestamp,
	getTimeBucketStart,
	getTimeBucketTooltipLabel,
	normalizeTimeRange,
	normalizeTimeBucket
} from './telegram-analysis-shared';
import type {
	MediaMessageGroup,
	MessageClassification,
	MessageBucketAggregate,
	MessageBucketValueMetric,
	NormalizedTimeRange,
	TelegramExportMessage,
	TimeRangeSpec,
	TimeBucketSpec
} from './telegram-analysis-types';
import type { NormalizedTelegramMessage } from './telegram-analytics-index';

const EMOJI_TEXT_DETECTION = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
const NON_EMOJI_TEXT_REMAINDER =
	/(?:\p{White_Space}|\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Component}|\u200D|\uFE0F|\u20E3)/gu;
const WHITESPACE = /\s/u;

function extractTextContent(message: TelegramExportMessage): string {
	if (typeof message.text === 'string') {
		return message.text.trim();
	}

	if (Array.isArray(message.text)) {
		return message.text
			.map((part) => (typeof part === 'string' ? part : part.text ?? ''))
			.join('')
			.trim();
	}

	return '';
}

function isEmojiOnlyTextContent(textContent: string): boolean {
	const normalizedText = textContent.trim();

	if (!normalizedText || !EMOJI_TEXT_DETECTION.test(normalizedText)) {
		return false;
	}

	return normalizedText.replace(NON_EMOJI_TEXT_REMAINDER, '').length === 0;
}

function isEmojiOnlyMessage(message: TelegramExportMessage, textContent: string): boolean {
	if (!isEmojiOnlyTextContent(textContent)) {
		return false;
	}

	if (!Array.isArray(message.text)) {
		return true;
	}

	return message.text.every((part) => {
		if (typeof part === 'string') {
			return part.trim().length === 0 || isEmojiOnlyTextContent(part);
		}

		const partText = part.text ?? '';
		return (
			['custom_emoji', 'emoji', 'plain', undefined].includes(part.type) &&
			(partText.trim().length === 0 || isEmojiOnlyTextContent(partText))
		);
	});
}

function isSupportedMediaOnlyMessage(message: TelegramExportMessage): boolean {
	return classifyTelegramMediaGroup(message) !== null;
}

function isStickerOnlyMessage(message: TelegramExportMessage): boolean {
	if (message.sticker_emoji) {
		return true;
	}

	return message.media_type?.toLowerCase() === 'sticker';
}

function isStickerMessage(message: TelegramExportMessage): boolean {
	return isStickerOnlyMessage(message);
}

function isGifMessage(message: TelegramExportMessage): boolean {
	const mediaType = message.media_type?.toLowerCase();
	const mimeType = message.mime_type?.toLowerCase();
	const fileName = message.file?.toLowerCase();

	return mediaType === 'animation' || mimeType === 'image/gif' || fileName?.endsWith('.gif') === true;
}

function isVideoMessage(message: TelegramExportMessage): boolean {
	const mediaType = message.media_type?.toLowerCase();
	const mimeType = message.mime_type?.toLowerCase();

	if (isGifMessage(message) || isStickerMessage(message)) {
		return false;
	}

	return ['video', 'video_file', 'video_message'].includes(mediaType ?? '') ||
		mimeType?.startsWith('video/') === true;
}

function isImageMessage(message: TelegramExportMessage): boolean {
	const mediaType = message.media_type?.toLowerCase();
	const mimeType = message.mime_type?.toLowerCase();

	if (isGifMessage(message) || isStickerMessage(message) || isVideoMessage(message)) {
		return false;
	}

	return Boolean(message.photo || mediaType === 'photo' || mimeType?.startsWith('image/'));
}

function isLowInfoTextContent(textContent: string): boolean {
	const normalizedCharacters = [...textContent.toLowerCase()].filter(
		(character) => !WHITESPACE.test(character)
	);

	if (normalizedCharacters.length === 0) {
		return false;
	}

	return new Set(normalizedCharacters).size <= 3;
}

export function classifyTelegramMessage(message: TelegramExportMessage): MessageClassification {
	if (message.type !== 'message') {
		return 'ignore';
	}

	if (getMessageTimestamp(message) === null) {
		return 'ignore';
	}

	const textContent = extractTextContent(message);

	if (textContent.length === 0) {
		if (isStickerOnlyMessage(message)) {
			return 'low-info';
		}

		return isSupportedMediaOnlyMessage(message) ? 'media-only' : 'ignore';
	}

	if (isEmojiOnlyMessage(message, textContent)) {
		return 'low-info';
	}

	if (isLowInfoTextContent(textContent)) {
		return 'low-info';
	}

	return 'other';
}

export function classifyTelegramMediaGroup(message: TelegramExportMessage): MediaMessageGroup | null {
	if (message.type !== 'message') {
		return null;
	}

	if (isStickerMessage(message)) {
		return 'sticker';
	}

	if (isGifMessage(message)) {
		return 'gif';
	}

	if (isVideoMessage(message)) {
		return 'video';
	}

	if (isImageMessage(message)) {
		return 'image';
	}

	if (
		['voice_message', 'audio_file'].includes(message.media_type?.toLowerCase() ?? '') ||
		message.mime_type?.toLowerCase().startsWith('audio/')
	) {
		return 'audio';
	}
	if (message.file || message.media_type?.toLowerCase() === 'document') {
		return 'document';
	}
	return null;
}

export function aggregateMessagesByTimeBucket(
	index: AnalyticsIndex,
	bucket?: TimeBucketSpec,
	timeRange?: TimeRangeSpec,
	metric: MessageBucketValueMetric = 'messages'
): MessageBucketAggregate[] {
	const normalizedBucket = normalizeTimeBucket(bucket);
	const normalizedTimeRange = normalizeTimeRange(timeRange, index.stats.dateRange);
	const cachedAggregates = getBucketAggregateCache(index, normalizedBucket, metric, normalizedTimeRange);

	if (cachedAggregates) {
		return cachedAggregates;
	}

	const aggregates = aggregateNormalizedMessagesByTimeBucket(
		index.messages,
		normalizedBucket,
		normalizedTimeRange,
		metric
	);

	setBucketAggregateCache(index, normalizedBucket, metric, normalizedTimeRange, aggregates);

	return aggregates;
}

export function aggregateNormalizedMessagesByTimeBucket(
	messages: NormalizedTelegramMessage[],
	bucket?: TimeBucketSpec,
	timeRange?: TimeRangeSpec | NormalizedTimeRange | null,
	metric: MessageBucketValueMetric = 'messages'
): MessageBucketAggregate[] {
	const normalizedBucket = normalizeTimeBucket(bucket);

	const counts = new Map<
		string,
		{
			start: Date;
			replyCount: number;
			nonReplyCount: number;
		}
	>();
	let firstBucketStart: Date | null = null;
	let lastBucketStart: Date | null = null;

	for (const message of messages) {
		if (message.classification === 'ignore') {
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

		const bucketCounts = counts.get(key) ?? {
			start: bucketStart,
			replyCount: 0,
			nonReplyCount: 0
		};
		const increment = metric === 'characters' ? message.textLength : 1;

		if (message.replyToMessageId !== null) {
			bucketCounts.replyCount += increment;
		} else {
			bucketCounts.nonReplyCount += increment;
		}

		counts.set(key, bucketCounts);
	}

	const fallbackRange = {
		start: firstBucketStart?.getTime() ?? null,
		end: lastBucketStart?.getTime() ?? null
	};
	const normalizedTimeRange = normalizeTimeRange(timeRange ?? undefined, fallbackRange);

	if (normalizedTimeRange === null) {
		return [];
	}

	const rangeStartBucket = getTimeBucketStart(normalizedTimeRange.startTimestamp, normalizedBucket);
	const rangeEndBucket = getTimeBucketStart(normalizedTimeRange.endTimestamp, normalizedBucket);

	const aggregates: MessageBucketAggregate[] = [];

	for (
		let bucketStart = rangeStartBucket;
		bucketStart.getTime() <= rangeEndBucket.getTime();
		bucketStart = addTimeBucket(bucketStart, normalizedBucket)
	) {
		const bucketCounts = counts.get(bucketStart.toISOString()) ?? {
			start: bucketStart,
			replyCount: 0,
			nonReplyCount: 0
		};
		const range = getTimeBucketDateRange(bucketStart, normalizedBucket);

		aggregates.push({
			label: getTimeBucketAxisLabel(bucketStart, normalizedBucket),
			tooltipLabel: getTimeBucketTooltipLabel(bucketStart, normalizedBucket),
			start: range.start,
			end: range.end,
			replyCount: bucketCounts.replyCount,
			nonReplyCount: bucketCounts.nonReplyCount
		});
	}

	return aggregates;
}