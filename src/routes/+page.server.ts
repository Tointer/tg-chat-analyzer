import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PageServerLoad } from './$types';

type TelegramExportMessage = {
	type?: string;
	date?: string;
	date_unixtime?: string;
};

type TelegramExport = {
	name?: string;
	messages?: TelegramExportMessage[];
};

type WeeklyAggregate = {
	label: string;
	count: number;
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

function aggregateMessagesByWeek(messages: TelegramExportMessage[]): WeeklyAggregate[] {
	const counts = new Map<string, number>();

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
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	return [...counts.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([weekStart, count]) => ({
			label: weekStart,
			count,
			weekStart
		}));
}

export const load: PageServerLoad = async () => {
	const filePath = resolve('src', 'messages', 'result.json');
	const rawExport = await readFile(filePath, 'utf-8');
	const telegramExport = JSON.parse(rawExport) as TelegramExport;
	const messages = telegramExport.messages ?? [];
	const weeklyMessages = aggregateMessagesByWeek(messages);
	const totalMessages = weeklyMessages.reduce((sum, week) => sum + week.count, 0);
	const busiestWeek = weeklyMessages.reduce(
		(current, week) => (week.count > current.count ? week : current),
		weeklyMessages[0] ?? { label: 'N/A', count: 0, weekStart: 'N/A' }
	);

	return {
		chatName: telegramExport.name ?? 'Telegram Chat',
		weeklyMessages: {
			labels: weeklyMessages.map((week) => week.label),
			values: weeklyMessages.map((week) => week.count)
		},
		totalMessages,
		weekCount: weeklyMessages.length,
		busiestWeek: {
			label: busiestWeek.label,
			count: busiestWeek.count
		},
		range: {
			start: weeklyMessages[0]?.label ?? 'N/A',
			end: weeklyMessages.at(-1)?.label ?? 'N/A'
		}
	};
};