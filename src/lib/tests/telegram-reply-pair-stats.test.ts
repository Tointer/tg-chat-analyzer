import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildTelegramAnalyticsIndex } from '../telegram-analytics-index';
import {
	getTelegramReplyPairStats,
	getTelegramReplyPairStatsByUsers
} from '../telegram-reply-pair-stats';
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

describe('getTelegramReplyPairStats', () => {
	test('builds named directional pair stats from reply edges', () => {
		const index = buildTelegramAnalyticsIndex({
			name: 'Pair stats chat',
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
					date: '2025-12-14T10:01:00',
					date_unixtime: '1765706460',
					text: 'hey'
				}),
				createMessage({
					id: 3,
					from: 'Carol',
					from_id: 'user3',
					date: '2025-12-14T10:02:00',
					date_unixtime: '1765706520',
					text: 'yo'
				}),
				createMessage({
					id: 4,
					from: 'Bob',
					from_id: 'user2',
					reply_to_message_id: 1,
					date: '2025-12-14T10:05:00',
					date_unixtime: '1765706700',
					text: 'reply a1'
				}),
				createMessage({
					id: 5,
					from: 'Bob',
					from_id: 'user2',
					reply_to_message_id: 1,
					date: '2025-12-14T10:07:00',
					date_unixtime: '1765706820',
					text: 'reply a2'
				}),
				createMessage({
					id: 6,
					from: 'Alice',
					from_id: 'user1',
					reply_to_message_id: 2,
					date: '2025-12-14T10:08:00',
					date_unixtime: '1765706880',
					text: 'reply b1'
				}),
				createMessage({
					id: 7,
					from: 'Alice',
					from_id: 'user1',
					reply_to_message_id: 3,
					date: '2025-12-14T10:10:00',
					date_unixtime: '1765707000',
					text: 'reply c1'
				})
			]
		});

		const firstStats = getTelegramReplyPairStats(index);
		const secondStats = getTelegramReplyPairStats(index);

		assert.equal(firstStats, secondStats);
		assert.deepEqual(firstStats, [
			{
				fromUserId: 'user2',
				fromUserName: 'Bob',
				toUserId: 'user1',
				toUserName: 'Alice',
				replyCount: 2,
				totalReplyLatencyMs: 12 * 60 * 1000,
				averageReplyLatencyMs: 6 * 60 * 1000,
				firstReplyTimestamp: 1765706700000,
				lastReplyTimestamp: 1765706820000
			},
			{
				fromUserId: 'user1',
				fromUserName: 'Alice',
				toUserId: 'user3',
				toUserName: 'Carol',
				replyCount: 1,
				totalReplyLatencyMs: 8 * 60 * 1000,
				averageReplyLatencyMs: 8 * 60 * 1000,
				firstReplyTimestamp: 1765707000000,
				lastReplyTimestamp: 1765707000000
			},
			{
				fromUserId: 'user1',
				fromUserName: 'Alice',
				toUserId: 'user2',
				toUserName: 'Bob',
				replyCount: 1,
				totalReplyLatencyMs: 7 * 60 * 1000,
				averageReplyLatencyMs: 7 * 60 * 1000,
				firstReplyTimestamp: 1765706880000,
				lastReplyTimestamp: 1765706880000
			}
		]);

		assert.deepEqual(getTelegramReplyPairStatsByUsers(index, 'user2', 'user1'), firstStats[0]);
		assert.equal(getTelegramReplyPairStatsByUsers(index, 'user3', 'user1'), undefined);
	});
});