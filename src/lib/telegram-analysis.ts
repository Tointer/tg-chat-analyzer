export type TelegramTextEntity = {
	type?: string;
	text?: string;
	document_id?: string;
};

export type TelegramTextPart = string | TelegramTextEntity;

export type TelegramExportMessage = {
	type?: string;
	date?: string;
	date_unixtime?: string;
	action?: string;
	actor?: string;
	actor_id?: string;
	from?: string;
	from_id?: string;
	members?: string[];
	text?: string | TelegramTextPart[];
	text_entities?: TelegramTextEntity[];
	photo?: string;
	file?: string;
	media_type?: string;
	mime_type?: string;
	sticker_emoji?: string;
};

export type TelegramExport = {
	name?: string;
	messages?: TelegramExportMessage[];
};

type WeeklyAggregate = {
	label: string;
	textCount: number;
	mediaOnlyCount: number;
	weekStart: string;
};

export type WeeklyChartData = {
	chatName: string;
	participantTimeline: {
		labels: string[];
		values: number[];
		activeValues: number[];
		currentCount: number;
		currentActiveCount: number;
		peakCount: number;
	};
	weeklyMessages: {
		labels: string[];
		textValues: number[];
		mediaOnlyValues: number[];
	};
	totalMessages: number;
	textMessages: number;
	mediaOnlyMessages: number;
	weekCount: number;
	busiestWeek: {
		label: string;
		count: number;
	};
	range: {
		start: string;
		end: string;
	};
};

export type MessageClassification = 'text' | 'media-only' | 'ignore';

const EMOJI_TEXT_DETECTION = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
const NON_EMOJI_TEXT_REMAINDER =
	/(?:\p{White_Space}|\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Component}|\u200D|\uFE0F|\u20E3)/gu;

function getWeekStart(date: Date): Date {
	const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	const day = weekStart.getUTCDay() || 7;
	weekStart.setUTCDate(weekStart.getUTCDate() - day + 1);
	return weekStart;
}

function formatWeekLabel(weekStart: Date): string {
	return weekStart.toISOString().slice(0, 10);
}

function formatDayLabel(timestamp: number): string {
	return new Date(timestamp).toISOString().slice(0, 10);
}

function getDayEndTimestamp(dayLabel: string): number {
	return Date.parse(`${dayLabel}T23:59:59.999Z`);
}

function getMessageTimestamp(message: TelegramExportMessage): number | null {
	if (message.date_unixtime) {
		const unixTimestamp = Number(message.date_unixtime) * 1000;

		if (Number.isFinite(unixTimestamp)) {
			return unixTimestamp;
		}
	}

	if (message.date) {
		const parsedTimestamp = Date.parse(message.date);

		if (Number.isFinite(parsedTimestamp)) {
			return parsedTimestamp;
		}
	}

	return null;
}

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

function isEmojiOnlyTextContent(textContent: string): boolean {
	const normalizedText = textContent.trim();

	if (!normalizedText || !EMOJI_TEXT_DETECTION.test(normalizedText)) {
		return false;
	}

	return normalizedText.replace(NON_EMOJI_TEXT_REMAINDER, '').length === 0;
}

function isEmojiOnlyMessage(message: TelegramExportMessage, textContent: string): boolean {
	if (!isEmojiOnlyTextContent(textContent)) {
		return false;
	}

	if (!Array.isArray(message.text)) {
		return true;
	}

	return message.text.every((part) => {
		if (typeof part === 'string') {
			return part.trim().length === 0 || isEmojiOnlyTextContent(part);
		}

		const partText = part.text ?? '';
		return (
			['custom_emoji', 'emoji', 'plain', undefined].includes(part.type) &&
			(partText.trim().length === 0 || isEmojiOnlyTextContent(partText))
		);
	});
}

function isSupportedMediaOnlyMessage(message: TelegramExportMessage): boolean {
	if (message.photo || message.sticker_emoji) {
		return true;
	}

	const mediaType = message.media_type?.toLowerCase();
	const mimeType = message.mime_type?.toLowerCase();

	if (mediaType && ['animation', 'photo', 'sticker', 'video'].includes(mediaType)) {
		return true;
	}

	if (mimeType?.startsWith('image/') || mimeType?.startsWith('video/')) {
		return true;
	}

	return false;
}

type ResolvedParticipant = {
	id: string;
	name?: string;
};

