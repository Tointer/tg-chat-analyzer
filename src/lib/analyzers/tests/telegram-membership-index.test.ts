import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildRawAnalyticsIndex } from './raw-analysis-helpers';
import {
	areUsersCoPresentAtTimestamp,
	getMembershipIntervalsForUser,
	isUserActiveAtTimestamp
} from '../telegram-membership-index';
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

describe('membership interval indexing', () => {
	test('starts membership from join events or first message and ends it on remove events', () => {
		const index = buildRawAnalyticsIndex({
			name: 'Membership chat',
			messages: [
				{
					type: 'service',
					actor: 'Alice',
					actor_id: 'user1',
					action: 'join_group_by_link',
					date: '2025-12-14T10:00:00',
					date_unixtime: '1765706400'
				},
				createMessage({
					id: 2,
					from: 'Bob',
					from_id: 'user2',
					date: '2025-12-14T10:05:00',
					date_unixtime: '1765706700',
					text: 'first message'
				}),
				{
					type: 'service',
					actor: 'Admin',
					actor_id: 'user9',
					action: 'remove_members',
					members: ['Alice'],
					date: '2025-12-14T10:10:00',
					date_unixtime: '1765707000'
				},
				{
					type: 'service',
					actor: 'Alice',
					actor_id: 'user1',
					action: 'join_group_by_link',
					date: '2025-12-14T10:20:00',
					date_unixtime: '1765707600'
				}
			]
		});

		assert.deepEqual(getMembershipIntervalsForUser(index, 'user1'), [
			{
				startTimestamp: 1765706400000,
				endTimestamp: 1765707000000,
				startReason: 'service-join',
				endReason: 'left-or-kicked'
			},
			{
				startTimestamp: 1765707600000,
				endTimestamp: null,
				startReason: 'service-join',
				endReason: null
			}
		]);

		assert.deepEqual(getMembershipIntervalsForUser(index, 'user2'), [
			{
				startTimestamp: 1765706700000,
				endTimestamp: null,
				startReason: 'first-message',
				endReason: null
			}
		]);

		assert.equal(isUserActiveAtTimestamp(index, 'user1', 1765706400000), true);
		assert.equal(isUserActiveAtTimestamp(index, 'user1', 1765707000000), false);
		assert.equal(isUserActiveAtTimestamp(index, 'user1', 1765707600000), true);
	});

	test('backdates membership start to invite events once the invited user sends a first message', () => {
		const index = buildRawAnalyticsIndex({
			name: 'Invite chat',
			messages: [
				{
					type: 'service',
					actor: 'Admin',
					actor_id: 'user9',
					action: 'invite_members',
					members: ['Bob'],
					date: '2025-12-14T10:00:00',
					date_unixtime: '1765706400'
				},
				createMessage({
					id: 2,
					from: 'Bob',
					from_id: 'user2',
					date: '2025-12-14T10:05:00',
					date_unixtime: '1765706700',
					text: 'hello'
				})
			]
		});

		assert.deepEqual(getMembershipIntervalsForUser(index, 'user2'), [
			{
				startTimestamp: 1765706400000,
				endTimestamp: null,
				startReason: 'service-join',
				endReason: null
			}
		]);
	});

	test('checks pairwise co-presence using the indexed intervals', () => {
		const index = buildRawAnalyticsIndex({
			name: 'Co-presence chat',
			messages: [
				{
					type: 'service',
					actor: 'Alice',
					actor_id: 'user1',
					action: 'join_group_by_link',
					date: '2025-12-14T10:00:00',
					date_unixtime: '1765706400'
				},
				createMessage({
					id: 2,
					from: 'Bob',
					from_id: 'user2',
					date: '2025-12-14T10:05:00',
					date_unixtime: '1765706700',
					text: 'hello'
				}),
				{
					type: 'service',
					actor: 'Admin',
					actor_id: 'user9',
					action: 'remove_members',
					members: ['Alice'],
					date: '2025-12-14T10:10:00',
					date_unixtime: '1765707000'
				}
			]
		});

		assert.equal(areUsersCoPresentAtTimestamp(index, 'user1', 'user2', 1765706699000), false);
		assert.equal(areUsersCoPresentAtTimestamp(index, 'user1', 'user2', 1765706700000), true);
		assert.equal(areUsersCoPresentAtTimestamp(index, 'user1', 'user2', 1765706999000), true);
		assert.equal(areUsersCoPresentAtTimestamp(index, 'user1', 'user2', 1765707000000), false);
	});
});