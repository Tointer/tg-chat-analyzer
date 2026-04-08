import { formatDayLabel, getChronologicalMessages } from './telegram-analysis-shared';
import { buildMembershipIntervals, type MembershipInterval } from './telegram-membership-index';
import { classifyTelegramMessage } from './telegram-text-analyzer';
import type {
	MessageBucketAggregate,
	MessageClassification,
	NormalizedTimeRange,
	NormalizedTimeBucket,
	TelegramExport,
	TelegramExportMessage
} from './telegram-analysis-types';

export type NormalizedTelegramMessage = {
	original: TelegramExportMessage;
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
	hasMedia: boolean;
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

function buildBucketKey(bucket: NormalizedTimeBucket, timeRange?: NormalizedTimeRange | null): string {
	if (!timeRange) {
		return `${bucket.unit}:${bucket.size}:full`;
	}

	return `${bucket.unit}:${bucket.size}:${timeRange.startTimestamp}:${timeRange.endTimestamp}`;
}

export function getBucketAggregateCache(
	index: AnalyticsIndex,
	bucket: NormalizedTimeBucket,
	timeRange?: NormalizedTimeRange | null
): MessageBucketAggregate[] | undefined {
	return index.bucketAggregatesByKey.get(buildBucketKey(bucket, timeRange));
}

export function setBucketAggregateCache(
	index: AnalyticsIndex,
	bucket: NormalizedTimeBucket,
	timeRange: NormalizedTimeRange | null,
	aggregates: MessageBucketAggregate[]
) {
	index.bucketAggregatesByKey.set(buildBucketKey(bucket, timeRange), aggregates);
}

export function buildTelegramAnalyticsIndex(telegramExport: TelegramExport): AnalyticsIndex {
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

	const chronologicalMessages = getChronologicalMessages(telegramExport.messages ?? []);
	const messages = chronologicalMessages.map(({ message, timestamp }) => {
		const normalizedMessage: NormalizedTelegramMessage = {
			original: message,
			id: typeof message.id === 'number' ? message.id : null,
			timestamp,
			dayLabel: formatDayLabel(timestamp),
			messageType: message.type ?? 'unknown',
			classification: classifyTelegramMessage(message),
			senderId: message.from_id ?? null,
			senderName: message.from ?? null,
			actorId: message.actor_id ?? null,
			actorName: message.actor ?? null,
			textContent: extractTextContent(message),
			textLength: extractTextContent(message).length,
			hasMedia: Boolean(
				message.photo || message.file || message.media_type || message.mime_type || message.sticker_emoji
			),
			replyToMessageId: typeof message.reply_to_message_id === 'number' ? message.reply_to_message_id : null,
			repliedToUserId: null,
			replyLatencyMs: null,
			forwardedFromId: message.forwarded_from_id ?? null,
			forwardedFrom: message.forwarded_from ?? null,
			members: [...(message.members ?? [])]
		};

		classificationCounts[normalizedMessage.classification] += 1;

		if (normalizedMessage.id !== null) {
			messageById.set(normalizedMessage.id, normalizedMessage);
		}

		if (normalizedMessage.senderId) {
			const userMessages = messagesByUserId.get(normalizedMessage.senderId) ?? [];
			userMessages.push(normalizedMessage);
			messagesByUserId.set(normalizedMessage.senderId, userMessages);
		}

		const dayMessages = messagesByDayLabel.get(normalizedMessage.dayLabel) ?? [];
		dayMessages.push(normalizedMessage);
		messagesByDayLabel.set(normalizedMessage.dayLabel, dayMessages);

		return normalizedMessage;
	});

	for (const message of messages) {
		if (message.replyToMessageId === null) {
			continue;
		}

		const targetMessage = messageById.get(message.replyToMessageId);
		if (!targetMessage) {
			continue;
		}

		message.repliedToUserId = targetMessage.senderId;
		message.replyLatencyMs = Math.max(0, message.timestamp - targetMessage.timestamp);

		if (!message.senderId || !targetMessage.senderId) {
			continue;
		}

		const edgeKey = `${message.senderId}->${targetMessage.senderId}`;
		const edge = replyEdgesByPairKey.get(edgeKey) ?? {
			fromUserId: message.senderId,
			toUserId: targetMessage.senderId,
			count: 0,
			totalReplyLatencyMs: 0,
			replyLatencyCount: 0,
			firstReplyTimestamp: message.timestamp,
			lastReplyTimestamp: message.timestamp
		};

		edge.count += 1;
		edge.firstReplyTimestamp = Math.min(edge.firstReplyTimestamp, message.timestamp);
		edge.lastReplyTimestamp = Math.max(edge.lastReplyTimestamp, message.timestamp);

		if (message.replyLatencyMs !== null) {
			edge.totalReplyLatencyMs += message.replyLatencyMs;
			edge.replyLatencyCount += 1;
		}

		replyEdgesByPairKey.set(edgeKey, edge);
	}

	return {
		chatName: telegramExport.name ?? 'Telegram Chat',
		messages,
		messageById,
		messagesByUserId,
		messagesByDayLabel,
		membershipIntervalsByUserId: buildMembershipIntervals(messages),
		replyEdges: [...replyEdgesByPairKey.values()],
		bucketAggregatesByKey: new Map<string, MessageBucketAggregate[]>(),
		stats: {
			totalMessages: messages.filter((message) => message.classification !== 'ignore').length,
			classificationCounts,
			dateRange: {
				start: messages[0]?.timestamp ?? null,
				end: messages.at(-1)?.timestamp ?? null
			}
		}
	};
}