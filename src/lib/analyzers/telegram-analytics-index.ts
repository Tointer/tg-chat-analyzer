import { formatDayLabel, getChronologicalMessages, getMessageTimestamp } from './telegram-analysis-shared';
import { buildMembershipIntervals, type MembershipInterval } from './telegram-membership-index';
import { classifyTelegramMediaGroup, classifyTelegramMessage } from './telegram-text-analyzer';
import { groupConsecutiveMessages } from './telegram-message-grouping';
import { DEFAULT_MESSAGE_COUNTING } from './telegram-analysis-config';
import type {
	MediaMessageGroup,
	MessageBucketAggregate,
	MessageBucketValueMetric,
	MessageClassification,
	NormalizedTimeRange,
	NormalizedTimeBucket,
	TelegramExport,
	TelegramExportMessage
} from './telegram-analysis-types';
import type { MessageCountingMode } from './telegram-analysis-types';

export type NormalizedTelegramMessage = {
	original: TelegramExportMessage;
	sourceMessages: TelegramExportMessage[];
	rawMessageCount: number;
	endTimestamp: number;
	mediaGroups: MediaMessageGroup[];
	replies: Array<{ messageId: number; targetId: number; userId: string | null; latencyMs: number | null; timestamp: number }>;
	id: number | null;
	timestamp: number;
	dayLabel: string;
	messageType: string;
	classification: MessageClassification;
	senderId: string | null;
	senderName: string | null;
	actorId: string | null;
	actorName: string | null;
	textContent: string;
	textLength: number;
	reactionCount: number;
	hasMedia: boolean;
	mediaGroup: MediaMessageGroup | null;
	replyToMessageId: number | null;
	repliedToUserId: string | null;
	replyLatencyMs: number | null;
	forwardedFromId: string | null;
	forwardedFrom: string | null;
	members: string[];
};

export type ReplyEdgeSummary = {
	fromUserId: string;
	toUserId: string;
	count: number;
	totalReplyLatencyMs: number;
	replyLatencyCount: number;
	firstReplyTimestamp: number;
	lastReplyTimestamp: number;
};

export type AnalyticsIndex = {
	messageCounting: MessageCountingMode;
	chatName: string;
	messages: NormalizedTelegramMessage[];
	messageById: Map<number, NormalizedTelegramMessage>;
	messagesByUserId: Map<string, NormalizedTelegramMessage[]>;
	messagesByDayLabel: Map<string, NormalizedTelegramMessage[]>;
	membershipIntervalsByUserId: Map<string, MembershipInterval[]>;
	replyEdges: ReplyEdgeSummary[];
	bucketAggregatesByKey: Map<string, MessageBucketAggregate[]>;
	stats: {
		totalMessages: number;
		rawMessageCount: number;
		totalMediaMessages: number;
		peopleChatted: number;
		totalReactions: number;
		classificationCounts: Record<MessageClassification, number>;
		dateRange: {
			start: number | null;
			end: number | null;
		};
	};
};

function extractTextContent(message: TelegramExportMessage): string {
	if (typeof message.text === 'string') {
		return message.text.trim();
	}

	if (Array.isArray(message.text)) {
		return message.text
			.map((part) => (typeof part === 'string' ? part : part.text ?? ''))
			.join('')
			.trim();
	}

	return '';
}

function getUserAuthoredTextLength(message: TelegramExportMessage): number {
	if (message.forwarded_from || message.forwarded_from_id) {
		return 0;
	}

	return extractTextContent(message).length;
}

function getReactionCount(message: TelegramExportMessage): number {
	return (message.reactions ?? []).reduce((sum, reaction) => sum + Math.max(0, reaction.count ?? 0), 0);
}

function buildBucketKey(
	bucket: NormalizedTimeBucket,
	metric: MessageBucketValueMetric,
	timeRange?: NormalizedTimeRange | null
): string {
	if (!timeRange) {
		return `${bucket.unit}:${bucket.size}:${metric}:full`;
	}

	return `${bucket.unit}:${bucket.size}:${metric}:${timeRange.startTimestamp}:${timeRange.endTimestamp}`;
}

export function getBucketAggregateCache(
	index: AnalyticsIndex,
	bucket: NormalizedTimeBucket,
	metric: MessageBucketValueMetric,
	timeRange?: NormalizedTimeRange | null
): MessageBucketAggregate[] | undefined {
	return index.bucketAggregatesByKey.get(buildBucketKey(bucket, metric, timeRange));
}

export function setBucketAggregateCache(
	index: AnalyticsIndex,
	bucket: NormalizedTimeBucket,
	metric: MessageBucketValueMetric,
	timeRange: NormalizedTimeRange | null,
	aggregates: MessageBucketAggregate[]
) {
	index.bucketAggregatesByKey.set(buildBucketKey(bucket, metric, timeRange), aggregates);
}

