import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildTelegramAnalyticsIndex } from './telegram-analytics-index';
import type { TelegramExportMessage } from './telegram-analysis';

function createMessage(overrides: Partial<TelegramExportMessage> = {}): TelegramExportMessage {
	return {
		type: 'message',
		date: '2025-12-14T14:15:46',
		date_unixtime: '1765710946',
		text: '',
		...overrides
	};
}

describe('buildTelegramAnalyticsIndex', () => {
	test('resolves reply targets and builds directional reply edges', () => {
		const index = buildTelegramAnalyticsIndex({
			name: 'Reply chat',
			messages: [
				createMessage({
					id: 1,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-14T10:00:00',
					date_unixtime: '1765706400',
					text: 'hello'
				}),
				createMessage({
					id: 2,
					from: 'Bob',
					from_id: 'user2',
					reply_to_message_id: 1,
					date: '2025-12-14T10:05:00',
					date_unixtime: '1765706700',
					text: 'reply one'
				}),
				createMessage({
					id: 3,
					from: 'Bob',
					from_id: 'user2',
					reply_to_message_id: 1,
					date: '2025-12-14T10:07:00',
					date_unixtime: '1765706820',
					text: 'reply two'
				})
			]
		});

		assert.equal(index.messages.length, 3);
		assert.equal(index.messageById.get(1)?.senderId, 'user1');
		assert.equal(index.messages[1]?.repliedToUserId, 'user1');
		assert.equal(index.messages[1]?.replyLatencyMs, 5 * 60 * 1000);
		assert.equal(index.messages[2]?.replyLatencyMs, 7 * 60 * 1000);
		assert.equal(index.messagesByUserId.get('user2')?.length, 2);
		assert.equal(index.replyEdges.length, 1);
		assert.deepEqual(index.replyEdges[0], {
			fromUserId: 'user2',
			toUserId: 'user1',
			count: 2,
			totalReplyLatencyMs: 12 * 60 * 1000,
			replyLatencyCount: 2,
			firstReplyTimestamp: 1765706700000,
			lastReplyTimestamp: 1765706820000
		});
	});
});