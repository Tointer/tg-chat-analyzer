import assert from 'node:assert/strict';
import { test } from 'node:test';
import { importTelegramExports, parseTelegramHtmlExport, reconcileHtmlExports } from '../telegram-html-import';
import { mergeTelegramChatExports, type TelegramChatExport } from '../../analyzers/telegram-export-merge';
import { analyzeTelegramExport } from '../../analyzers/telegram-analysis';

const message = (id: number, body: string, sender = 'Alice', time = `12:00:0${id}`, joined = false) => `<div class="message default${joined ? ' joined' : ''}" id="message${id}"><div class="body"><div class="date" title="01.07.2026 ${time} UTC+03:00"></div>${joined ? '' : `<div class="from_name">${sender}</div>`}${body}</div></div>`;
const page = (body: string, name = 'Chat') => `<html><div class="page_header"><div class="text">${name}</div></div><div class="page_body chat_page"><div class="history">${body}</div></div></html>`;
const input = (name: string, raw: string) => ({ name, text: async () => raw });
const json = (): TelegramChatExport => ({ id: 42, name: 'Chat renamed', type: 'private_supergroup', messages: [1, 2, 3].map((id) => ({ id, type: 'message', date_unixtime: String(Date.parse(`2026-07-01T09:00:0${id}Z`) / 1000), from: 'Alice', from_id: 'user123', text: 'Edited later', reactions: [{ emoji: '👍', count: 8 }] })) });

test('HTML conversion preserves text, IDs, explicit timezone, joined sender, replies, and reactions', async () => {
	const html = await parseTelegramHtmlExport([input('messages.html', page(
		message(1, '<div class="text">Old &amp; <strong>bold</strong><br>next line &lt;safe&gt;</div><span class="reactions"><span class="reaction"><span class="emoji">👍</span><span class="userpics"><div class="initials" title="Bob"></div></span></span><span class="reaction"><span class="emoji">❤️</span><span class="count">4</span></span></span>') +
		message(2, '<div class="reply_to"><a href="messages.html#go_to_message1">reply</a></div><div class="text">Second</div>', 'ignored', undefined, true)
	))]);
	assert.equal(html.messages.length, 2);
	assert.equal(html.messages[0].text, 'Old & bold\nnext line <safe>');
	assert.equal(html.messages[0].date, '2026-07-01T09:00:01.000Z');
	assert.equal(html.messages[1].from_id, html.messages[0].from_id);
	assert.equal(html.messages[1].reply_to_message_id, 1);
	assert.deepEqual(html.messages[0].reactions?.map((entry) => entry.count), [1, 4]);
	const report = analyzeTelegramExport(html);
	assert.equal(report.totalMessages, 2);
	assert.equal(report.totalReactions, 5);
	assert.equal(report.peopleChatted, 1);
});

test('all pages are required, ordered numerically, and treated as one export', async () => {
	const first = page(message(1, '<div class="text">One</div>') + '<a class="pagination" href="messages2.html">Next</a>');
	const second = page('<a class="pagination" href="messages.html">Previous</a>' + message(2, '<div class="text">Two</div>'));
	await assert.rejects(parseTelegramHtmlExport([input('messages.html', first)]), /Missing HTML page/);
	await assert.rejects(parseTelegramHtmlExport([input('messages2.html', second)]), /including messages.html/);
	const entries = await importTelegramExports([input('Old/messages2.html', second), input('Old/messages.html', first)]);
	assert.equal(entries.length, 1);
	assert.deepEqual(entries[0].messages.map((entry) => entry.id), [1, 2]);
});

test('date separators are skipped while real negative service IDs survive with inferred times', async () => {
	const html = await parseTelegramHtmlExport([input('messages.html', page('<div class="message service" id="message-1"><div class="body">1 July 2026</div></div><div class="message service" id="message-999"><div class="body">Alice invited Bob</div></div>' + message(1, '<div class="text">Hi</div>')))]);
	assert.deepEqual(html.messages.map((entry) => entry.id), [-999, 1]);
	assert.equal(html.messages[0].action, 'invite_members');
	assert.deepEqual(html.messages[0].members, ['Bob']);
	assert.equal(html.messages[0].date, html.messages[1].date);
	assert.equal((html.messages[0] as Record<string, unknown>).html_date_inferred, true);
});

test('media classification and forwarded text use the message body, not decoration', async () => {
	const html = await parseTelegramHtmlExport([input('messages.html', page(message(1, '<div class="forwarded body"><div class="from_name">Source<span class="date"> yesterday</span></div><div class="media_wrap"><div class="media media_video"><div class="title">Animation</div></div></div><div class="text">Caption</div></div>') + message(2, '<div class="media_wrap"><a class="photo_wrap" href="photos/photo.jpg"></a></div>')))]);
	assert.equal(html.messages[0].forwarded_from, 'Source');
	assert.equal(html.messages[0].text, 'Caption');
	assert.equal(html.messages[0].media_type, 'animation');
	assert.equal(html.messages[1].photo, 'photos/photo.jpg');
});

