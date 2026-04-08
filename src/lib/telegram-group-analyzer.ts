import { formatDayLabel, getChronologicalMessages } from './telegram-analysis-shared';
import type { TelegramExportMessage } from './telegram-analysis-types';
import {
	addResolvedParticipant,
	aggregateActiveParticipantCounts,
	removeResolvedParticipantsByName
} from './telegram-user-analyzer';

export function aggregateParticipantTimeline(messages: TelegramExportMessage[]) {
	const timeline = new Map<string, number>();
	const chronologicalMessages = getChronologicalMessages(messages);
	const presentParticipants = new Map<string, { id: string; name?: string }>();
	const nameToUserIds = new Map<string, Set<string>>();
	let peakCount = 0;

	for (const entry of chronologicalMessages) {
		if (entry.message.type === 'message') {
			addResolvedParticipant(
				presentParticipants,
				nameToUserIds,
				entry.message.from_id,
				entry.message.from
			);
		}

		if (entry.message.type === 'service') {
			addResolvedParticipant(
				presentParticipants,
				nameToUserIds,
				entry.message.actor_id,
				entry.message.actor
			);

			if (entry.message.action === 'remove_members') {
				for (const memberName of entry.message.members ?? []) {
					removeResolvedParticipantsByName(presentParticipants, nameToUserIds, memberName);
				}
			}
		}

		const participantCount = presentParticipants.size;
		peakCount = Math.max(peakCount, participantCount);
		timeline.set(formatDayLabel(entry.timestamp), participantCount);
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