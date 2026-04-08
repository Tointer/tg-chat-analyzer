import type { AnalyticsIndex } from './telegram-analytics-index';
import {
	addResolvedParticipant,
	aggregateActiveParticipantCounts,
	removeResolvedParticipantsByName
} from './telegram-user-analyzer';

export function aggregateParticipantTimeline(index: AnalyticsIndex) {
	const timeline = new Map<string, number>();
	const chronologicalMessages = index.messages;
	const presentParticipants = new Map<string, { id: string; name?: string }>();
	const nameToUserIds = new Map<string, Set<string>>();
	let peakCount = 0;

	for (const entry of chronologicalMessages) {
		if (entry.messageType === 'message') {
			addResolvedParticipant(
				presentParticipants,
				nameToUserIds,
				entry.senderId ?? undefined,
				entry.senderName ?? undefined
			);
		}

		if (entry.messageType === 'service') {
			addResolvedParticipant(
				presentParticipants,
				nameToUserIds,
				entry.actorId ?? undefined,
				entry.actorName ?? undefined
			);

			if (entry.original.action === 'remove_members') {
				for (const memberName of entry.members) {
					removeResolvedParticipantsByName(presentParticipants, nameToUserIds, memberName);
				}
			}
		}

		const participantCount = presentParticipants.size;
		peakCount = Math.max(peakCount, participantCount);
		timeline.set(entry.dayLabel, participantCount);
	}

	const labels = [...timeline.keys()];
	const values = [...timeline.values()];
	const activeParticipantTimeline = aggregateActiveParticipantCounts(labels, chronologicalMessages);

	return {
		labels,
		values,
		activeValues: activeParticipantTimeline.activeValues,
		currentCount: values.at(-1) ?? 0,
		currentActiveCount: activeParticipantTimeline.currentActiveCount,
		peakCount
	};
}