function isUserId(value: string | undefined): value is string {
	return Boolean(value && value.startsWith('user'));
}

function addResolvedParticipant(
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

function removeResolvedParticipantsByName(
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

function aggregateActiveParticipantCounts(
	labels: string[],
	chronologicalMessages: Array<{ message: TelegramExportMessage; timestamp: number }>
) {
	const messageEvents = chronologicalMessages
		.filter(
			(entry) => entry.message.type === 'message' && isUserId(entry.message.from_id)
		)
		.map((entry) => ({
			timestamp: entry.timestamp,
			userId: entry.message.from_id as string
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
			if (count >= 5) {
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

function aggregateParticipantTimeline(messages: TelegramExportMessage[]) {
	const timeline = new Map<string, number>();
	const chronologicalMessages = messages
		.map((message) => ({ message, timestamp: getMessageTimestamp(message) }))
		.filter(
			(entry): entry is { message: TelegramExportMessage; timestamp: number } => entry.timestamp !== null
		)
		.sort((left, right) => left.timestamp - right.timestamp);

	const presentParticipants = new Map<string, ResolvedParticipant>();
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

export function classifyTelegramMessage(message: TelegramExportMessage): MessageClassification {
	if (message.type !== 'message') {
		return 'ignore';
	}

	if (getMessageTimestamp(message) === null) {
		return 'ignore';
	}

	const textContent = extractTextContent(message);

	if (textContent.length === 0) {
		return isSupportedMediaOnlyMessage(message) ? 'media-only' : 'ignore';
	}

	if (isEmojiOnlyMessage(message, textContent)) {
		return 'media-only';
	}

	return 'text';
}

function aggregateMessagesByWeek(messages: TelegramExportMessage[]): WeeklyAggregate[] {
	const counts = new Map<string, { textCount: number; mediaOnlyCount: number }>();

	for (const message of messages) {
		const timestamp = getMessageTimestamp(message);
		const classification = classifyTelegramMessage(message);

		if (timestamp === null || classification === 'ignore') {
			continue;
		}

		const weekStart = getWeekStart(new Date(timestamp));
		const key = formatWeekLabel(weekStart);
		const weekCounts = counts.get(key) ?? { textCount: 0, mediaOnlyCount: 0 };

		if (classification === 'media-only') {
			weekCounts.mediaOnlyCount += 1;
		} else {
			weekCounts.textCount += 1;
		}

		counts.set(key, weekCounts);
	}

	return [...counts.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([weekStart, count]) => ({
			label: weekStart,
			textCount: count.textCount,
			mediaOnlyCount: count.mediaOnlyCount,
			weekStart
		}));
}

export function analyzeTelegramExport(telegramExport: TelegramExport): WeeklyChartData {
	const messages = telegramExport.messages ?? [];
	const participantTimeline = aggregateParticipantTimeline(messages);
	const weeklyMessages = aggregateMessagesByWeek(messages);
	const totalMessages = weeklyMessages.reduce(
		(sum, week) => sum + week.textCount + week.mediaOnlyCount,
		0
	);
	const textMessages = weeklyMessages.reduce((sum, week) => sum + week.textCount, 0);
	const mediaOnlyMessages = weeklyMessages.reduce((sum, week) => sum + week.mediaOnlyCount, 0);
	const busiestWeek = weeklyMessages.reduce(
		(current, week) =>
			week.textCount + week.mediaOnlyCount > current.textCount + current.mediaOnlyCount
				? week
				: current,
		weeklyMessages[0] ?? { label: 'N/A', textCount: 0, mediaOnlyCount: 0, weekStart: 'N/A' }
	);

	return {
		chatName: telegramExport.name ?? 'Telegram Chat',
		participantTimeline,
		weeklyMessages: {
			labels: weeklyMessages.map((week) => week.label),
			textValues: weeklyMessages.map((week) => week.textCount),
			mediaOnlyValues: weeklyMessages.map((week) => week.mediaOnlyCount)
		},
		totalMessages,
		textMessages,
		mediaOnlyMessages,
		weekCount: weeklyMessages.length,
		busiestWeek: {
			label: busiestWeek.label,
			count: busiestWeek.textCount + busiestWeek.mediaOnlyCount
		},
		range: {
			start: weeklyMessages[0]?.label ?? 'N/A',
			end: weeklyMessages.at(-1)?.label ?? 'N/A'
		}
	};
}