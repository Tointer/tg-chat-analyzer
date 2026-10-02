import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildRawAnalyticsIndex } from './raw-analysis-helpers';
import {
	getTelegramUserReplyFavorites,
	getTelegramUserReplyFavoritesSummary
} from '../telegram-user-reply-favorites';
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

describe('getTelegramUserReplyFavorites', () => {
	test('ranks reply favorites using overlap-aware expected replies', () => {
		const index = buildRawAnalyticsIndex({
			name: 'Reply favorites chat',
			messages: [
				createMessage({
					id: 1,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-13T09:00:00',
					date_unixtime: '1765616400',
					text: 'alice before bob'
				}),
				createMessage({
					id: 2,
					from: 'Carol',
					from_id: 'user3',
					date: '2025-12-13T10:00:00',
					date_unixtime: '1765620000',
					text: 'carol before bob'
				}),
				createMessage({
					id: 3,
					from: 'Bob',
					from_id: 'user2',
					date: '2025-12-14T09:00:00',
					date_unixtime: '1765702800',
					text: 'bob arrives'
				}),
				createMessage({
					id: 4,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-14T10:00:00',
					date_unixtime: '1765706400',
					text: 'alice overlap'
				}),
				createMessage({
					id: 5,
					from: 'Carol',
					from_id: 'user3',
					date: '2025-12-14T10:15:00',
					date_unixtime: '1765707300',
					text: 'carol overlap'
				}),
				createMessage({
					id: 6,
					from: 'Bob',
					from_id: 'user2',
					reply_to_message_id: 4,
					date: '2025-12-14T10:20:00',
					date_unixtime: '1765707600',
					text: 'reply alice once'
				}),
				createMessage({
					id: 7,
					from: 'Bob',
					from_id: 'user2',
					reply_to_message_id: 5,
					date: '2025-12-14T10:30:00',
					date_unixtime: '1765708200',
					text: 'reply carol once'
				}),
				{
					type: 'service',
					actor: 'Admin',
					actor_id: 'admin1',
					action: 'remove_members',
					members: ['Carol'],
					date: '2025-12-15T08:00:00',
					date_unixtime: '1765785600'
				},
				createMessage({
					id: 8,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-15T09:00:00',
					date_unixtime: '1765789200',
					text: 'alice after carol left'
				}),
				createMessage({
					id: 9,
					from: 'Dave',
					from_id: 'user4',
					date: '2025-12-15T09:30:00',
					date_unixtime: '1765791000',
					text: 'dave joins with a message'
				}),
				createMessage({
					id: 10,
					from: 'Bob',
					from_id: 'user2',
					reply_to_message_id: 8,
					date: '2025-12-15T10:00:00',
					date_unixtime: '1765792800',
					text: 'reply alice twice'
				}),
				createMessage({
					id: 11,
					from: 'Bob',
					from_id: 'user2',
					reply_to_message_id: 8,
					date: '2025-12-15T10:05:00',
					date_unixtime: '1765793100',
					text: 'reply alice third time'
				})
			]
		});

		const favorites = getTelegramUserReplyFavorites(index, 'user2');

		assert.equal(favorites[0]?.targetUserId, 'user1');
		assert.equal(favorites[0]?.observedReplies, 3);
		assert.equal(favorites[0]?.overlapReplyCount, 4);
		assert.equal(favorites[0]?.overlapTargetMessageCount, 2);
		assert.equal(favorites[0]?.overlapMessageCount, 9);
		assert.ok(Math.abs((favorites[0]?.expectedReplies ?? 0) - 8 / 9) < 1e-9);
		assert.ok(Math.abs((favorites[0]?.residual ?? 0) - 19 / 9) < 1e-9);

		assert.equal(favorites[1]?.targetUserId, 'user3');
		assert.equal(favorites[1]?.observedReplies, 1);
		assert.equal(favorites[1]?.overlapReplyCount, 2);
		assert.equal(favorites[1]?.overlapTargetMessageCount, 1);
		assert.equal(favorites[1]?.overlapMessageCount, 5);
		assert.equal(favorites[1]?.expectedReplies, 0.4);
		assert.equal(favorites[1]?.residual, 0.6);

		const summary = getTelegramUserReplyFavoritesSummary(index, 'user2');

		assert.equal(summary.repliesSent, 4);
		assert.equal(summary.favorites[0]?.targetUserName, 'Alice');
		assert.ok(Math.abs(summary.bestFavoriteResidual - 19 / 9) < 1e-9);
	});
});