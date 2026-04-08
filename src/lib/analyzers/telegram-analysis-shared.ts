import type {
	MessageBucketValueMetric,
	NormalizedTimeRange,
	NormalizedTimeBucket,
	TelegramExportMessage,
	TimeRangeSpec,
	TimeBucketSpec
} from './telegram-analysis-types';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const ISO_WEEK_EPOCH = Date.UTC(1970, 0, 5);

export type ChronologicalMessage = {
	message: TelegramExportMessage;
	timestamp: number;
};

function formatIsoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function formatIsoMonth(date: Date): string {
	return date.toISOString().slice(0, 7);
}

function startOfUtcDay(timestamp: number): Date {
	const date = new Date(timestamp);
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addMonths(date: Date, months: number): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function capitalize(value: string): string {
	return value.charAt(0).toUpperCase() + value.slice(1);
}

export function getWeekStart(date: Date): Date {
	const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	const day = weekStart.getUTCDay() || 7;
	weekStart.setUTCDate(weekStart.getUTCDate() - day + 1);
	return weekStart;
}

export function formatWeekLabel(weekStart: Date): string {
	return formatIsoDate(weekStart);
}

export function formatDayLabel(timestamp: number): string {
	return formatIsoDate(startOfUtcDay(timestamp));
}

export function getDayEndTimestamp(dayLabel: string): number {
	return Date.parse(`${dayLabel}T23:59:59.999Z`);
}

export function normalizeTimeBucket(bucket?: TimeBucketSpec): NormalizedTimeBucket {
	const normalizedSize = Math.max(1, Math.floor(bucket?.size ?? 1));

	return {
		unit: bucket?.unit ?? 'day',
		size: normalizedSize
	};
}

export function normalizeTimeRange(
	range: TimeRangeSpec | undefined,
	fallback: { start: number | null; end: number | null }
): NormalizedTimeRange | null {
	const requestedStart = range?.startTimestamp;
	const requestedEnd = range?.endTimestamp;
	const fallbackStart = fallback.start;
	const fallbackEnd = fallback.end;
	const startTimestamp =
		typeof requestedStart === 'number' && Number.isFinite(requestedStart)
			? requestedStart
			: fallbackStart;
	const endTimestamp =
		typeof requestedEnd === 'number' && Number.isFinite(requestedEnd)
			? requestedEnd
			: fallbackEnd;

	if (startTimestamp === null || endTimestamp === null) {
		return null;
	}

	return {
		startTimestamp: Math.min(startTimestamp, endTimestamp),
		endTimestamp: Math.max(startTimestamp, endTimestamp)
	};
}

export function getTimeBucketGroupingLabel(bucket: NormalizedTimeBucket): string {
	if (bucket.size === 1) {
		return bucket.unit;
	}

	return `${bucket.size} ${bucket.unit}s`;
}

export function getTimeBucketTitle(bucket: NormalizedTimeBucket): string {
	return `Messages per ${getTimeBucketGroupingLabel(bucket)}`;
}

export function getTimeBucketMetricTitle(
	metric: MessageBucketValueMetric,
	bucket: NormalizedTimeBucket
): string {
	return `${metric === 'characters' ? 'Characters' : 'Messages'} per ${getTimeBucketGroupingLabel(bucket)}`;
}

export function getTimeBucketStart(timestamp: number, bucket: NormalizedTimeBucket): Date {
	if (bucket.unit === 'day') {
		const dayStart = startOfUtcDay(timestamp).getTime();
		const bucketSizeInMs = bucket.size * DAY_IN_MS;
		return new Date(Math.floor(dayStart / bucketSizeInMs) * bucketSizeInMs);
	}

	if (bucket.unit === 'week') {
		const weekStart = getWeekStart(new Date(timestamp)).getTime();
		const bucketSizeInMs = bucket.size * 7 * DAY_IN_MS;
		return new Date(
			ISO_WEEK_EPOCH + Math.floor((weekStart - ISO_WEEK_EPOCH) / bucketSizeInMs) * bucketSizeInMs
		);
	}

	const date = new Date(timestamp);
	const monthIndex = date.getUTCFullYear() * 12 + date.getUTCMonth();
	const bucketMonthIndex = Math.floor(monthIndex / bucket.size) * bucket.size;
	const year = Math.floor(bucketMonthIndex / 12);
	const month = bucketMonthIndex % 12;

	return new Date(Date.UTC(year, month, 1));
}

export function addTimeBucket(start: Date, bucket: NormalizedTimeBucket): Date {
	if (bucket.unit === 'month') {
		return addMonths(start, bucket.size);
	}

	const multiplier = bucket.unit === 'week' ? 7 : 1;
	return new Date(start.getTime() + bucket.size * multiplier * DAY_IN_MS);
}

export function getTimeBucketAxisLabel(start: Date, bucket: NormalizedTimeBucket): string {
	if (bucket.unit === 'month') {
		return formatIsoMonth(start);
	}

	return formatIsoDate(start);
}

export function getTimeBucketDateRange(start: Date, bucket: NormalizedTimeBucket): {
	start: string;
	end: string;
} {
	const end = new Date(addTimeBucket(start, bucket).getTime() - 1);

	return {
		start: formatIsoDate(start),
		end: formatIsoDate(end)
	};
}

export function getTimeBucketTooltipLabel(start: Date, bucket: NormalizedTimeBucket): string {
	const range = getTimeBucketDateRange(start, bucket);

	if (bucket.unit === 'day' && bucket.size === 1) {
		return `Day ${range.start}`;
	}

	if (bucket.unit === 'week' && bucket.size === 1) {
		return `Week of ${range.start}`;
	}

	if (bucket.unit === 'month' && bucket.size === 1) {
		return `Month ${formatIsoMonth(start)}`;
	}

	const label = capitalize(getTimeBucketGroupingLabel(bucket));
	return `${label}: ${range.start} to ${range.end}`;
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