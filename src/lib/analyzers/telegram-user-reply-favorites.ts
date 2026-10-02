import type { AnalyticsIndex } from './telegram-analytics-index';
import { getMembershipIntervalsForUser, type MembershipInterval } from './telegram-membership-index';
import { getTelegramUserStatsById } from './telegram-user-stats';

export type TelegramUserReplyFavorite = {
	targetUserId: string;
	targetUserName: string;
	observedReplies: number;
	expectedReplies: number;
	residual: number;
	favoriteScore: number;
	overlapMessageCount: number;
	overlapTargetMessageCount: number;
	overlapReplyCount: number;
};

export type TelegramUserReplyFavoritesSummary = {
	userId: string;
	userName: string;
	repliesSent: number;
	bestFavoriteScore: number;
	bestFavoriteResidual: number;
	favorites: TelegramUserReplyFavorite[];
};

type IntervalRange = {
	startTimestamp: number;
	endTimestamp: number;
};

type PreparedIndexData = {
	allMessageTimestamps: number[];
	messageTimestampsByUserId: Map<string, number[]>;
	replyTimestampsByUserId: Map<string, number[]>;
	replyTimestampsByPairKey: Map<string, number[]>;
	userNamesById: Map<string, string>;
	userIds: string[];
};

const preparedIndexCache = new WeakMap<AnalyticsIndex, PreparedIndexData>();
const userReplyFavoritesCache = new WeakMap<AnalyticsIndex, Map<string, TelegramUserReplyFavorite[]>>();

function getPairKey(fromUserId: string, toUserId: string) {
	return `${fromUserId}->${toUserId}`;
}

function getUserName(index: AnalyticsIndex, userId: string) {
	return getTelegramUserStatsById(index, userId)?.userName ?? userId;
}

function lowerBound(values: number[], target: number) {
	let start = 0;
	let end = values.length;

	while (start < end) {
		const middle = Math.floor((start + end) / 2);

		if ((values[middle] ?? 0) < target) {
			start = middle + 1;
		} else {
			end = middle;
		}
	}

	return start;
}

function countValuesInRanges(values: number[], ranges: IntervalRange[]) {
	let count = 0;

	for (const range of ranges) {
		count += lowerBound(values, range.endTimestamp) - lowerBound(values, range.startTimestamp);
	}

	return count;
}

function getEffectiveIntervalEnd(interval: MembershipInterval, fallbackEndTimestamp: number) {
	return interval.endTimestamp ?? fallbackEndTimestamp + 1;
}

function getOverlappingRanges(
	firstIntervals: MembershipInterval[],
	secondIntervals: MembershipInterval[],
	fallbackEndTimestamp: number
) {
	const overlaps: IntervalRange[] = [];
	let firstIndex = 0;
	let secondIndex = 0;

	while (firstIndex < firstIntervals.length && secondIndex < secondIntervals.length) {
		const firstInterval = firstIntervals[firstIndex];
		const secondInterval = secondIntervals[secondIndex];

		if (!firstInterval || !secondInterval) {
			break;
		}

		const startTimestamp = Math.max(firstInterval.startTimestamp, secondInterval.startTimestamp);
		const firstEndTimestamp = getEffectiveIntervalEnd(firstInterval, fallbackEndTimestamp);
		const secondEndTimestamp = getEffectiveIntervalEnd(secondInterval, fallbackEndTimestamp);
		const endTimestamp = Math.min(firstEndTimestamp, secondEndTimestamp);

		if (startTimestamp < endTimestamp) {
			overlaps.push({ startTimestamp, endTimestamp });
		}

		if (firstEndTimestamp <= secondEndTimestamp) {
			firstIndex += 1;
		} else {
			secondIndex += 1;
		}
	}

	return overlaps;
}

function prepareIndexData(index: AnalyticsIndex): PreparedIndexData {
	const cachedPreparedData = preparedIndexCache.get(index);

	if (cachedPreparedData) {
		return cachedPreparedData;
	}

	const allMessageTimestamps: number[] = [];
	const messageTimestampsByUserId = new Map<string, number[]>();
	const replyTimestampsByUserId = new Map<string, number[]>();
	const replyTimestampsByPairKey = new Map<string, number[]>();
	const userNamesById = new Map<string, string>();

	for (const message of index.messages) {
		if (message.classification === 'ignore') {
			continue;
		}

		allMessageTimestamps.push(message.timestamp);

		if (message.senderId) {
			const userMessageTimestamps = messageTimestampsByUserId.get(message.senderId) ?? [];
			userMessageTimestamps.push(message.timestamp);
			messageTimestampsByUserId.set(message.senderId, userMessageTimestamps);

			if (message.senderName) {
				userNamesById.set(message.senderId, message.senderName);
			}
		}

		if (message.senderId && message.replyToMessageId !== null) {
			const userReplyTimestamps = replyTimestampsByUserId.get(message.senderId) ?? [];
			userReplyTimestamps.push(message.timestamp);
			replyTimestampsByUserId.set(message.senderId, userReplyTimestamps);

			for (const recipient of new Set(message.replies.map((reply) => reply.userId).filter((id): id is string => id !== null))) {
				const pairKey = getPairKey(message.senderId, recipient);
				const pairReplyTimestamps = replyTimestampsByPairKey.get(pairKey) ?? [];
				pairReplyTimestamps.push(message.timestamp);
				replyTimestampsByPairKey.set(pairKey, pairReplyTimestamps);
			}
		}
	}

	const preparedData: PreparedIndexData = {
		allMessageTimestamps,
		messageTimestampsByUserId,
		replyTimestampsByUserId,
		replyTimestampsByPairKey,
		userNamesById,
		userIds: [...messageTimestampsByUserId.keys()]
	};

	preparedIndexCache.set(index, preparedData);
	return preparedData;
}

