import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
	analyzeTelegramExport,
	classifyTelegramMessage,
	type TelegramExportMessage
} from './telegram-analysis';

function createMessage(overrides: Partial<TelegramExportMessage> = {}): TelegramExportMessage {
	return {
		type: 'message',
		date: '2025-12-14T14:15:46',
		date_unixtime: '1765710946',
		text: '',
		...overrides
	};
}

describe('classifyTelegramMessage', () => {
	test('classifies regular text messages as text', () => {
		assert.equal(classifyTelegramMessage(createMessage({ text: 'hello world' })), 'text');
	});

	test('classifies photo-only messages as media-only', () => {
		assert.equal(classifyTelegramMessage(createMessage({ photo: 'photo.jpg' })), 'media-only');
	});

	test('classifies sticker-only messages as media-only', () => {
		assert.equal(
			classifyTelegramMessage(
				createMessage({
					file: 'sticker.webp',
					media_type: 'sticker',
					sticker_emoji: '😄',
					mime_type: 'image/webp'
				})
			),
			'media-only'
		);
	});

	test('classifies plain emoji-only messages as media-only', () => {
		assert.equal(classifyTelegramMessage(createMessage({ text: '😇🔥' })), 'media-only');
	});

	test('classifies custom emoji-only messages as media-only', () => {
		assert.equal(
			classifyTelegramMessage(
				createMessage({
					text: [
						{
							type: 'custom_emoji',
							text: '😇',
							document_id: 'stickers/sticker.webp'
						},
						''
					]
				})
			),
			'media-only'
		);
	});

	test('keeps text with emoji as text', () => {
		assert.equal(classifyTelegramMessage(createMessage({ text: 'hello 😇' })), 'text');
	});

	test('keeps captioned media as text', () => {
		assert.equal(
			classifyTelegramMessage(createMessage({ photo: 'photo.jpg', text: 'look at this' })),
			'text'
		);
	});

	test('ignores service messages', () => {
		assert.equal(classifyTelegramMessage(createMessage({ type: 'service' })), 'ignore');
	});

	test('ignores messages without a valid date', () => {
		assert.equal(
			classifyTelegramMessage(createMessage({ date: undefined, date_unixtime: 'nope' })),
			'ignore'
		);
	});
});

describe('analyzeTelegramExport', () => {
	test('aggregates text and media-only counts by ISO week', () => {
		const report = analyzeTelegramExport({
			name: 'Test chat',
			messages: [
				createMessage({ text: 'regular text' }),
				createMessage({ text: '😇' }),
				createMessage({ photo: 'photo.jpg' }),
				createMessage({
					date: '2025-12-22T09:00:00',
					date_unixtime: '1766394000',
					text: 'next week text'
				}),
				createMessage({ type: 'service' })
			]
		});

		assert.equal(report.chatName, 'Test chat');
		assert.deepEqual(report.weeklyMessages.labels, ['2025-12-08', '2025-12-22']);
		assert.deepEqual(report.weeklyMessages.textValues, [1, 1]);
		assert.deepEqual(report.weeklyMessages.mediaOnlyValues, [2, 0]);
		assert.equal(report.totalMessages, 4);
		assert.equal(report.textMessages, 2);
		assert.equal(report.mediaOnlyMessages, 2);
		assert.deepEqual(report.busiestWeek, { label: '2025-12-08', count: 3 });
		assert.deepEqual(report.range, { start: '2025-12-08', end: '2025-12-22' });
	});

	test('builds participant timeline from membership events', () => {
		const report = analyzeTelegramExport({
			name: 'Test chat',
			messages: [
				{
					type: 'service',
					action: 'create_group',
					actor: 'Imran',
					actor_id: 'user1',
					date: '2025-12-14T14:12:33',
					date_unixtime: '1765710753',
					members: ['Imran']
				},
				{
					type: 'service',
					action: 'join_group_by_link',
					actor: 'Alice',
					actor_id: 'user2',
					date: '2025-12-15T09:00:00',
					date_unixtime: '1765789200'
				},
				{
					type: 'message',
					from: 'A',
					from_id: 'user3',
					date: '2025-12-15T10:00:00',
					date_unixtime: '1765792800',
					text: 'hello'
				},
				{
					type: 'message',
					from: 'B',
					from_id: 'user4',
					date: '2025-12-15T10:30:00',
					date_unixtime: '1765794600',
					text: 'hello'
				},
				{
					type: 'service',
					action: 'remove_members',
					date: '2025-12-16T11:00:00',
					date_unixtime: '1765882800',
					members: ['A']
				}
			]
		});

		assert.deepEqual(report.participantTimeline.labels, ['2025-12-14', '2025-12-15', '2025-12-16']);
		assert.deepEqual(report.participantTimeline.values, [1, 4, 3]);
		assert.deepEqual(report.participantTimeline.activeValues, [0, 0, 0]);
		assert.equal(report.participantTimeline.currentCount, 3);
		assert.equal(report.participantTimeline.currentActiveCount, 0);
		assert.equal(report.participantTimeline.peakCount, 4);
	});

	test('counts active participants in a rolling 30-day window', () => {
		const report = analyzeTelegramExport({
			name: 'Active window chat',
			messages: [
				createMessage({
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-01T09:00:00',
					date_unixtime: '1764579600',
					text: '1'
				}),
				createMessage({
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-05T09:00:00',
					date_unixtime: '1764925200',
					text: '2'
				}),
				createMessage({
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-10T09:00:00',
					date_unixtime: '1765357200',
					text: '3'
				}),
				createMessage({
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-15T09:00:00',
					date_unixtime: '1765789200',
					text: '4'
				}),
				createMessage({
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-20T09:00:00',
					date_unixtime: '1766221200',
					text: '5'
				}),
				createMessage({
					from: 'Bob',
					from_id: 'user2',
					date: '2025-12-20T10:00:00',
					date_unixtime: '1766224800',
					text: 'hi'
				}),
				createMessage({
					from: 'Alice',
					from_id: 'user1',
					date: '2026-01-10T09:00:00',
					date_unixtime: '1768035600',
					text: '6'
				})
			]
		});

		assert.deepEqual(
			report.participantTimeline.labels,
			['2025-12-01', '2025-12-05', '2025-12-10', '2025-12-15', '2025-12-20', '2026-01-10']
		);
		assert.deepEqual(report.participantTimeline.activeValues, [0, 0, 0, 0, 1, 0]);
		assert.equal(report.participantTimeline.currentActiveCount, 0);
	});
});