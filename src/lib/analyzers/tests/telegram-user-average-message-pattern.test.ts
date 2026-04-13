import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildTelegramAnalyticsIndex } from '../telegram-analytics-index';
import { getTelegramUserAverageMessagePattern } from '../telegram-user-average-message-pattern';
import type { TelegramExportMessage } from '../telegram-analysis';

function createMessage(overrides: Partial<TelegramExportMessage> = {}): TelegramExportMessage {
	return {
		type: 'message',
		date: '2025-12-14T14:15:46',
		date_unixtime: '1765710946',
		text: 'hello',
		...overrides
	};
}

describe('getTelegramUserAverageMessagePattern', () => {
	test('averages messages by UTC hour across active days', () => {
		const index = buildTelegramAnalyticsIndex({
			name: 'Hourly average chat',
			messages: [
				createMessage({
					id: 1,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-15T10:05:00',
					date_unixtime: '1765793100'
				}),
				createMessage({
					id: 2,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-15T10:25:00',
					date_unixtime: '1765794300'
				}),
				createMessage({
					id: 3,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-16T10:15:00',
					date_unixtime: '1765879500'
				}),
				createMessage({
					id: 4,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-16T13:15:00',
					date_unixtime: '1765890900'
				})
			]
		});

		const chart = getTelegramUserAverageMessagePattern(index, 'user1', 'day');

		assert.equal(chart.title, 'Average messages by hour');
		assert.equal(chart.labels.length, 24);
		assert.equal(chart.values[10], 1.5);
		assert.equal(chart.values[13], 0.5);
		assert.equal(chart.peakLabel, '10:00');
		assert.equal(chart.peakValue, 1.5);
	});

	test('averages messages by weekday using active membership days as denominators', () => {
		const index = buildTelegramAnalyticsIndex({
			name: 'Weekday average chat',
			messages: [
				{
					type: 'service',
					actor: 'Alice',
					actor_id: 'user1',
					action: 'join_group_by_link',
					date: '2025-12-15T00:00:00',
					date_unixtime: '1765756800'
				},
				createMessage({
					id: 1,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-15T10:00:00',
					date_unixtime: '1765792800'
				}),
				createMessage({
					id: 2,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-16T10:00:00',
					date_unixtime: '1765879200'
				}),
				createMessage({
					id: 3,
					from: 'Alice',
					from_id: 'user1',
					date: '2025-12-22T10:00:00',
					date_unixtime: '1766397600'
				}),
				{
					type: 'service',
					actor: 'Admin',
					actor_id: 'user9',
					action: 'remove_members',
					members: ['Alice'],
					date: '2025-12-23T12:00:00',
					date_unixtime: '1766491200'
				}
			]
		});

		const chart = getTelegramUserAverageMessagePattern(index, 'user1', 'week');

		assert.equal(chart.title, 'Average messages by weekday');
		assert.deepEqual(chart.labels, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
		assert.equal(chart.values[0], 1);
		assert.equal(chart.values[1], 0.5);
		assert.equal(chart.peakLabel, 'Mon');
		assert.equal(chart.peakValue, 1);
	});
});