import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildRawAnalyticsIndex } from './raw-analysis-helpers';
import { getTelegramUserStats, getTelegramUserStatsById } from '../telegram-user-stats';
import type { TelegramExportMessage } from '../telegram-analysis';

function createMessage(overrides: Partial<TelegramExportMessage> = {}): TelegramExportMessage {
	return {
		type: 'message',
		date: '2025-12-14T14:15:46',
		date_unixtime: '1765710946',
		text: '',
		...overrides
	};
}

describe('getTelegramUserStats', () => {
	test('aggregates per-user message and reply metrics from the analytics index', () => {
		const index = buildRawAnalyticsIndex({
			name: 'User stats chat',
			messages: [
				createMessage({
					id: 1,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-14T10:00:00',
					date_unixtime: '1765706400',
					text: 'hello world'
				}),
				createMessage({
					id: 2,
					from: 'Bob',
					from_id: 'user2',
					reply_to_message_id: 1,
					date: '2025-12-14T10:05:00',
					date_unixtime: '1765706700',
					text: 'ok'
				}),
				createMessage({
					id: 3,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-14T10:10:00',
					date_unixtime: '1765707000',
					photo: 'photo.jpg'
				}),
				createMessage({
					id: 4,
					from: 'Alice',
					from_id: 'user1',
					reply_to_message_id: 2,
					date: '2025-12-14T10:15:00',
					date_unixtime: '1765707300',
					file: 'sticker.webp',
					media_type: 'sticker',
					sticker_emoji: '😄',
					mime_type: 'image/webp'
				}),
				createMessage({
					id: 5,
					from: 'Bob',
					from_id: 'user2',
					date: '2025-12-14T10:20:00',
					date_unixtime: '1765707600',
					text: 'real message'
				}),
				createMessage({
					id: 6,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-15T09:00:00',
					date_unixtime: '1765789200',
					text: 'new day message'
				}),
				{
					type: 'service',
					actor: 'Carol',
					actor_id: 'user3',
					action: 'join_group_by_link',
					date: '2025-12-15T09:30:00',
					date_unixtime: '1765791000'
				}
			]
		});

		const stats = getTelegramUserStats(index);

		assert.deepEqual(
			stats.map((entry) => entry.userId),
			['user1', 'user2']
		);

		assert.deepEqual(stats[0], {
			userId: 'user1',
			userName: 'Alice',
			totalMessages: 4,
			totalMediaMessages: 2,
			imageMessages: 1,
			videoMessages: 0,
			gifMessages: 0,
			stickerMessages: 1,
			otherMessages: 2,
			lowInfoMessages: 1,
			mediaOnlyMessages: 1,
			activeDayCount: 2,
			firstMessageTimestamp: 1765706400000,
			lastMessageTimestamp: 1765789200000,
			totalTextLength: 26,
			averageTextLength: 6.5,
			repliesSent: 1,
			repliesReceived: 1,
			averageReplyLatencyMs: 10 * 60 * 1000
		});

		assert.deepEqual(stats[1], {
			userId: 'user2',
			userName: 'Bob',
			totalMessages: 2,
			totalMediaMessages: 0,
			imageMessages: 0,
			videoMessages: 0,
			gifMessages: 0,
			stickerMessages: 0,
			otherMessages: 1,
			lowInfoMessages: 1,
			mediaOnlyMessages: 0,
			activeDayCount: 1,
			firstMessageTimestamp: 1765706700000,
			lastMessageTimestamp: 1765707600000,
			totalTextLength: 14,
			averageTextLength: 7,
			repliesSent: 1,
			repliesReceived: 1,
			averageReplyLatencyMs: 5 * 60 * 1000
		});
	});

	test('returns a single user entry by id and reuses cached results', () => {
		const index = buildRawAnalyticsIndex({
			name: 'Single user chat',
			messages: [
				createMessage({
					id: 1,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-14T10:00:00',
					date_unixtime: '1765706400',
					text: 'hello world'
				})
			]
		});

		const firstStats = getTelegramUserStats(index);
		const secondStats = getTelegramUserStats(index);

		assert.equal(firstStats, secondStats);
		assert.deepEqual(getTelegramUserStatsById(index, 'user1'), firstStats[0]);
		assert.equal(getTelegramUserStatsById(index, 'missing-user'), undefined);
	});

	test('accumulates reply counts and latencies across multiple reply targets', () => {
		const index = buildRawAnalyticsIndex({
			name: 'Multi target replies chat',
			messages: [
				createMessage({
					id: 1,
					from: 'Bob',
					from_id: 'user2',
					date: '2025-12-14T10:00:00',
					date_unixtime: '1765706400',
					text: 'first'
				}),
				createMessage({
					id: 2,
					from: 'Carol',
					from_id: 'user3',
					date: '2025-12-14T10:01:00',
					date_unixtime: '1765706460',
					text: 'second'
				}),
				createMessage({
					id: 3,
					from: 'Alice',
					from_id: 'user1',
					reply_to_message_id: 1,
					date: '2025-12-14T10:05:00',
					date_unixtime: '1765706700',
					text: 'reply bob'
				}),
				createMessage({
					id: 4,
					from: 'Alice',
					from_id: 'user1',
					reply_to_message_id: 2,
					date: '2025-12-14T10:11:00',
					date_unixtime: '1765707060',
					text: 'reply carol'
				})
			]
		});

		const aliceStats = getTelegramUserStatsById(index, 'user1');

		assert.deepEqual(aliceStats, {
			userId: 'user1',
			userName: 'Alice',
			totalMessages: 2,
			totalMediaMessages: 0,
			imageMessages: 0,
			videoMessages: 0,
			gifMessages: 0,
			stickerMessages: 0,
			otherMessages: 2,
			lowInfoMessages: 0,
			mediaOnlyMessages: 0,
			activeDayCount: 1,
			firstMessageTimestamp: 1765706700000,
			lastMessageTimestamp: 1765707060000,
			totalTextLength: 20,
			averageTextLength: 10,
			repliesSent: 2,
			repliesReceived: 0,
			averageReplyLatencyMs: 7.5 * 60 * 1000
		});
	});

	test('excludes forwarded text from character totals', () => {
		const index = buildRawAnalyticsIndex({
			name: 'Forwarded text stats chat',
			messages: [
				createMessage({
					id: 1,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-14T10:00:00',
					date_unixtime: '1765706400',
					text: 'written here'
				}),
				createMessage({
					id: 2,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-14T10:05:00',
					date_unixtime: '1765706700',
					forwarded_from: 'Channel',
					forwarded_from_id: 'channel1',
					text: 'forwarded payload'
				})
			]
		});

		const aliceStats = getTelegramUserStatsById(index, 'user1');

		assert.equal(aliceStats?.totalMessages, 2);
		assert.equal(aliceStats?.totalMediaMessages, 0);
		assert.equal(aliceStats?.totalTextLength, 'written here'.length);
		assert.equal(aliceStats?.averageTextLength, 'written here'.length / 2);
	});

	test('counts supported media groups even when messages include captions', () => {
		const index = buildRawAnalyticsIndex({
			name: 'Media stats chat',
			messages: [
				createMessage({
					id: 1,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-14T10:00:00',
					date_unixtime: '1765706400',
					photo: 'photo.jpg',
					text: 'caption'
				}),
				createMessage({
					id: 2,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-14T10:05:00',
					date_unixtime: '1765706700',
					file: 'clip.mp4',
					media_type: 'video',
					mime_type: 'video/mp4',
					text: 'clip'
				}),
				createMessage({
					id: 3,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-14T10:10:00',
					date_unixtime: '1765707000',
					file: 'loop.gif',
					media_type: 'animation',
					mime_type: 'image/gif'
				}),
				createMessage({
					id: 4,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-14T10:15:00',
					date_unixtime: '1765707300',
					file: 'sticker.webp',
					media_type: 'sticker',
					mime_type: 'image/webp',
					sticker_emoji: '😄'
				})
			]
		});

		assert.deepEqual(getTelegramUserStatsById(index, 'user1'), {
			userId: 'user1',
			userName: 'Alice',
			totalMessages: 4,
			totalMediaMessages: 4,
			imageMessages: 1,
			videoMessages: 1,
			gifMessages: 1,
			stickerMessages: 1,
			otherMessages: 2,
			lowInfoMessages: 1,
			mediaOnlyMessages: 1,
			activeDayCount: 1,
			firstMessageTimestamp: 1765706400000,
			lastMessageTimestamp: 1765707300000,
			totalTextLength: 'caption'.length + 'clip'.length,
			averageTextLength: ('caption'.length + 'clip'.length) / 4,
			repliesSent: 0,
			repliesReceived: 0,
			averageReplyLatencyMs: null
		});
	});
});