test('HTML older truth wins, deleted messages survive, and JSON restores missing identities', async () => {
	const html = await parseTelegramHtmlExport([input('messages.html', page([1, 2, 3, 4].map((id) => message(id, `<div class="text">Original ${id}</div>`)).join('')))]);
	const merged = mergeTelegramChatExports(reconcileHtmlExports([html, json()]));
	assert.equal(merged.export.id, 42);
	assert.equal(merged.export.type, 'private_supergroup');
	assert.equal(merged.export.messages.length, 4);
	assert.equal(merged.export.messages[0].text, 'Original 1');
	assert.deepEqual(merged.export.messages[0].reactions, []);
	assert.deepEqual(merged.export.messages.map((entry) => entry.from_id), ['user123', 'user123', 'user123', 'user123']);
});

test('matching titles alone never merge HTML with unrelated JSON', async () => {
	const html = await parseTelegramHtmlExport([input('messages.html', page(message(1, '<div class="text">One</div>')))]);
	assert.throws(() => reconcileHtmlExports([html, json()]), /At least 3 shared/);
	const many = await parseTelegramHtmlExport([input('messages.html', page([1, 2, 3].map((id) => message(id, '<div class="text">One</div>')).join('')))]);
	const other = json(); other.messages[1].date_unixtime = '1';
	assert.throws(() => reconcileHtmlExports([many, other]), /different timestamps/);
});

test('bad HTML, mixed pages, duplicate message IDs, and invalid dates fail clearly', async () => {
	await assert.rejects(parseTelegramHtmlExport([input('messages.html', '<html>unrelated</html>')]), /expected Telegram/);
	await assert.rejects(parseTelegramHtmlExport([input('messages.html', page(message(1, 'Hi'))), input('messages2.html', page(message(2, 'Hi'), 'Other'))]), /different chats/);
	await assert.rejects(parseTelegramHtmlExport([input('messages.html', page(message(1, 'Hi') + message(1, 'Hi')))]), /duplicate/);
	await assert.rejects(parseTelegramHtmlExport([input('messages.html', page(message(1, 'Hi', 'Alice', 'bad')))]), /date/);
});

test('folder grouping preserves export priority when HTML is combined with JSON', async () => {
	const html = page([1, 2, 3].map((id) => message(id, '<div class="text">Original</div>')).join(''));
	const inputs = [input('Old/messages.html', html), input('result.json', JSON.stringify(json()))];
	const merged = mergeTelegramChatExports(await importTelegramExports(inputs));
	assert.equal(merged.export.messages[0].text, 'Original');
	const reversed = mergeTelegramChatExports(await importTelegramExports([...inputs].reverse()));
	assert.equal(reversed.export.messages[0].text, 'Edited later');
});

test('overlapping messages recover renamed senders, while ambiguous names remain synthetic', async () => {
	const html = await parseTelegramHtmlExport([input('messages.html', page([1, 2, 3, 4].map((id) => message(id, 'Original', 'Old name')).join('')))]);
	const reference = json();
	reconcileHtmlExports([html, reference]);
	assert.equal(html.messages[3].from_id, 'user123');
	const ambiguous = await parseTelegramHtmlExport([input('messages.html', page([1, 2, 3, 4].map((id) => message(id, 'Original', 'Old name')).join('')))]);
	reference.messages[1].from_id = 'user456';
	reconcileHtmlExports([ambiguous, reference]);
	assert.equal(ambiguous.messages[0].from_id, 'user123');
	assert.equal(ambiguous.messages[1].from_id, 'user456');
	assert.ok(ambiguous.messages[3].from_id?.startsWith('user-html-'));
});

test('converted downloads can be reimported and merged without losing their provenance', async () => {
	const html = page([1, 2, 3].map((id) => message(id, '<div class="text">Original</div>')).join(''));
	const original = mergeTelegramChatExports(await importTelegramExports([input('Old/messages.html', html), input('result.json', JSON.stringify(json()))])).export;
	const reimported = mergeTelegramChatExports(await importTelegramExports([input('converted.json', JSON.stringify(original)), input('result.json', JSON.stringify(json()))]));
	assert.equal(reimported.export.id, 42);
	assert.equal(reimported.export.messages.length, 3);
	assert.equal(reimported.export.messages[0].text, 'Original');
	assert.ok(reimported.export._telegram_html);
});
