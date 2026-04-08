import { ACTIVE_PARTICIPANT_MESSAGE_THRESHOLD } from './telegram-analysis-config';
import type { NormalizedTelegramMessage } from './telegram-analytics-index';
import { getDayEndTimestamp } from './telegram-analysis-shared';

type ResolvedParticipant = {
	id: string;
	name?: string;
};

export function isUserId(value: string | undefined): value is string {
	return Boolean(value && value.startsWith('user'));
}

export function addResolvedParticipant(
	presentParticipants: Map<string, ResolvedParticipant>,
	nameToUserIds: Map<string, Set<string>>,
	userId: string | undefined,
	name: string | undefined
) {
	if (!isUserId(userId)) {
		return;
	}

	presentParticipants.set(userId, { id: userId, name });

	if (name) {
		const knownUserIds = nameToUserIds.get(name) ?? new Set<string>();
		knownUserIds.add(userId);
		nameToUserIds.set(name, knownUserIds);
	}
}

export function removeResolvedParticipantsByName(
	presentParticipants: Map<string, ResolvedParticipant>,
	nameToUserIds: Map<string, Set<string>>,
	name: string
) {
	const matchingUserIds = nameToUserIds.get(name);

	if (!matchingUserIds) {
		return;
	}

	for (const userId of matchingUserIds) {
		presentParticipants.delete(userId);
	}
}

export function aggregateActiveParticipantCounts(
	labels: string[],
	chronologicalMessages: NormalizedTelegramMessage[]
) {
	const messageEvents = chronologicalMessages
		.filter((entry) => entry.messageType === 'message' && isUserId(entry.senderId ?? undefined))
		.map((entry) => ({
			timestamp: entry.timestamp,
			userId: entry.senderId as string
		}));

	const rollingWindow: Array<{ timestamp: number; userId: string }> = [];
	const perUserCounts = new Map<string, number>();
	const activeValues: number[] = [];
	let nextEventIndex = 0;

	for (const dayLabel of labels) {
		const dayEndTimestamp = getDayEndTimestamp(dayLabel);
		const windowStartTimestamp = dayEndTimestamp - 30 * 24 * 60 * 60 * 1000;

		while (
			nextEventIndex < messageEvents.length &&
			messageEvents[nextEventIndex].timestamp <= dayEndTimestamp
		) {
			const event = messageEvents[nextEventIndex];
			rollingWindow.push(event);
			perUserCounts.set(event.userId, (perUserCounts.get(event.userId) ?? 0) + 1);
			nextEventIndex += 1;
		}

		while (rollingWindow.length > 0 && rollingWindow[0].timestamp < windowStartTimestamp) {
			const expiredEvent = rollingWindow.shift();

			if (!expiredEvent) {
				break;
			}

			const nextCount = (perUserCounts.get(expiredEvent.userId) ?? 1) - 1;

			if (nextCount <= 0) {
				perUserCounts.delete(expiredEvent.userId);
			} else {
				perUserCounts.set(expiredEvent.userId, nextCount);
			}
		}

		let activeCount = 0;

		for (const count of perUserCounts.values()) {
			if (count >= ACTIVE_PARTICIPANT_MESSAGE_THRESHOLD) {
				activeCount += 1;
			}
		}

		activeValues.push(activeCount);
	}

	return {
		activeValues,
		currentActiveCount: activeValues.at(-1) ?? 0
	};
}