import { load, type CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { parseTelegramChatExport, type TelegramChatExport } from '../analyzers/telegram-export-merge';
import { getMessageTimestamp } from '../analyzers/telegram-analysis-shared';

type Message = TelegramChatExport['messages'][number] & Record<string, unknown>;
export type ExportInput = { name: string; text(): Promise<string> };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const syntheticUser = (name: string) => `user-html-${hash(name).slice(0, 16)}`;
const pageNumber = (name: string) => Number(basename(name).match(/^messages(\d*)\.html?$/i)?.[1] || 1);

function text($: CheerioAPI, node: AnyNode | undefined): string {
	if (!node) return '';
	const copy = $(node).clone();
	copy.find('br').replaceWith('\n');
	copy.find('script, style').remove();
	return copy.text().trim();
}

function timestamp(title: string): number {
	const match = title.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2}) UTC([+-]\d{2}:\d{2})$/);
	if (!match) throw new Error(`Unrecognized Telegram HTML message date: ${title}`);
	const [, day, month, year, hour, minute, second, offset] = match;
	const result = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`);
	if (!Number.isFinite(result)) throw new Error('Invalid Telegram HTML message date.');
	return result;
}

function serviceFields(value: string): Partial<Message> {
	let match = value.match(/^(.*?) joined group (?:by link from .*|by request|via a community)$/);
	if (match) return { action: 'join_group_by_link', actor: match[1], actor_id: syntheticUser(match[1]) };
	match = value.match(/^(.*?) invited (.*)$/);
	if (match) return { action: 'invite_members', actor: match[1], actor_id: syntheticUser(match[1]), members: match[2].split(/, | and /) };
	match = value.match(/^(.*?) removed (.*)$/);
	if (match && !['group photo'].includes(match[2])) return { action: 'remove_members', actor: match[1], actor_id: syntheticUser(match[1]), members: [match[2]] };
	match = value.match(/^(.*?) left (?:the )?group$/);
	if (match) return { action: 'remove_members', actor: match[1], actor_id: syntheticUser(match[1]), members: [match[1]] };
	match = value.match(/^(.*?) created group «.*»(?: with members (.*))?$/);
	if (match) return { action: 'create_group', actor: match[1], actor_id: syntheticUser(match[1]), members: match[2]?.split(/, | and /) ?? [match[1]] };
	return { action: 'html_service' };
}

/** Only parses markup. Export scripts, links and media are never executed or fetched. */
export async function parseTelegramHtmlExport(pages: ExportInput[]): Promise<TelegramChatExport> {
	const ordered = [...pages].sort((a, b) => pageNumber(a.name) - pageNumber(b.name));
	const names = new Set(ordered.map((page) => basename(page.name)));
	if (names.size !== ordered.length) throw new Error('Duplicate HTML page names. Add each HTML export using its folder picker.');
	if (!names.has('messages.html')) throw new Error('Add the whole HTML export folder, including messages.html and every messagesN.html page.');
	const messages: Message[] = [];
	const seen = new Set<number>();
	let chatName = '';
	let sender = '';
	let forwarded = '';
	let previousTimestamp: number | undefined;
	let pending: Message[] = [];
	let day: string | undefined;
	for (const page of ordered) {
		const $ = load(await page.text());
		const name = text($, $('.page_header .text').first()[0]);
		if (!name || !$('.page_body.chat_page .history').length) throw new Error(`${page.name}: expected Telegram Desktop chat HTML.`);
		if (chatName && chatName !== name) throw new Error('These HTML pages belong to different chats.');
		chatName = name;
		for (const link of $('.pagination[href]').toArray()) {
			const linked = basename($(link).attr('href')!.split('#')[0]);
			if (!names.has(linked)) throw new Error(`Missing HTML page ${linked}. Add the whole export folder to avoid losing messages.`);
		}
		for (const node of $('.history > .message').toArray()) {
			const element = $(node);
			const idMatch = element.attr('id')?.match(/^message(-?\d+)$/);
			if (!idMatch) throw new Error(`${page.name}: message has no valid ID.`);
			const id = Number(idMatch[1]);
			const body = element.children('.body').first();
			const value = element.hasClass('service') ? text($, body[0]) : '';
			// Telegram's negative date separators are layout, not real service messages.
			if (element.hasClass('service') && /^\d{1,2} [A-Za-z]+ \d{4}$/.test(value)) {
				day = value;
				continue;
			}
			if (!Number.isSafeInteger(id) || seen.has(id)) throw new Error(`${page.name}: duplicate or invalid message ID ${id}.`);
			seen.add(id);
			const message: Message = { id, type: element.hasClass('service') ? 'service' : 'message', text: '' };
			const dateTitle = body.children('.date[title]').first().attr('title');
			if (dateTitle) {
				const time = timestamp(dateTitle);
				message.date = new Date(time).toISOString();
				message.date_unixtime = String(time / 1000);
				for (const service of pending) { service.date = message.date; service.date_unixtime = message.date_unixtime; }
				pending = [];
				previousTimestamp = time;
			} else {
				if (message.type !== 'service') throw new Error(`${page.name}: message ${id} has no timestamp.`);
				message.html_date_inferred = true;
				// Service HTML omits the exact time: use the next dated message, falling back to the day/previous message.
				const fallback = day ? Date.parse(`${day} 00:00:00 GMT`) : previousTimestamp;
				if (fallback !== undefined && Number.isFinite(fallback)) { message.date = new Date(fallback).toISOString(); message.date_unixtime = String(fallback / 1000); }
				pending.push(message);
			}
			if (message.type === 'service') {
				Object.assign(message, serviceFields(value), { text: value, html_service_text: value });
				sender = ''; forwarded = '';
			} else {
				const fromNode = body.children('.from_name').first();
				if (fromNode.length) { sender = text($, fromNode[0]).replace(/ via @\S+$/, ''); forwarded = ''; }
				if (!sender) throw new Error(`${page.name}: cannot determine the sender of message ${id}. Add preceding HTML pages.`);
				message.from = sender;
				message.from_id = syntheticUser(sender);
				const content = body.children('.forwarded.body').first();
				const source = content.length ? content : body;
				if (content.length) {
					const from = content.children('.from_name').first().clone(); from.children('.date').remove();
					if (from.length) forwarded = text($, from[0]);
					message.forwarded_from = forwarded || 'Unknown forwarded source';
				}
				message.text = text($, source.children('.text').first()[0]);
				message.text_entities = [{ type: 'plain', text: message.text }];
				const reply = source.find('.reply_to a').first().attr('href')?.match(/#(?:go_to_)?message(-?\d+)$/);
				if (reply) message.reply_to_message_id = Number(reply[1]);
				const media = source.find('.media_wrap').first();
				if (media.length) {
					const title = text($, media.find('.title').first()[0]);
					const href = media.find('a[href]').first().attr('href');
					const kind = media.find('.media').attr('class') ?? '';
					if (/media_photo/.test(kind) || media.find('.photo_wrap').length) message.photo = href || '(Photo not included in HTML export)';
					else {
						message.file = href || `(Media not included in HTML export: ${title || 'unknown'})`;
						message.media_type = /sticker/i.test(title + kind) || media.find('.sticker_wrap').length ? 'sticker'
							: /animation/i.test(title) ? 'animation' : /voice/i.test(title + kind) ? 'voice_message'
							: /video message/i.test(title) ? 'video_message' : /video/i.test(title + kind) || media.find('.video_wrap').length ? 'video_file'
							: /audio|music/i.test(title + kind) ? 'audio_file' : 'document';
					}
				}
				message.reactions = source.find('.reactions > .reaction').toArray().map((reaction) => {
					const entry = $(reaction);
					const recent = entry.find('.userpics .initials[title]').toArray().map((person) => ({ from: $(person).attr('title')! }));
					const countText = text($, entry.find('.count').first()[0]);
					const emoji = text($, entry.find('.emoji').first()[0]);
					return { type: emoji ? 'emoji' : 'custom_emoji', ...(emoji ? { emoji } : {}), count: countText ? Number(countText) : recent.length, recent };
				});
				// Preserve visible formatting and unsupported details without treating them as executable markup.
				message.html_content = source.html() ?? '';
			}
			messages.push(message);
		}
	}
	if (messages.some((message) => !message.date_unixtime)) throw new Error('HTML service messages have no surrounding date to infer their time.');
	const first = messages.find((message) => message.type === 'message');
	const id = -Number.parseInt(hash(`${chatName}:${first?.id}:${first?.date_unixtime}`).slice(0, 12), 16);
	return { id, type: 'html_chat', name: chatName, messages, _telegram_html: { identity: 'synthetic', pages: pages.length } };
}

function isUnidentifiedHtml(entry: TelegramChatExport) {
	return (entry._telegram_html as { identity?: string } | undefined)?.identity === 'synthetic';
}

/** ID + exact time overlap establishes identity; a display name alone never authorizes a merge. */
export function reconcileHtmlExports(entries: TelegramChatExport[]): TelegramChatExport[] {
	const reference = entries.find((entry) => !entry._telegram_html) ?? entries.find((entry) => !isUnidentifiedHtml(entry)) ?? entries[0];
	const referenceMessages = new Map(reference.messages.map((message) => [message.id, message]));
	for (const entry of entries) {
		if (entry === reference || !isUnidentifiedHtml(entry)) continue;
		let matches = 0;
		for (const message of entry.messages) {
			const other = referenceMessages.get(message.id);
			if (!other || message.type !== 'message' || other.type !== 'message') continue;
			if (getMessageTimestamp(message) !== getMessageTimestamp(other)) throw new Error('These exports belong to different chats: matching message IDs have different timestamps.');
			matches++;
		}
		if (matches < 3) throw new Error('Cannot verify that the HTML and other exports are from the same chat. At least 3 shared message IDs with identical timestamps are required. Import this HTML folder on its own instead.');
		entry.id = reference.id;
		entry.type = reference.type;
		entry._telegram_html = { ...(entry._telegram_html as object), identity: isUnidentifiedHtml(reference) ? 'synthetic' : 'matched' };
	}
	// Recover real sender IDs from overlapping messages, using unique names only for missing messages.
	const names = new Map<string, Set<string>>();
	function rememberName(name: string | undefined, id: string | undefined) {
		if (!name || !id || id.startsWith('user-html-')) return;
		const ids = names.get(name) ?? new Set<string>(); ids.add(id); names.set(name, ids);
	}
	for (const entry of entries.filter((entry) => !isUnidentifiedHtml(entry))) {
		for (const message of entry.messages) {
			rememberName(message.from, message.from_id);
			rememberName(message.actor, message.actor_id);
		}
	}
	for (const entry of entries.filter((entry) => entry._telegram_html)) {
		for (const message of entry.messages) {
			const other = referenceMessages.get(message.id);
			if (other && message.type === other.type) {
				rememberName(message.from, other.from_id);
				rememberName(message.actor, other.actor_id);
			}
		}
	}
	for (const entry of entries.filter((entry) => entry._telegram_html)) {
		for (const message of entry.messages as Message[]) {
			const other = referenceMessages.get(message.id);
			if (other && reference !== entry && !reference._telegram_html && message.type === other.type) {
				if (message.html_date_inferred) { message.date = other.date; message.date_unixtime = other.date_unixtime; delete message.html_date_inferred; }
				if (other.from_id) message.from_id = other.from_id;
				if (other.actor_id) message.actor_id = other.actor_id;
				if (message.forwarded_from && other.forwarded_from_id) message.forwarded_from_id = other.forwarded_from_id;
				if (message.action === 'html_service' && other.action) message.action = other.action;
			} else if (message.from && names.get(message.from)?.size === 1) message.from_id = [...names.get(message.from)!][0];
			if (message.actor && names.get(message.actor)?.size === 1) message.actor_id = [...names.get(message.actor)!][0];
		}
	}
	return entries;
}

export async function importTelegramExports(files: ExportInput[]): Promise<TelegramChatExport[]> {
	const groups: Array<ExportInput | ExportInput[]> = [];
	const htmlGroups = new Map<string, ExportInput[]>();
	for (const file of files) {
		if (/\.json$/i.test(file.name)) groups.push(file);
		else if (/^messages\d*\.html?$/i.test(basename(file.name))) {
			const directory = file.name.replace(/[^/\\]+$/, '');
			let group = htmlGroups.get(directory);
			if (!group) { group = []; htmlGroups.set(directory, group); groups.push(group); }
			group.push(file);
		} else throw new Error(`${file.name}: choose result.json or Telegram messages*.html pages.`);
	}
	const entries: TelegramChatExport[] = [];
	for (const group of groups) entries.push(Array.isArray(group) ? await parseTelegramHtmlExport(group) : parseTelegramChatExport(await group.text(), group.name));
	return reconcileHtmlExports(entries);
}
