import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PageServerLoad } from './$types';

type TelegramTextPart =
	| string
	| {
			text?: string;
		};

type TelegramExportMessage = {
	type?: string;
	date?: string;
	date_unixtime?: string;
	text?: string | TelegramTextPart[];
	photo?: string;
	file?: string;
	media_type?: string;
	mime_type?: string;
	sticker_emoji?: string;
};

type TelegramExport = {
	name?: string;
	messages?: TelegramExportMessage[];
};

type WeeklyAggregate = {
	label: string;
	textCount: number;
	mediaOnlyCount: number;
	weekStart: string;
};

function getWeekStart(date: Date): Date {
	const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	const day = weekStart.getUTCDay() || 7;
	weekStart.setUTCDate(weekStart.getUTCDate() - day + 1);
	return weekStart;
}

function formatWeekLabel(weekStart: Date): string {
	return weekStart.toISOString().slice(0, 10);
}

function getMessageTimestamp(message: TelegramExportMessage): number | null {
	if (message.date_unixtime) {
		const unixTimestamp = Number(message.date_unixtime) * 1000;

		if (Number.isFinite(unixTimestamp)) {
			return unixTimestamp;
		}
	}

	if (message.date) {
		const parsedTimestamp = Date.parse(message.date);

		if (Number.isFinite(parsedTimestamp)) {
			return parsedTimestamp;
		}
	}

	return null;
}

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

function aggregateMessagesByWeek(messages: TelegramExportMessage[]): WeeklyAggregate[] {
	const counts = new Map<string, { textCount: number; mediaOnlyCount: number }>();

	for (const message of messages) {
		if (message.type !== 'message') {
			continue;
		}

		const timestamp = getMessageTimestamp(message);

		if (timestamp === null) {
			continue;
		}

		const weekStart = getWeekStart(new Date(timestamp));
		const key = formatWeekLabel(weekStart);
		const weekCounts = counts.get(key) ?? { textCount: 0, mediaOnlyCount: 0 };
		const textContent = extractTextContent(message);

		if (textContent.length > 0) {
			weekCounts.textCount += 1;
		} else if (isSupportedMediaOnlyMessage(message)) {
			weekCounts.mediaOnlyCount += 1;
		} else {
			continue;
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

export const load: PageServerLoad = async () => {
	const filePath = resolve('src', 'messages', 'result.json');
	const rawExport = await readFile(filePath, 'utf-8');
	const telegramExport = JSON.parse(rawExport) as TelegramExport;
	const messages = telegramExport.messages ?? [];
	const weeklyMessages = aggregateMessagesByWeek(messages);
	const totalMessages = weeklyMessages.reduce(
		(sum, week) => sum + week.textCount + week.mediaOnlyCount,
		0
	);
	const textMessages = weeklyMessages.reduce((sum, week) => sum + week.textCount, 0);
	const mediaOnlyMessages = weeklyMessages.reduce((sum, week) => sum + week.mediaOnlyCount, 0);
	const busiestWeek = weeklyMessages.reduce(
		(current, week) =>
			week.textCount + week.mediaOnlyCount > current.textCount + current.mediaOnlyCount
				? week
				: current,
		weeklyMessages[0] ?? { label: 'N/A', textCount: 0, mediaOnlyCount: 0, weekStart: 'N/A' }
	);

	return {
		chatName: telegramExport.name ?? 'Telegram Chat',
		weeklyMessages: {
			labels: weeklyMessages.map((week) => week.label),
			textValues: weeklyMessages.map((week) => week.textCount),
			mediaOnlyValues: weeklyMessages.map((week) => week.mediaOnlyCount)
		},
		totalMessages,
		textMessages,
		mediaOnlyMessages,
		weekCount: weeklyMessages.length,
		busiestWeek: {
			label: busiestWeek.label,
			count: busiestWeek.textCount + busiestWeek.mediaOnlyCount
		},
		range: {
			start: weeklyMessages[0]?.label ?? 'N/A',
			end: weeklyMessages.at(-1)?.label ?? 'N/A'
		}
	};
};