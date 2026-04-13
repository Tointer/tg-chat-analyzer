import type { AnalyticsIndex } from './telegram-analytics-index';
import { getMembershipIntervalsForUser } from './telegram-membership-index';
import type { AverageMessagePatternChart, AverageMessagePatternMode } from './telegram-analysis-types';

const HOUR_LABELS = Array.from({ length: 24 }, (_, hour) => `${hour.toString().padStart(2, '0')}:00`);
const HOUR_TOOLTIP_LABELS = Array.from(
	{ length: 24 },
	(_, hour) =>
		`Average messages sent between ${hour.toString().padStart(2, '0')}:00 and ${hour.toString().padStart(2, '0')}:59 UTC`
);
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_TOOLTIP_LABELS = [
	'Average messages sent on Mondays',
	'Average messages sent on Tuesdays',
	'Average messages sent on Wednesdays',
	'Average messages sent on Thursdays',
	'Average messages sent on Fridays',
	'Average messages sent on Saturdays',
	'Average messages sent on Sundays'
];
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const HOUR_IN_MS = 60 * 60 * 1000;

const averageMessagePatternCache = new WeakMap<
	AnalyticsIndex,
	Map<string, AverageMessagePatternChart>
>();

function startOfUtcDay(timestamp: number) {
	const date = new Date(timestamp);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function getWeekdayIndex(timestamp: number) {
	return (new Date(timestamp).getUTCDay() + 6) % 7;
}

function getCacheKey(userId: string, mode: AverageMessagePatternMode) {
	return `${userId}:${mode}`;
}

function buildHourlyDenominators(index: AnalyticsIndex, userId: string) {
	const activeDayCounts = new Array<number>(24).fill(0);
	const seenActiveHours = new Set<string>();

	for (const interval of getMembershipIntervalsForUser(index, userId)) {
		const intervalEnd = interval.endTimestamp ?? index.stats.dateRange.end;

		if (intervalEnd === null) {
			continue;
		}

		for (
			let dayStart = startOfUtcDay(interval.startTimestamp);
			dayStart <= intervalEnd;
			dayStart += DAY_IN_MS
		) {
			const dayEnd = dayStart + DAY_IN_MS;
			const overlapStart = Math.max(interval.startTimestamp, dayStart);
			const overlapEnd = Math.min(intervalEnd, dayEnd);

			if (overlapStart >= overlapEnd) {
				continue;
			}

			const firstActiveHour = Math.floor((overlapStart - dayStart) / HOUR_IN_MS);
			const lastActiveHour = Math.ceil((overlapEnd - dayStart) / HOUR_IN_MS) - 1;

			for (let hour = Math.max(0, firstActiveHour); hour <= Math.min(23, lastActiveHour); hour += 1) {
				const seenKey = `${dayStart}:${hour}`;

				if (seenActiveHours.has(seenKey)) {
					continue;
				}

				seenActiveHours.add(seenKey);
				activeDayCounts[hour] += 1;
			}
		}
	}

	return activeDayCounts;
}

function buildWeekdayDenominators(index: AnalyticsIndex, userId: string) {
	const weekdayCounts = new Array<number>(7).fill(0);
	const seenActiveDays = new Set<number>();

	for (const interval of getMembershipIntervalsForUser(index, userId)) {
		const intervalEnd = interval.endTimestamp ?? index.stats.dateRange.end;

		if (intervalEnd === null) {
			continue;
		}

		for (
			let dayStart = startOfUtcDay(interval.startTimestamp);
			dayStart <= intervalEnd;
			dayStart += DAY_IN_MS
		) {
			const dayEnd = dayStart + DAY_IN_MS;
			const overlapStart = Math.max(interval.startTimestamp, dayStart);
			const overlapEnd = Math.min(intervalEnd, dayEnd);

			if (overlapStart >= overlapEnd || seenActiveDays.has(dayStart)) {
				continue;
			}

			seenActiveDays.add(dayStart);
			weekdayCounts[getWeekdayIndex(dayStart)] += 1;
		}
	}

	return weekdayCounts;
}

function buildChart(
	mode: AverageMessagePatternMode,
	numeratorValues: number[],
	denominatorValues: number[]
): AverageMessagePatternChart {
	const values = numeratorValues.map((value, index) => {
		const denominator = denominatorValues[index] ?? 0;
		return denominator > 0 ? value / denominator : 0;
	});
	const peakValue = values.reduce((currentPeak, value) => Math.max(currentPeak, value), 0);
	const peakIndex = values.findIndex((value) => value === peakValue);
	const labels = mode === 'day' ? HOUR_LABELS : WEEKDAY_LABELS;
	const tooltipLabels = mode === 'day' ? HOUR_TOOLTIP_LABELS : WEEKDAY_TOOLTIP_LABELS;

	return {
		mode,
		title: mode === 'day' ? 'Average messages by hour' : 'Average messages by weekday',
		labels,
		tooltipLabels,
		values,
		peakLabel: labels[peakIndex] ?? 'N/A',
		peakValue,
		summaryValueLabel: mode === 'day' ? 'Peak hourly avg' : 'Peak weekday avg'
	};
}

export function getTelegramUserAverageMessagePattern(
	index: AnalyticsIndex,
	userId: string,
	mode: AverageMessagePatternMode
): AverageMessagePatternChart {
	const cacheForIndex = averageMessagePatternCache.get(index) ?? new Map<string, AverageMessagePatternChart>();
	const cacheKey = getCacheKey(userId, mode);
	const cachedChart = cacheForIndex.get(cacheKey);

	if (cachedChart) {
		return cachedChart;
	}

	const messages = index.messagesByUserId.get(userId) ?? [];
	const numeratorValues = new Array<number>(mode === 'day' ? 24 : 7).fill(0);

	for (const message of messages) {
		if (message.classification === 'ignore') {
			continue;
		}

		if (mode === 'day') {
			numeratorValues[new Date(message.timestamp).getUTCHours()] += 1;
			continue;
		}

		numeratorValues[getWeekdayIndex(message.timestamp)] += 1;
	}

	const chart = buildChart(
		mode,
		numeratorValues,
		mode === 'day' ? buildHourlyDenominators(index, userId) : buildWeekdayDenominators(index, userId)
	);

	cacheForIndex.set(cacheKey, chart);
	averageMessagePatternCache.set(index, cacheForIndex);
	return chart;
}