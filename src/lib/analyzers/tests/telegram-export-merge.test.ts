import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseTelegramChatExport, mergeTelegramChatExports } from '../telegram-export-merge';

function exportWith(messages: unknown[], extra: Record<string, unknown> = {}) {
	return parseTelegramChatExport(JSON.stringify({ id: 42, type: 'private_supergroup', name: 'Test chat', messages, ...extra }));
}
function message(id: number, text = `Message ${id}`, extra: Record<string, unknown> = {}) {
	return { id, type: 'message', date: '2026-01-01T12:00:00Z', from: 'Alice', from_id: 'user1', text, ...extra };
}

test('merging retains deleted messages, deduplicates IDs, and preserves the oldest full message', () => {
	const oldMessage = message(2, 'Original text', { reactions: [{ type: 'emoji', emoji: '🔥', count: 1 }], text_entities: [{ type: 'bold', text: 'Original text' }], custom_field: { preserved: true } });
	const older = exportWith([message(3), oldMessage, message(1)], { unknown_metadata: 'kept' });
	const newer = exportWith([message(2, 'Edited text', { edited: '2026-01-02T12:00:00Z', reactions: [{ count: 10 }] }), message(4)]);
	const result = mergeTelegramChatExports([older, newer]);
	assert.deepEqual(result.export.messages.map((entry) => entry.id), [1, 2, 3, 4]);
	assert.deepEqual(result.export.messages[1], oldMessage);
	assert.equal(result.export.unknown_metadata, 'kept');
	assert.equal(result.inputMessageCount, 5);
	assert.equal(result.duplicateMessageCount, 1);
	assert.deepEqual(older.messages.map((entry) => entry.id), [3, 2, 1]);
	assert.deepEqual(parseTelegramChatExport(JSON.stringify(result.export)), result.export);
});

test('different IDs with the same name and same ID with a different chat type are rejected', () => {
	const original = exportWith([message(1)]);
	assert.throws(() => mergeTelegramChatExports([original, exportWith([message(2)], { id: 43 })]), /different chats/);
	assert.throws(() => mergeTelegramChatExports([original, exportWith([message(2)], { type: 'personal_chat' })]), /different chats/);
});

test('chat renames are allowed with a matching identity and the oldest metadata wins', () => {
	const result = mergeTelegramChatExports([exportWith([message(1)]), exportWith([message(2)], { name: 'Renamed chat' })]);
	assert.equal(result.export.name, 'Test chat');
	assert.equal(result.export.messages.length, 2);
});

test('explicit priority order wins for three exports without using message dates as export dates', () => {
	const result = mergeTelegramChatExports([
		exportWith([message(1, 'Oldest')]), exportWith([message(1, 'Middle'), message(2)]), exportWith([message(1, 'Latest')])
	]);
	assert.equal(result.export.messages[0].text, 'Oldest');
	assert.equal(result.duplicateMessageCount, 2);
});

test('negative service IDs and empty exports are supported', () => {
	const service = { id: -999, type: 'service', date: '2025-12-31T00:00:00Z', action: 'create_group', actor_id: 'user1', members: ['Alice'], text: '' };
	const result = mergeTelegramChatExports([exportWith([service]), exportWith([service, message(1)])]);
	assert.deepEqual(result.export.messages.map((entry) => entry.id), [-999, 1]);
	assert.equal(mergeTelegramChatExports([exportWith([])]).export.messages.length, 0);
	assert.throws(() => mergeTelegramChatExports([]), /at least one/);
});

test('invalid JSON, full-account exports, missing identity, bad dates and duplicate IDs fail clearly', () => {
	assert.throws(() => parseTelegramChatExport('<html>'), /invalid JSON/);
	assert.throws(() => parseTelegramChatExport('{"chats":{"list":[]}}'), /single-chat/);
	assert.throws(() => parseTelegramChatExport('{"name":"Chat","messages":[]}'), /single-chat/);
	assert.throws(() => exportWith([message(1), message(1)]), /duplicate message ID/);
	assert.throws(() => exportWith([message(1, 'Text', { date: 'invalid' })]), /invalid message/);
	assert.throws(() => exportWith([message(1, 'Text', { reactions: [{ count: 'five' }] })]), /invalid message/);
	assert.throws(() => exportWith([message(1, 'Text', { members: [123] })]), /invalid message/);
});

test('UTF-8 BOM and nullable optional fields are accepted without losing them', () => {
	const data = exportWith([message(1, 'Text', { from: null, file: null, reactions: null })]);
	assert.equal(parseTelegramChatExport('\uFEFF' + JSON.stringify(data)).messages[0].from, null);
});

test('public/private changes keep the same chat identity without mixing chat kinds', () => {
	assert.equal(mergeTelegramChatExports([exportWith([message(1)]), exportWith([message(2)], { type: 'public_supergroup' })]).export.messages.length, 2);
	assert.throws(() => mergeTelegramChatExports([exportWith([message(1)]), exportWith([message(2)], { type: 'private_channel' })]), /different chats/);
});