export function getTelegramUserReplyFavorites(
	index: AnalyticsIndex,
	fromUserId: string
): TelegramUserReplyFavorite[] {
	const cacheForIndex = userReplyFavoritesCache.get(index) ?? new Map<string, TelegramUserReplyFavorite[]>();
	const cachedFavorites = cacheForIndex.get(fromUserId);

	if (cachedFavorites) {
		return cachedFavorites;
	}

	const preparedData = prepareIndexData(index);
	const fallbackEndTimestamp = index.stats.dateRange.end ?? 0;
	const fromUserIntervals = getMembershipIntervalsForUser(index, fromUserId);
	const fromUserReplyTimestamps = preparedData.replyTimestampsByUserId.get(fromUserId) ?? [];

	if (fromUserIntervals.length === 0 || fromUserReplyTimestamps.length === 0) {
		cacheForIndex.set(fromUserId, []);
		userReplyFavoritesCache.set(index, cacheForIndex);
		return [];
	}

	const favorites = preparedData.userIds
		.filter((targetUserId) => targetUserId !== fromUserId)
		.map((targetUserId) => {
			const targetIntervals = getMembershipIntervalsForUser(index, targetUserId);

			if (targetIntervals.length === 0) {
				return null;
			}

			const overlapRanges = getOverlappingRanges(
				fromUserIntervals,
				targetIntervals,
				fallbackEndTimestamp
			);

			if (overlapRanges.length === 0) {
				return null;
			}

			const overlapMessageCount = countValuesInRanges(preparedData.allMessageTimestamps, overlapRanges);
			const overlapTargetMessageCount = countValuesInRanges(
				preparedData.messageTimestampsByUserId.get(targetUserId) ?? [],
				overlapRanges
			);
			const overlapReplyCount = countValuesInRanges(fromUserReplyTimestamps, overlapRanges);
			const observedReplies = countValuesInRanges(
				preparedData.replyTimestampsByPairKey.get(getPairKey(fromUserId, targetUserId)) ?? [],
				overlapRanges
			);

			if (overlapMessageCount === 0 || overlapReplyCount === 0 || observedReplies === 0) {
				return null;
			}

			const expectedReplies = overlapReplyCount * (overlapTargetMessageCount / overlapMessageCount);
			const residual = observedReplies - expectedReplies;
			const favoriteScore = residual / Math.sqrt(Math.max(expectedReplies, 1));

			return {
				targetUserId,
				targetUserName: preparedData.userNamesById.get(targetUserId) ?? getUserName(index, targetUserId),
				observedReplies,
				expectedReplies,
				residual,
				favoriteScore,
				overlapMessageCount,
				overlapTargetMessageCount,
				overlapReplyCount
			} satisfies TelegramUserReplyFavorite;
		})
		.filter((entry): entry is TelegramUserReplyFavorite => entry !== null)
		.sort((left, right) => {
			if (right.favoriteScore !== left.favoriteScore) {
				return right.favoriteScore - left.favoriteScore;
			}

			if (right.residual !== left.residual) {
				return right.residual - left.residual;
			}

			if (right.observedReplies !== left.observedReplies) {
				return right.observedReplies - left.observedReplies;
			}

			return left.targetUserName.localeCompare(right.targetUserName);
		});

	cacheForIndex.set(fromUserId, favorites);
	userReplyFavoritesCache.set(index, cacheForIndex);
	return favorites;
}

export function getTelegramUserReplyFavoritesSummary(
	index: AnalyticsIndex,
	userId: string
): TelegramUserReplyFavoritesSummary {
	const userStats = getTelegramUserStatsById(index, userId);
	const favorites = getTelegramUserReplyFavorites(index, userId);
	const bestFavorite = favorites[0];

	return {
		userId,
		userName: userStats?.userName ?? getUserName(index, userId),
		repliesSent: userStats?.repliesSent ?? 0,
		bestFavoriteScore: bestFavorite?.favoriteScore ?? 0,
		bestFavoriteResidual: bestFavorite?.residual ?? 0,
		favorites
	};
}
