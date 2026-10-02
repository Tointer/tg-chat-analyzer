import type { TelegramExport, TelegramExportMessage } from './telegram-analysis-types';
import { getMessageTimestamp } from './telegram-analysis-shared';

export type TelegramChatExport = TelegramExport & Record<string, unknown> & {
	id: number;
	type: string;
	name: string;
	messages: Array<TelegramExportMessage & { id: number }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate fields consumed by the analyzer while preserving all other export fields. */
export function parseTelegramChatExport(raw: string, fileName = 'Export'): TelegramChatExport {
	let value: unknown;
	try { value = JSON.parse(raw.replace(/^\uFEFF/, '')); }
	catch { throw new Error(`${fileName}: invalid JSON. Choose a Telegram JSON chat export.`); }
	if (!isRecord(value) || !Number.isSafeInteger(value.id) || typeof value.type !== 'string' || !value.type ||
		typeof value.name !== 'string' || !Array.isArray(value.messages)) {
		throw new Error(`${fileName}: expected a single-chat Telegram export with name, type, id, and messages. Export one chat as JSON in Telegram Desktop.`);
	}
	const seenIds = new Set<number>();
	for (const [index, message] of value.messages.entries()) {
		const invalid = () => new Error(`${fileName}: invalid message at position ${index + 1}.`);
		if (!isRecord(message) || !Number.isSafeInteger(message.id) ||
			!['message', 'service'].includes(message.type as string)) throw invalid();
		if (seenIds.has(message.id as number)) throw new Error(`${fileName}: duplicate message ID ${message.id}.`);
		seenIds.add(message.id as number);
		for (const key of ['date', 'date_unixtime', 'from', 'from_id', 'actor', 'actor_id', 'action',
			'forwarded_from', 'forwarded_from_id', 'photo', 'file', 'media_type', 'mime_type', 'sticker_emoji']) {
			if (message[key] != null && typeof message[key] !== 'string') throw invalid();
		}
		const timestamp = getMessageTimestamp(message as TelegramExportMessage);
		if (timestamp === null || !Number.isFinite(new Date(timestamp).getTime())) throw invalid();
		if (message.reply_to_message_id != null && !Number.isSafeInteger(message.reply_to_message_id)) throw invalid();
		if (message.members != null && (!Array.isArray(message.members) || message.members.some((member) => typeof member !== 'string'))) throw invalid();
		if (message.text != null && typeof message.text !== 'string' &&
			(!Array.isArray(message.text) || message.text.some((part) => typeof part !== 'string' &&
				(!isRecord(part) || typeof part.text !== 'string')))) throw invalid();
		if (message.reactions != null && (!Array.isArray(message.reactions) || message.reactions.some((reaction) =>
			!isRecord(reaction) || (reaction.count != null && (typeof reaction.count !== 'number' || !Number.isFinite(reaction.count) || reaction.count < 0)) ||
			(reaction.emoji != null && typeof reaction.emoji !== 'string')))) throw invalid();
	}
	return value as TelegramChatExport;
}

function chatKind(type: string) {
	// A public/private change does not create a new supergroup or channel.
	return type.replace(/^(private|public)_/, '');
}

/** Process one export at a time so duplicate copies can be released between uploads. */
export function createTelegramExportMerger() {
	let oldest: TelegramChatExport | undefined;
	const messages = new Map<number, TelegramChatExport['messages'][number]>();
	let inputMessageCount = 0;
	return {
		add(entry: TelegramChatExport) {
			if (oldest && (entry.id !== oldest.id || chatKind(entry.type) !== chatKind(oldest.type))) {
				throw new Error('These exports belong to different chats. Choose exports from the same Telegram chat.');
			}
			oldest ??= entry;
			for (const message of entry.messages) {
				inputMessageCount++;
				if (!messages.has(message.id)) messages.set(message.id, message);
			}
		},
		finish() {
			if (!oldest) throw new Error('Choose at least one Telegram JSON export.');
			const merged: TelegramChatExport = { ...oldest, messages: [...messages.values()].sort((a, b) => a.id - b.id) };
			return { export: merged, inputMessageCount, duplicateMessageCount: inputMessageCount - messages.size };
		}
	};
}

/** Inputs must be ordered oldest export first; creation order cannot be inferred from message dates. */
export function mergeTelegramChatExports(exports: TelegramChatExport[]) {
	const merger = createTelegramExportMerger();
	for (const entry of exports) merger.add(entry);
	return merger.finish();
}
