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
});