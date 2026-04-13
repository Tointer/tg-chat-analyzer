import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildTelegramAnalyticsIndex } from '../telegram-analytics-index';
import {
	getTelegramUserBestMessages,
	getTelegramUserBestMessagesById
} from '../telegram-user-best-messages';
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

describe('getTelegramUserBestMessages', () => {
	test('returns top authored messages by received reactions and replies', () => {
		const index = buildTelegramAnalyticsIndex({
			name: 'Best messages chat',
			messages: [
				...Array.from({ length: 12 }, (_, index) => {
					const messageNumber = index + 1;
					const timestampSeconds = 1765706400 + index * 60;

					return createMessage({
						id: messageNumber,
						from: 'Alice',
						from_id: 'user1',
						date: `2025-12-14T10:${String(index).padStart(2, '0')}:00`,
						date_unixtime: String(timestampSeconds),
						text: `message ${messageNumber}`,
						reactions: [{ emoji: '🔥', count: 20 - index }]
					});
				}),
				createMessage({
					id: 100,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-14T10:30:00',
					date_unixtime: '1765708200',
					forwarded_from: 'News Channel',
					photo: 'photo.jpg',
					reactions: [{ emoji: '❤️', count: 4 }]
				}),
				createMessage({
					id: 200,
					from: 'Bob',
					from_id: 'user2',
					reply_to_message_id: 100,
					date: '2025-12-14T10:31:00',
					date_unixtime: '1765708260',
					text: 'reply one'
				}),
				createMessage({
					id: 201,
					from: 'Carol',
					from_id: 'user3',
					reply_to_message_id: 100,
					date: '2025-12-14T10:32:00',
					date_unixtime: '1765708320',
					text: 'reply two'
				}),
				createMessage({
					id: 202,
					from: 'Dave',
					from_id: 'user4',
					reply_to_message_id: 100,
					date: '2025-12-14T10:33:00',
					date_unixtime: '1765708380',
					text: 'reply three'
				}),
				createMessage({
					id: 203,
					from: 'Bob',
					from_id: 'user2',
					reply_to_message_id: 3,
					date: '2025-12-14T10:34:00',
					date_unixtime: '1765708440',
					text: 'reply to third'
				}),
				createMessage({
					id: 204,
					from: 'Carol',
					from_id: 'user3',
					reply_to_message_id: 3,
					date: '2025-12-14T10:35:00',
					date_unixtime: '1765708500',
					text: 'reply to third again'
				}),
				createMessage({
					id: 205,
					from: 'Bob',
					from_id: 'user2',
					reply_to_message_id: 1,
					date: '2025-12-14T10:36:00',
					date_unixtime: '1765708560',
					text: 'reply to first'
				})
			]
		});

		const aliceBestMessages = getTelegramUserBestMessagesById(index, 'user1');

		assert.equal(aliceBestMessages?.mostReactions.length, 10);
		assert.deepEqual(
			aliceBestMessages?.mostReactions.slice(0, 3).map((message) => message.messageId),
			[1, 2, 3]
		);
		assert.equal(aliceBestMessages?.mostReplies[0]?.messageId, 100);
		assert.equal(aliceBestMessages?.mostReplies[0]?.authorName, 'Alice');
		assert.equal(aliceBestMessages?.mostReplies[0]?.forwardedFrom, 'News Channel');
		assert.equal(aliceBestMessages?.mostReplies[0]?.replyCount, 3);
		assert.equal(aliceBestMessages?.mostReplies[0]?.preview, 'Photo');
		assert.deepEqual(aliceBestMessages?.mostReplies[0]?.replies, [
			{ messageId: 200, authorName: 'Bob', preview: 'reply one' },
			{ messageId: 201, authorName: 'Carol', preview: 'reply two' },
			{ messageId: 202, authorName: 'Dave', preview: 'reply three' }
		]);
		assert.equal(aliceBestMessages?.mostReplies[1]?.messageId, 3);
		assert.equal(aliceBestMessages?.mostReplies[1]?.replyCount, 2);
	});

	test('reuses cached summaries and returns undefined for missing users', () => {
		const index = buildTelegramAnalyticsIndex({
			name: 'Cached best messages chat',
			messages: [
				createMessage({
					id: 1,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-14T10:00:00',
					date_unixtime: '1765706400',
					text: 'hello',
					reactions: [{ emoji: '🔥', count: 1 }]
				})
			]
		});

		const firstSummary = getTelegramUserBestMessages(index);
		const secondSummary = getTelegramUserBestMessages(index);

		assert.equal(firstSummary, secondSummary);
		assert.equal(getTelegramUserBestMessagesById(index, 'missing-user'), undefined);
	});
});