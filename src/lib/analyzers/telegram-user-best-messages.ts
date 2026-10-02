import type { AnalyticsIndex, NormalizedTelegramMessage } from './telegram-analytics-index';

export type TelegramUserBestMessage = {
	messageId: number;
	authorName: string;
	forwardedFrom: string | null;
	timestamp: number;
	preview: string;
	reactionCount: number;
	replyCount: number;
	replies: Array<{
		messageId: number;
		authorName: string;
		preview: string;
	}>;
};

export type TelegramUserBestMessagesSummary = {
	userId: string;
	userName: string;
	mostReactions: TelegramUserBestMessage[];
	mostReplies: TelegramUserBestMessage[];
};

const MAX_BEST_MESSAGES = 10;

const userBestMessagesCache = new WeakMap<AnalyticsIndex, TelegramUserBestMessagesSummary[]>();

function buildMessagePreview(message: NormalizedTelegramMessage) {
	const compactText = message.textContent.replace(/\s+/g, ' ').trim();

	if (compactText.length > 0) {
		return compactText;
	}

	if (message.mediaGroup === 'image') {
		return 'Photo';
	}

	if (message.mediaGroup === 'video') {
		return 'Video';
	}

	if (message.mediaGroup === 'gif') {
		return 'GIF';
	}

	if (message.mediaGroup === 'sticker') {
		return message.original.sticker_emoji
			? `Sticker ${message.original.sticker_emoji}`
			: 'Sticker';
	}

	if (message.mediaGroup === 'audio') return 'Audio';
	if (message.mediaGroup === 'document') return 'Document';
	if (message.forwardedFrom) {
		return `Forwarded from ${message.forwardedFrom}`;
	}

	return 'Message';
}

function compareByReactions(left: TelegramUserBestMessage, right: TelegramUserBestMessage) {
	if (right.reactionCount !== left.reactionCount) {
		return right.reactionCount - left.reactionCount;
	}

	if (right.replyCount !== left.replyCount) {
		return right.replyCount - left.replyCount;
	}

	if (right.timestamp !== left.timestamp) {
		return right.timestamp - left.timestamp;
	}

	return left.messageId - right.messageId;
}

function compareByReplies(left: TelegramUserBestMessage, right: TelegramUserBestMessage) {
	if (right.replyCount !== left.replyCount) {
		return right.replyCount - left.replyCount;
	}

	if (right.reactionCount !== left.reactionCount) {
		return right.reactionCount - left.reactionCount;
	}

	if (right.timestamp !== left.timestamp) {
		return right.timestamp - left.timestamp;
	}

	return left.messageId - right.messageId;
}

export function getTelegramUserBestMessages(index: AnalyticsIndex): TelegramUserBestMessagesSummary[] {
	const cachedSummary = userBestMessagesCache.get(index);

	if (cachedSummary) {
		return cachedSummary;
	}

	const repliesByMessageId = new Map<number, number>();
	const directRepliesByMessageId = new Map<
		number,
		Array<{
			messageId: number;
			authorName: string;
			preview: string;
			timestamp: number;
		}>
	>();

	for (const message of index.messages) {
		if (message.classification === 'ignore' || message.replyToMessageId === null) {
			continue;
		}

		repliesByMessageId.set(
			message.replyToMessageId,
			(repliesByMessageId.get(message.replyToMessageId) ?? 0) + 1
		);
		const directReplies = directRepliesByMessageId.get(message.replyToMessageId) ?? [];
		directReplies.push({
			messageId: message.id ?? -1,
			authorName: message.senderName ?? message.senderId ?? 'Unknown',
			preview: buildMessagePreview(message),
			timestamp: message.timestamp
		});
		directRepliesByMessageId.set(message.replyToMessageId, directReplies);
	}

	for (const directReplies of directRepliesByMessageId.values()) {
		directReplies.sort((left, right) => left.timestamp - right.timestamp || left.messageId - right.messageId);
	}

	const summaries = [...index.messagesByUserId.entries()]
		.map(([userId, messages]) => {
			let resolvedUserName = userId;
			const messageEntries = messages
				.filter((message) => message.classification !== 'ignore' && message.id !== null)
				.map((message) => {
					if (message.senderName) {
						resolvedUserName = message.senderName;
					}

					return {
						messageId: message.id as number,
						authorName: message.senderName ?? resolvedUserName,
						forwardedFrom: message.forwardedFrom ?? null,
						timestamp: message.timestamp,
						preview: buildMessagePreview(message),
						reactionCount: message.reactionCount,
						replyCount: repliesByMessageId.get(message.id as number) ?? 0,
						replies: (directRepliesByMessageId.get(message.id as number) ?? []).map((reply) => ({
							messageId: reply.messageId,
							authorName: reply.authorName,
							preview: reply.preview
						}))
					} satisfies TelegramUserBestMessage;
				});

			return {
				userId,
				userName: resolvedUserName,
				mostReactions: [...messageEntries]
					.filter((message) => message.reactionCount > 0)
					.sort(compareByReactions)
					.slice(0, MAX_BEST_MESSAGES),
				mostReplies: [...messageEntries]
					.filter((message) => message.replyCount > 0)
					.sort(compareByReplies)
					.slice(0, MAX_BEST_MESSAGES)
			} satisfies TelegramUserBestMessagesSummary;
		})
		.sort((left, right) => left.userName.localeCompare(right.userName));

	userBestMessagesCache.set(index, summaries);
	return summaries;
}

export function getTelegramUserBestMessagesById(index: AnalyticsIndex, userId: string) {
	return getTelegramUserBestMessages(index).find((entry) => entry.userId === userId);
}