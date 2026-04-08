import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildTelegramAnalyticsIndex } from '../telegram-analytics-index';
import {
	getTelegramUserMessageBuckets,
	getTelegramUserMetricBuckets
} from '../telegram-user-message-buckets';
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

describe('getTelegramUserMessageBuckets', () => {
	test('fills leading and trailing buckets for a user when a wider time range is supplied', () => {
		const index = buildTelegramAnalyticsIndex({
			name: 'User range chat',
			messages: [
				{
					type: 'service',
					actor: 'Admin',
					actor_id: 'user9',
					action: 'create_group',
					date: '2025-12-13T09:00:00',
					date_unixtime: '1765616400',
					members: ['Admin']
				},
				createMessage({
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-14T09:00:00',
					date_unixtime: '1765702800',
					text: 'first'
				}),
				createMessage({
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-16T09:00:00',
					date_unixtime: '1765875600',
					photo: 'photo.jpg'
				}),
				{
					type: 'service',
					actor: 'Admin',
					actor_id: 'user9',
					action: 'remove_members',
					members: ['Admin'],
					date: '2025-12-17T09:00:00',
					date_unixtime: '1765962000'
				}
			]
		});

		const buckets = getTelegramUserMessageBuckets(index, 'user1', { unit: 'day', size: 1 }, {
			startTimestamp: index.stats.dateRange.start ?? undefined,
			endTimestamp: index.stats.dateRange.end ?? undefined
		});

		assert.deepEqual(buckets.labels, [
			'2025-12-13',
			'2025-12-14',
			'2025-12-15',
			'2025-12-16',
			'2025-12-17'
		]);
		assert.deepEqual(buckets.otherValues, [0, 1, 0, 0, 0]);
		assert.deepEqual(buckets.lowInfoValues, [0, 0, 0, 0, 0]);
		assert.deepEqual(buckets.mediaOnlyValues, [0, 0, 0, 1, 0]);
	});

	test('supports character-weighted buckets for the same user range', () => {
		const index = buildTelegramAnalyticsIndex({
			name: 'User character range chat',
			messages: [
				createMessage({
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-14T09:00:00',
					date_unixtime: '1765702800',
					text: 'hello'
				}),
				createMessage({
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-16T09:00:00',
					date_unixtime: '1765875600',
					forwarded_from: 'Channel',
					forwarded_from_id: 'channel1',
					text: 'ok'
				})
			]
		});

		const buckets = getTelegramUserMetricBuckets(
			index,
			'user1',
			{ unit: 'day', size: 1 },
			{
				startTimestamp: Date.parse('2025-12-13T00:00:00Z'),
				endTimestamp: Date.parse('2025-12-17T23:59:59Z')
			},
			'characters'
		);

		assert.equal(buckets.title, 'Characters per day');
		assert.deepEqual(buckets.labels, [
			'2025-12-13',
			'2025-12-14',
			'2025-12-15',
			'2025-12-16',
			'2025-12-17'
		]);
		assert.deepEqual(buckets.otherValues, [0, 5, 0, 0, 0]);
		assert.deepEqual(buckets.lowInfoValues, [0, 0, 0, 0, 0]);
		assert.deepEqual(buckets.mediaOnlyValues, [0, 0, 0, 0, 0]);
	});
});