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
	test('classifies regular text messages as other', () => {
		assert.equal(classifyTelegramMessage(createMessage({ text: 'hello world' })), 'other');
	});

	test('classifies photo-only messages as media-only', () => {
		assert.equal(classifyTelegramMessage(createMessage({ photo: 'photo.jpg' })), 'media-only');
	});

	test('classifies sticker-only messages as low-info', () => {
		assert.equal(
			classifyTelegramMessage(
				createMessage({
					file: 'sticker.webp',
					media_type: 'sticker',
					sticker_emoji: '😄',
					mime_type: 'image/webp'
				})
			),
			'low-info'
		);
	});

	test('classifies plain emoji-only messages as low-info', () => {
		assert.equal(classifyTelegramMessage(createMessage({ text: '😇🔥' })), 'low-info');
	});

	test('classifies custom emoji-only messages as low-info', () => {
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
			'low-info'
		);
	});

	test('classifies short low-signal text as low-info', () => {
		assert.equal(classifyTelegramMessage(createMessage({ text: 'ahahahaha' })), 'low-info');
		assert.equal(classifyTelegramMessage(createMessage({ text: 'ok' })), 'low-info');
		assert.equal(classifyTelegramMessage(createMessage({ text: 'nvm' })), 'low-info');
	});

	test('keeps text with emoji as other', () => {
		assert.equal(classifyTelegramMessage(createMessage({ text: 'hello 😇' })), 'other');
	});

	test('keeps captioned media as other when the text is substantive', () => {
		assert.equal(
			classifyTelegramMessage(createMessage({ photo: 'photo.jpg', text: 'look at this' })),
			'other'
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
	test('excludes incomplete first and last day buckets from the chart series', () => {
		const report = analyzeTelegramExport({
			name: 'Test chat',
			messages: [
				createMessage({ date: '2025-12-13T09:00:00', date_unixtime: '1765616400', text: 'edge start' }),
				createMessage({ date: '2025-12-14T09:00:00', date_unixtime: '1765702800', text: 'regular text' }),
				createMessage({ date: '2025-12-15T09:00:00', date_unixtime: '1765789200', text: '😇' }),
				createMessage({ date: '2025-12-15T10:00:00', date_unixtime: '1765792800', photo: 'photo.jpg' }),
				createMessage({
					date: '2025-12-16T09:00:00',
					date_unixtime: '1765875600',
					text: 'next week text'
				}),
				createMessage({ date: '2025-12-17T09:00:00', date_unixtime: '1765962000', text: 'edge end' }),
				createMessage({ type: 'service' })
			]
		});

		assert.equal(report.chatName, 'Test chat');
		assert.equal(report.messageBuckets.title, 'Messages per day');
		assert.equal(report.messageBuckets.groupingLabel, 'day');
		assert.equal(report.messageBuckets.trimmedEdgeBucketCount, 2);
		assert.deepEqual(report.messageBuckets.labels, ['2025-12-14', '2025-12-15', '2025-12-16']);
		assert.deepEqual(report.messageBuckets.tooltipLabels, [
			'Day 2025-12-14',
			'Day 2025-12-15',
			'Day 2025-12-16'
		]);
		assert.deepEqual(report.messageBuckets.otherValues, [1, 0, 1]);
		assert.deepEqual(report.messageBuckets.lowInfoValues, [0, 1, 0]);
		assert.deepEqual(report.messageBuckets.mediaOnlyValues, [0, 1, 0]);
		assert.equal(report.totalMessages, 6);
		assert.equal(report.otherMessages, 4);
		assert.equal(report.lowInfoMessages, 1);
		assert.equal(report.mediaOnlyMessages, 1);
		assert.equal(report.bucketCount, 3);
		assert.deepEqual(report.busiestBucket, {
			label: '2025-12-15',
			tooltipLabel: 'Day 2025-12-15',
			count: 2
		});
		assert.deepEqual(report.range, { start: '2025-12-14', end: '2025-12-16' });
	});

	test('excludes incomplete edge buckets from multi-day chart series', () => {
		const report = analyzeTelegramExport(
			{
				name: '3-day bucket chat',
				messages: [
					createMessage({ date: '2025-12-11T09:00:00', date_unixtime: '1765443600', text: 'edge start' }),
					createMessage({ date: '2025-12-14T09:00:00', date_unixtime: '1765702800', text: 'a' }),
					createMessage({ date: '2025-12-15T09:00:00', date_unixtime: '1765789200', text: 'b' }),
					createMessage({ date: '2025-12-16T09:00:00', date_unixtime: '1765875600', photo: 'photo.jpg' }),
					createMessage({ date: '2025-12-18T09:00:00', date_unixtime: '1766048400', text: 'c' }),
					createMessage({ date: '2025-12-20T09:00:00', date_unixtime: '1766221200', text: 'd' }),
					createMessage({ date: '2025-12-21T09:00:00', date_unixtime: '1766307600', text: 'edge end' })
				]
			},
			{
				messageBuckets: { unit: 'day', size: 3 }
			}
		);

		assert.equal(report.messageBuckets.title, 'Messages per 3 days');
		assert.equal(report.messageBuckets.groupingLabel, '3 days');
		assert.equal(report.messageBuckets.trimmedEdgeBucketCount, 2);
		assert.deepEqual(report.messageBuckets.labels, ['2025-12-14', '2025-12-17']);
		assert.deepEqual(report.messageBuckets.tooltipLabels, [
			'3 days: 2025-12-14 to 2025-12-16',
			'3 days: 2025-12-17 to 2025-12-19'
		]);
		assert.deepEqual(report.messageBuckets.otherValues, [0, 0]);
		assert.deepEqual(report.messageBuckets.lowInfoValues, [2, 1]);
		assert.deepEqual(report.messageBuckets.mediaOnlyValues, [1, 0]);
		assert.deepEqual(report.range, { start: '2025-12-14', end: '2025-12-19' });
	});

	test('excludes incomplete edge buckets from monthly chart series', () => {
		const report = analyzeTelegramExport(
			{
				name: 'Monthly chat',
				messages: [
					createMessage({ date: '2025-11-14T09:00:00', date_unixtime: '1763110800', text: 'edge start' }),
					createMessage({ date: '2025-12-14T09:00:00', date_unixtime: '1765702800', text: 'a' }),
					createMessage({ date: '2025-12-22T09:00:00', date_unixtime: '1766394000', photo: 'photo.jpg' }),
					createMessage({ date: '2026-01-03T09:00:00', date_unixtime: '1767430800', text: 'b' }),
					createMessage({ date: '2026-02-06T09:00:00', date_unixtime: '1770368400', text: 'c' }),
					createMessage({ date: '2026-03-03T09:00:00', date_unixtime: '1772528400', text: 'edge end' })
				]
			},
			{
				messageBuckets: { unit: 'month' }
			}
		);

		assert.equal(report.messageBuckets.title, 'Messages per month');
		assert.equal(report.messageBuckets.groupingLabel, 'month');
		assert.equal(report.messageBuckets.trimmedEdgeBucketCount, 2);
		assert.deepEqual(report.messageBuckets.labels, ['2025-12', '2026-01', '2026-02']);
		assert.deepEqual(report.messageBuckets.tooltipLabels, [
			'Month 2025-12',
			'Month 2026-01',
			'Month 2026-02'
		]);
		assert.deepEqual(report.messageBuckets.otherValues, [0, 0, 0]);
		assert.deepEqual(report.messageBuckets.lowInfoValues, [1, 1, 1]);
		assert.deepEqual(report.messageBuckets.mediaOnlyValues, [1, 0, 0]);
		assert.deepEqual(report.range, { start: '2025-12-01', end: '2026-02-28' });
	});

	test('aggregates messages by week for the chart when requested', () => {
		const report = analyzeTelegramExport(
			{
				name: 'Weekly chat',
				messages: [
					createMessage({ date: '2025-11-30T09:00:00', date_unixtime: '1764493200', text: 'edge start' }),
					createMessage({ date: '2025-12-08T09:00:00', date_unixtime: '1765184400', text: 'a' }),
					createMessage({ date: '2025-12-09T09:00:00', date_unixtime: '1765270800', photo: 'photo.jpg' }),
					createMessage({ date: '2025-12-16T09:00:00', date_unixtime: '1765875600', text: 'b' }),
					createMessage({ date: '2025-12-23T09:00:00', date_unixtime: '1766480400', text: 'c' }),
					createMessage({ date: '2025-12-29T09:00:00', date_unixtime: '1766998800', text: 'edge end' })
				]
			},
			{
				messageBuckets: { unit: 'week' }
			}
		);

		assert.equal(report.messageBuckets.title, 'Messages per week');
		assert.equal(report.messageBuckets.groupingLabel, 'week');
		assert.equal(report.messageBuckets.trimmedEdgeBucketCount, 2);
		assert.deepEqual(report.messageBuckets.labels, ['2025-12-08', '2025-12-15', '2025-12-22']);
		assert.deepEqual(report.messageBuckets.tooltipLabels, [
			'Week of 2025-12-08',
			'Week of 2025-12-15',
			'Week of 2025-12-22'
		]);
		assert.deepEqual(report.messageBuckets.otherValues, [0, 0, 0]);
		assert.deepEqual(report.messageBuckets.lowInfoValues, [1, 1, 1]);
		assert.deepEqual(report.messageBuckets.mediaOnlyValues, [1, 0, 0]);
		assert.deepEqual(report.range, { start: '2025-12-08', end: '2025-12-28' });
	});

	test('separates low-info, media-only, and other messages in chart buckets', () => {
		const report = analyzeTelegramExport({
			name: 'Mixed chart chat',
			messages: [
				createMessage({ date: '2025-12-13T09:00:00', date_unixtime: '1765616400', text: 'edge start' }),
				createMessage({
					date: '2025-12-14T09:00:00',
					date_unixtime: '1765702800',
					photo: 'photo.jpg'
				}),
				createMessage({
					date: '2025-12-14T10:00:00',
					date_unixtime: '1765706400',
					forwarded_from: 'Source',
					forwarded_from_id: 'channel1',
					text: 'forwarded'
				}),
				createMessage({ date: '2025-12-14T11:00:00', date_unixtime: '1765710000', text: 'ok' }),
				createMessage({
					date: '2025-12-14T12:00:00',
					date_unixtime: '1765713600',
					text: 'this one has real content'
				}),
				createMessage({ date: '2025-12-15T09:00:00', date_unixtime: '1765789200', text: 'edge end' })
			]
		});

		assert.deepEqual(report.messageBuckets.labels, ['2025-12-14']);
		assert.deepEqual(report.messageBuckets.mediaOnlyValues, [1]);
		assert.deepEqual(report.messageBuckets.lowInfoValues, [1]);
		assert.deepEqual(report.messageBuckets.otherValues, [2]);
		assert.equal(report.mediaOnlyMessages, 1);
		assert.equal(report.lowInfoMessages, 1);
		assert.equal(report.otherMessages, 4);
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