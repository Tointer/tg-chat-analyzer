import type { TelegramExportMessage } from './telegram-analysis-types';

export type ChronologicalMessage = {
	message: TelegramExportMessage;
	timestamp: number;
};

export function getWeekStart(date: Date): Date {
	const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	const day = weekStart.getUTCDay() || 7;
	weekStart.setUTCDate(weekStart.getUTCDate() - day + 1);
	return weekStart;
}

export function formatWeekLabel(weekStart: Date): string {
	return weekStart.toISOString().slice(0, 10);
}

export function formatDayLabel(timestamp: number): string {
	return new Date(timestamp).toISOString().slice(0, 10);
}

export function getDayEndTimestamp(dayLabel: string): number {
	return Date.parse(`${dayLabel}T23:59:59.999Z`);
}

export function getMessageTimestamp(message: TelegramExportMessage): number | null {
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

export function getChronologicalMessages(
	messages: TelegramExportMessage[]
): ChronologicalMessage[] {
	return messages
		.map((message) => ({ message, timestamp: getMessageTimestamp(message) }))
		.filter((entry): entry is ChronologicalMessage => entry.timestamp !== null)
		.sort((left, right) => left.timestamp - right.timestamp);
}