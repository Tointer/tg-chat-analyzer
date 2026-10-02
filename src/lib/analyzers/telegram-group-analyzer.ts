import type { AnalyticsIndex } from './telegram-analytics-index';
import { formatDayLabel, getMessageTimestamp } from './telegram-analysis-shared';
import { aggregateActiveParticipantCounts } from './telegram-user-analyzer';

export function aggregateParticipantTimeline(index: AnalyticsIndex) {
	const events = [...index.membershipIntervalsByUserId.values()].flatMap((intervals) =>
		intervals.flatMap((interval) => [
			{ timestamp: interval.startTimestamp, delta: 1 },
			...(interval.endTimestamp === null ? [] : [{ timestamp: interval.endTimestamp, delta: -1 }])
		])
	).sort((left, right) => left.timestamp - right.timestamp);
	const labelsWithActivity = index.messages.flatMap((message) => message.sourceMessages.map(
		(source) => formatDayLabel(getMessageTimestamp(source) ?? message.timestamp)
	));
	const timeline = new Map(labelsWithActivity.sort().map((label) => [label, 0]));
	let count = 0;
	let peakCount = 0;
	let eventIndex = 0;
	for (const label of timeline.keys()) {
		while (eventIndex < events.length && formatDayLabel(events[eventIndex].timestamp) <= label) {
			const timestamp = events[eventIndex].timestamp;
			// Apply simultaneous joins/leaves together to avoid a transient false peak.
			while (eventIndex < events.length && events[eventIndex].timestamp === timestamp) {
				count += events[eventIndex++].delta;
			}
			peakCount = Math.max(peakCount, count);
		}
		timeline.set(label, count);
	}
	const labels = [...timeline.keys()];
	const values = [...timeline.values()];
	const active = aggregateActiveParticipantCounts(labels, index.messages);
	return { labels, values, activeValues: active.activeValues,
		currentCount: values.at(-1) ?? 0, currentActiveCount: active.currentActiveCount, peakCount };
}