export function buildTelegramAnalyticsIndex(telegramExport: TelegramExport, options: { messageCounting?: MessageCountingMode } = {}): AnalyticsIndex {
	const messageCounting = options.messageCounting ?? DEFAULT_MESSAGE_COUNTING;
	const messageById = new Map<number, NormalizedTelegramMessage>();
	const messagesByUserId = new Map<string, NormalizedTelegramMessage[]>();
	const messagesByDayLabel = new Map<string, NormalizedTelegramMessage[]>();
	const replyEdgesByPairKey = new Map<string, ReplyEdgeSummary>();
	const classificationCounts: Record<MessageClassification, number> = {
		other: 0,
		'low-info': 0,
		'media-only': 0,
		ignore: 0
	};
	let totalMediaMessages = 0;
	let totalReactions = 0;

	const chronologicalMessages = getChronologicalMessages(telegramExport.messages ?? []);
	const rawMessages = chronologicalMessages.map(({ message, timestamp }) => {
		const textContent = extractTextContent(message);
		const mediaGroup = classifyTelegramMediaGroup(message);
		const reactionCount = getReactionCount(message);
		const normalizedMessage: NormalizedTelegramMessage = {
			original: message,
			sourceMessages: [message], rawMessageCount: 1, endTimestamp: timestamp,
			mediaGroups: mediaGroup ? [mediaGroup] : [], replies: [],
			id: typeof message.id === 'number' ? message.id : null,
			timestamp,
			dayLabel: formatDayLabel(timestamp),
			messageType: message.type ?? 'unknown',
			classification: classifyTelegramMessage(message),
			senderId: message.from_id ?? null,
			senderName: message.from ?? null,
			actorId: message.actor_id ?? null,
			actorName: message.actor ?? null,
			textContent,
			textLength: getUserAuthoredTextLength(message),
			reactionCount,
			hasMedia: mediaGroup !== null,
			mediaGroup,
			replyToMessageId: typeof message.reply_to_message_id === 'number' ? message.reply_to_message_id : null,
			repliedToUserId: null,
			replyLatencyMs: null,
			forwardedFromId: message.forwarded_from_id ?? null,
			forwardedFrom: message.forwarded_from ?? null,
			members: [...(message.members ?? [])]
		};

		return normalizedMessage;
	});
	const messages = groupConsecutiveMessages(rawMessages, messageCounting);
	for (const normalizedMessage of messages) {
		classificationCounts[normalizedMessage.classification] += 1;
		if (normalizedMessage.classification !== 'ignore' && normalizedMessage.hasMedia) {
			totalMediaMessages += 1;
		}
		if (normalizedMessage.classification !== 'ignore') {
			totalReactions += normalizedMessage.reactionCount;
		}

		for (const source of normalizedMessage.sourceMessages) if (typeof source.id === 'number') messageById.set(source.id, normalizedMessage);

		if (normalizedMessage.senderId) {
			const userMessages = messagesByUserId.get(normalizedMessage.senderId) ?? [];
			userMessages.push(normalizedMessage);
			messagesByUserId.set(normalizedMessage.senderId, userMessages);
		}

		const dayMessages = messagesByDayLabel.get(normalizedMessage.dayLabel) ?? [];
		dayMessages.push(normalizedMessage);
		messagesByDayLabel.set(normalizedMessage.dayLabel, dayMessages);

	}

	for (const message of messages) {
		if (message.classification === 'ignore') {
			continue;
		}
		const targets = new Set<number>();
		const recipients = new Set<string>();
		for (const source of message.sourceMessages) {
			if (typeof source.reply_to_message_id !== 'number') continue;
			const targetMessage = messageById.get(source.reply_to_message_id);
			if (targetMessage === message && messageCounting === 'consecutive') continue;
			const targetId = targetMessage?.id ?? source.reply_to_message_id;
			if (targets.has(targetId)) continue;
			targets.add(targetId);
			const sourceTimestamp = getMessageTimestamp(source) ?? message.timestamp;
			const targetSource = targetMessage?.sourceMessages.find((part) => part.id === source.reply_to_message_id);
			const targetTimestamp = targetSource ? getMessageTimestamp(targetSource) : undefined;
			const latencyMs = targetMessage ? Math.max(0, sourceTimestamp - (targetTimestamp ?? targetMessage.timestamp)) : null;
			message.replies.push({ messageId: source.reply_to_message_id, targetId, userId: targetMessage?.senderId ?? null, latencyMs, timestamp: sourceTimestamp });
		}
		message.replyToMessageId = message.replies[0]?.messageId ?? null;
		message.repliedToUserId = message.replies[0]?.userId ?? null;
		message.replyLatencyMs = message.replies[0]?.latencyMs ?? null;
		for (const reply of message.replies) {
			if (!message.senderId || !reply.userId || recipients.has(reply.userId)) continue;
			recipients.add(reply.userId);
			const edgeKey = `${message.senderId}->${reply.userId}`;
			const edge = replyEdgesByPairKey.get(edgeKey) ?? {
				fromUserId: message.senderId,
				toUserId: reply.userId,
				count: 0,
				totalReplyLatencyMs: 0,
				replyLatencyCount: 0,
				firstReplyTimestamp: message.timestamp,
				lastReplyTimestamp: message.timestamp
			};

			edge.count += 1;
			edge.firstReplyTimestamp = Math.min(edge.firstReplyTimestamp, message.timestamp);
			edge.lastReplyTimestamp = Math.max(edge.lastReplyTimestamp, message.timestamp);

			if (reply.latencyMs !== null) {
				edge.totalReplyLatencyMs += reply.latencyMs;
				edge.replyLatencyCount += 1;
			}

			replyEdgesByPairKey.set(edgeKey, edge);
		}
	}

	return {
		messageCounting,
		chatName: telegramExport.name ?? 'Telegram Chat',
		messages,
		messageById,
		messagesByUserId,
		messagesByDayLabel,
		membershipIntervalsByUserId: buildMembershipIntervals(rawMessages),
		replyEdges: [...replyEdgesByPairKey.values()],
		bucketAggregatesByKey: new Map<string, MessageBucketAggregate[]>(),
		stats: {
			totalMessages: messages.filter((message) => message.classification !== 'ignore').length,
			rawMessageCount: rawMessages.filter((message) => message.classification !== 'ignore').length,
			totalMediaMessages,
			peopleChatted: messagesByUserId.size,
			totalReactions,
			classificationCounts,
			dateRange: {
				start: messages[0]?.timestamp ?? null,
				end: rawMessages.at(-1)?.timestamp ?? null
			}
		}
	};
}
