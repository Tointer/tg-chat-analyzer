import {
	getBucketAggregateCache,
	setBucketAggregateCache,
	type AnalyticsIndex
} from './telegram-analytics-index';
import {
	getTimeBucketAxisLabel,
	getTimeBucketDateRange,
	getMessageTimestamp,
	getTimeBucketStart,
	getTimeBucketTooltipLabel,
	normalizeTimeBucket
} from './telegram-analysis-shared';
import type {
	MessageClassification,
	MessageBucketAggregate,
	TelegramExportMessage,
	TimeBucketSpec
} from './telegram-analysis-types';

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
	if (message.photo || message.sticker_emoji) {
		return true;
	}

	const mediaType = message.media_type?.toLowerCase();
	const mimeType = message.mime_type?.toLowerCase();

	if (mediaType && ['animation', 'photo', 'sticker', 'video'].includes(mediaType)) {
		return true;
	}

	if (mimeType?.startsWith('image/') || mimeType?.startsWith('video/')) {
		return true;
	}

	return false;
}

function isStickerOnlyMessage(message: TelegramExportMessage): boolean {
	if (message.sticker_emoji) {
		return true;
	}

	return message.media_type?.toLowerCase() === 'sticker';
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

export function aggregateMessagesByTimeBucket(
	index: AnalyticsIndex,
	bucket?: TimeBucketSpec
): MessageBucketAggregate[] {
	const normalizedBucket = normalizeTimeBucket(bucket);
	const cachedAggregates = getBucketAggregateCache(index, normalizedBucket);

	if (cachedAggregates) {
		return cachedAggregates;
	}

	const counts = new Map<
		string,
		{
			start: Date;
			otherCount: number;
			lowInfoCount: number;
			mediaOnlyCount: number;
		}
	>();

	for (const message of index.messages) {
		if (message.classification === 'ignore') {
			continue;
		}

		const bucketStart = getTimeBucketStart(message.timestamp, normalizedBucket);
		const key = bucketStart.toISOString();
		const bucketCounts = counts.get(key) ?? {
			start: bucketStart,
			otherCount: 0,
			lowInfoCount: 0,
			mediaOnlyCount: 0
		};

		if (message.classification === 'media-only') {
			bucketCounts.mediaOnlyCount += 1;
		} else if (message.classification === 'low-info') {
			bucketCounts.lowInfoCount += 1;
		} else {
			bucketCounts.otherCount += 1;
		}

		counts.set(key, bucketCounts);
	}

	const aggregates = [...counts.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([, count]) => {
			const range = getTimeBucketDateRange(count.start, normalizedBucket);

			return {
				label: getTimeBucketAxisLabel(count.start, normalizedBucket),
				tooltipLabel: getTimeBucketTooltipLabel(count.start, normalizedBucket),
				start: range.start,
				end: range.end,
				otherCount: count.otherCount,
				lowInfoCount: count.lowInfoCount,
				mediaOnlyCount: count.mediaOnlyCount
			};
		});

	setBucketAggregateCache(index, normalizedBucket, aggregates);

	return aggregates;
}