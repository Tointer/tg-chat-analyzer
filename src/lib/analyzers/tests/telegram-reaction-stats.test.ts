import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildTelegramAnalyticsIndex } from '../telegram-analytics-index';
import { getTelegramReactionStatsSummary } from '../telegram-reaction-stats';
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

describe('getTelegramReactionStatsSummary', () => {
	test('summarizes total reactions and emoji counts across non-ignored messages', () => {
		const index = buildTelegramAnalyticsIndex({
			name: 'Reaction chat',
			messages: [
				createMessage({
					id: 1,
					text: 'hello',
					reactions: [
						{ type: 'emoji', emoji: '🔥', count: 2 },
						{ type: 'emoji', emoji: '😁', count: 1 }
					]
				}),
				createMessage({
					id: 2,
					text: 'world',
					reactions: [{ type: 'emoji', emoji: '🔥', count: 3 }]
				}),
				{ type: 'service', date: '2025-12-14T14:30:00', date_unixtime: '1765711800' }
			]
		});

		assert.deepEqual(getTelegramReactionStatsSummary(index), {
			totalReactions: 6,
			messagesWithReactions: 2,
			uniqueReactionEmojis: 2,
			reactionsByEmoji: [
				{ emoji: '🔥', count: 5 },
				{ emoji: '😁', count: 1 }
			]
		});
	});
});