import type { NormalizedTelegramMessage } from './telegram-analytics-index';
import type { MessageCountingMode } from './telegram-analysis-types';
import { classifyTelegramMessage } from './telegram-text-analyzer';

/** Group the whole chronological chat, never a user-filtered subset. Inputs remain unchanged. */
export function groupConsecutiveMessages(raw: NormalizedTelegramMessage[], mode: MessageCountingMode) {
	if (mode === 'raw') return raw;
	const groups: NormalizedTelegramMessage[] = [];
	for (const message of raw) {
		const previous = groups.at(-1);
		if (previous && message.messageType === 'message' && previous.messageType === 'message' &&
			message.senderId !== null && message.senderId === previous.senderId) {
			previous.sourceMessages.push(...message.sourceMessages);
			previous.rawMessageCount += message.rawMessageCount;
			previous.endTimestamp = message.endTimestamp;
			previous.textLength += message.textLength;
			previous.reactionCount += message.reactionCount;
			previous.mediaGroups = [...new Set([...previous.mediaGroups, ...message.mediaGroups])];
			previous.hasMedia = previous.mediaGroups.length > 0;
			previous.mediaGroup ??= message.mediaGroup;
			previous.senderName = message.senderName ?? previous.senderName;
		} else groups.push({ ...message, sourceMessages: [...message.sourceMessages], mediaGroups: [...message.mediaGroups] });
	}
	// Finalize once per run so long runs do not repeatedly copy growing text/reaction arrays.
	for (const group of groups) {
		if (group.sourceMessages.length === 1) continue;
		group.textContent = group.sourceMessages.map((part) => typeof part.text === 'string'
			? part.text.trim()
			: (part.text ?? []).map((entity) => typeof entity === 'string' ? entity : entity.text ?? '').join('').trim()
		).filter(Boolean).join('\n');
		const firstMedia = group.sourceMessages.find((part) => part.photo || part.file || part.media_type);
		const countedReactions = group.sourceMessages.filter((part) => classifyTelegramMessage(part) !== 'ignore')
			.flatMap((part) => part.reactions ?? []);
		group.reactionCount = countedReactions.reduce((sum, reaction) => sum + Math.max(0, reaction.count ?? 0), 0);
		group.original = { ...group.sourceMessages[0], text: group.textContent,
			photo: firstMedia?.photo, file: firstMedia?.file, media_type: firstMedia?.media_type,
			mime_type: firstMedia?.mime_type, sticker_emoji: firstMedia?.sticker_emoji,
			reactions: countedReactions };
		group.classification = classifyTelegramMessage(group.original);
		// A mixed run is authored by the sender, rather than attributed to its first forward.
		if (!group.sourceMessages.every((part) => (part.forwarded_from ?? null) === group.forwardedFrom &&
			(part.forwarded_from_id ?? null) === group.forwardedFromId)) {
			group.forwardedFrom = null;
			group.forwardedFromId = null;
		}
	}
	return groups;
}
