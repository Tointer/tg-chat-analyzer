import {
	formatWeekLabel,
	getMessageTimestamp,
	getWeekStart
} from './telegram-analysis-shared';
import type {
	MessageClassification,
	TelegramExportMessage,
	WeeklyAggregate
} from './telegram-analysis-types';

const EMOJI_TEXT_DETECTION = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
const NON_EMOJI_TEXT_REMAINDER =
	/(?:\p{White_Space}|\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Component}|\u200D|\uFE0F|\u20E3)/gu;

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

export function classifyTelegramMessage(message: TelegramExportMessage): MessageClassification {
	if (message.type !== 'message') {
		return 'ignore';
	}

	if (getMessageTimestamp(message) === null) {
		return 'ignore';
	}

	const textContent = extractTextContent(message);

	if (textContent.length === 0) {
		return isSupportedMediaOnlyMessage(message) ? 'media-only' : 'ignore';
	}

	if (isEmojiOnlyMessage(message, textContent)) {
		return 'media-only';
	}

	return 'text';
}

export function aggregateMessagesByWeek(messages: TelegramExportMessage[]): WeeklyAggregate[] {
	const counts = new Map<string, { textCount: number; mediaOnlyCount: number }>();

	for (const message of messages) {
		const timestamp = getMessageTimestamp(message);
		const classification = classifyTelegramMessage(message);

		if (timestamp === null || classification === 'ignore') {
			continue;
		}

		const weekStart = getWeekStart(new Date(timestamp));
		const key = formatWeekLabel(weekStart);
		const weekCounts = counts.get(key) ?? { textCount: 0, mediaOnlyCount: 0 };

		if (classification === 'media-only') {
			weekCounts.mediaOnlyCount += 1;
		} else {
			weekCounts.textCount += 1;
		}

		counts.set(key, weekCounts);
	}

	return [...counts.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([weekStart, count]) => ({
			label: weekStart,
			textCount: count.textCount,
			mediaOnlyCount: count.mediaOnlyCount,
			weekStart
		}));
}