import type { AnalyticsIndex, NormalizedTelegramMessage } from './telegram-analytics-index';
import { isUserId } from './telegram-user-analyzer';

export type MembershipInterval = {
	startTimestamp: number;
	endTimestamp: number | null;
	startReason: 'service-join' | 'first-message';
	endReason: 'left-or-kicked' | null;
};

type PendingJoin = {
	startTimestamp: number;
	startReason: MembershipInterval['startReason'];
};

const MEMBER_JOIN_ACTIONS = new Set(['create_group', 'create_supergroup', 'invite_members']);

function rememberKnownUserId(
	nameToUserIds: Map<string, Set<string>>,
	userId: string | null,
	name: string | null
) {
	if (userId === null || name === null) {
		return;
	}

	if (!isUserId(userId)) {
		return;
	}

	const knownUserIds = nameToUserIds.get(name) ?? new Set<string>();
	knownUserIds.add(userId);
	nameToUserIds.set(name, knownUserIds);
}

function activateMembership(
	intervalsByUserId: Map<string, MembershipInterval[]>,
	activeIntervalsByUserId: Map<string, MembershipInterval>,
	userId: string,
	startTimestamp: number,
	startReason: MembershipInterval['startReason']
) {
	if (activeIntervalsByUserId.has(userId)) {
		return;
	}

	const interval: MembershipInterval = {
		startTimestamp,
		endTimestamp: null,
		startReason,
		endReason: null
	};

	const intervals = intervalsByUserId.get(userId) ?? [];
	intervals.push(interval);
	intervalsByUserId.set(userId, intervals);
	activeIntervalsByUserId.set(userId, interval);
}

function deactivateMembership(
	activeIntervalsByUserId: Map<string, MembershipInterval>,
	userId: string,
	endTimestamp: number
) {
	const interval = activeIntervalsByUserId.get(userId);

	if (!interval) {
		return;
	}

	interval.endTimestamp = Math.max(interval.startTimestamp, endTimestamp);
	interval.endReason = 'left-or-kicked';
	activeIntervalsByUserId.delete(userId);
}

function activateKnownUsersByName(
	intervalsByUserId: Map<string, MembershipInterval[]>,
	activeIntervalsByUserId: Map<string, MembershipInterval>,
	nameToUserIds: Map<string, Set<string>>,
	pendingJoinsByName: Map<string, PendingJoin>,
	name: string,
	timestamp: number,
	startReason: MembershipInterval['startReason']
) {
	const knownUserIds = nameToUserIds.get(name);

	if (!knownUserIds || knownUserIds.size === 0) {
		const pendingJoin = pendingJoinsByName.get(name);

		if (!pendingJoin || pendingJoin.startTimestamp > timestamp) {
			pendingJoinsByName.set(name, { startTimestamp: timestamp, startReason });
		}

		return;
	}

	if (knownUserIds.size !== 1) return;
	for (const userId of knownUserIds) {
		activateMembership(intervalsByUserId, activeIntervalsByUserId, userId, timestamp, startReason);
	}
}

function activateKnownUser(
	intervalsByUserId: Map<string, MembershipInterval[]>,
	activeIntervalsByUserId: Map<string, MembershipInterval>,
	nameToUserIds: Map<string, Set<string>>,
	pendingJoinsByName: Map<string, PendingJoin>,
	userId: string,
	name: string | null,
	timestamp: number,
	defaultStartReason: MembershipInterval['startReason']
) {
	rememberKnownUserId(nameToUserIds, userId, name);

	const pendingJoin = name ? pendingJoinsByName.get(name) : undefined;
	const startTimestamp = pendingJoin ? Math.min(pendingJoin.startTimestamp, timestamp) : timestamp;
	const startReason = pendingJoin?.startReason ?? defaultStartReason;

	if (name && pendingJoin) {
		pendingJoinsByName.delete(name);
	}

	activateMembership(intervalsByUserId, activeIntervalsByUserId, userId, startTimestamp, startReason);
}

function deactivateKnownUsersByName(
	activeIntervalsByUserId: Map<string, MembershipInterval>,
	nameToUserIds: Map<string, Set<string>>,
	pendingJoinsByName: Map<string, PendingJoin>,
	name: string,
	timestamp: number
) {
	const knownUserIds = nameToUserIds.get(name);

	if (knownUserIds && knownUserIds.size !== 1) return;
	for (const userId of knownUserIds ?? []) {
		deactivateMembership(activeIntervalsByUserId, userId, timestamp);
	}

	pendingJoinsByName.delete(name);
}

export function buildMembershipIntervals(
	messages: NormalizedTelegramMessage[]
): Map<string, MembershipInterval[]> {
	const intervalsByUserId = new Map<string, MembershipInterval[]>();
	const activeIntervalsByUserId = new Map<string, MembershipInterval>();
	const nameToUserIds = new Map<string, Set<string>>();
	const pendingJoinsByName = new Map<string, PendingJoin>();

	// Resolve invitations even when a member first speaks after the service event.
	for (const message of messages) {
		rememberKnownUserId(nameToUserIds, message.senderId, message.senderName);
		rememberKnownUserId(nameToUserIds, message.actorId, message.actorName);
	}

	for (const message of messages) {
		rememberKnownUserId(nameToUserIds, message.senderId, message.senderName);
		rememberKnownUserId(nameToUserIds, message.actorId, message.actorName);

		if (message.messageType === 'message' && isUserId(message.senderId ?? undefined)) {
			activateKnownUser(
				intervalsByUserId,
				activeIntervalsByUserId,
				nameToUserIds,
				pendingJoinsByName,
				message.senderId as string,
				message.senderName,
				message.timestamp,
				'first-message'
			);
			continue;
		}

		if (message.messageType !== 'service') {
			continue;
		}

		const action = message.original.action;

		if (isUserId(message.actorId ?? undefined)) {
			activateKnownUser(
				intervalsByUserId,
				activeIntervalsByUserId,
				nameToUserIds,
				pendingJoinsByName,
				message.actorId as string,
				message.actorName,
				message.timestamp,
				'service-join'
			);
		}

		if (MEMBER_JOIN_ACTIONS.has(action ?? '')) {
			for (const memberName of message.members) {
				activateKnownUsersByName(
					intervalsByUserId,
					activeIntervalsByUserId,
					nameToUserIds,
					pendingJoinsByName,
					memberName,
					message.timestamp,
					'service-join'
				);
			}
		}

		if (action === 'remove_members') {
			for (const memberName of message.members) {
				deactivateKnownUsersByName(
					activeIntervalsByUserId,
					nameToUserIds,
					pendingJoinsByName,
					memberName,
					message.timestamp
				);
			}
		}
	}

	return intervalsByUserId;
}

export function getMembershipIntervalsForUser(index: AnalyticsIndex, userId: string) {
	return index.membershipIntervalsByUserId.get(userId) ?? [];
}

export function isUserActiveAtTimestamp(index: AnalyticsIndex, userId: string, timestamp: number) {
	return getMembershipIntervalsForUser(index, userId).some(
		(interval) =>
			interval.startTimestamp <= timestamp &&
			(interval.endTimestamp === null || timestamp < interval.endTimestamp)
	);
}

export function areUsersCoPresentAtTimestamp(
	index: AnalyticsIndex,
	firstUserId: string,
	secondUserId: string,
	timestamp: number
) {
	return (
		isUserActiveAtTimestamp(index, firstUserId, timestamp) &&
		isUserActiveAtTimestamp(index, secondUserId, timestamp)
	);
}