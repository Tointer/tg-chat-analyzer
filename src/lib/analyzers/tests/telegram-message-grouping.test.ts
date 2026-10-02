import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTelegramAnalyticsIndex } from '../telegram-analytics-index';
import { analyzeTelegramExport } from '../telegram-analysis';
import { getTelegramUserStats, getTelegramUserStatsById } from '../telegram-user-stats';
import { getTelegramUserBestMessagesById } from '../telegram-user-best-messages';
import { getTelegramUserMetricBuckets, getTelegramUserMediaBuckets } from '../telegram-user-message-buckets';
import { getTelegramUserAverageMessagePattern } from '../telegram-user-average-message-pattern';
import { getTelegramReactionStatsSummary } from '../telegram-reaction-stats';
import { aggregateParticipantTimeline } from '../telegram-group-analyzer';
import { prepareTelegramPageData } from '../../server/telegram-page-data';
import type { TelegramExportMessage } from '../telegram-analysis-types';

function message(id: number, sender = 'alice', extra: Partial<TelegramExportMessage> = {}): TelegramExportMessage {
	return { id, type: 'message', from_id: `user${sender}`, from: sender,
		date_unixtime: String(Date.parse('2026-01-05T10:00:00Z') / 1000 + id * 60),
		text: 'hello world', ...extra };
}
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

test('default counts consecutive runs across the whole chat and raw mode restores literal messages', () => {
	const data = { messages: [message(1), message(2), message(3, 'bob'), message(4)] };
	const original = JSON.stringify(data);
	const grouped = buildTelegramAnalyticsIndex(data);
	const raw = buildTelegramAnalyticsIndex(data, { messageCounting: 'raw' });
	assert.equal(grouped.messageCounting, 'consecutive');
	assert.equal(grouped.stats.totalMessages, 3);
	assert.equal(grouped.stats.rawMessageCount, 4);
	assert.equal(raw.stats.totalMessages, 4);
	assert.equal(grouped.messageById.get(1), grouped.messageById.get(2));
	assert.deepEqual(grouped.messages.map((entry) => entry.sourceMessages.map((part) => part.id)), [[1, 2], [3], [4]]);
	assert.equal(getTelegramUserStatsById(grouped, 'useralice')?.totalMessages, 2);
	assert.equal(getTelegramUserStatsById(raw, 'useralice')?.totalMessages, 3);
	assert.equal(JSON.stringify(data), original);
	assert.equal(analyzeTelegramExport(data).totalMessages, 3);
	assert.equal(analyzeTelegramExport(data, { messageCounting: 'raw' }).totalMessages, 4);
});

test('services and unknown senders break runs, while empty messages by the same sender do not', () => {
	const index = buildTelegramAnalyticsIndex({ messages: [message(1), message(2, 'alice', { text: '' }),
		message(3), message(4, 'alice', { type: 'service', action: 'pin_message' }), message(5),
		message(6, 'alice', { from_id: undefined }), message(7, 'alice', { from_id: undefined }), message(8)] });
	assert.deepEqual(index.messages.map((entry) => entry.sourceMessages.map((part) => part.id)), [[1, 2, 3], [4], [5], [6], [7], [8]]);
	assert.equal(index.stats.totalMessages, 5);
});

test('groups have no time cutoff, start in the first bucket and preserve the full export range', () => {
	const data = { messages: [message(1, 'alice', { date_unixtime: String(Date.parse('2026-01-05T23:59:00Z') / 1000) }),
		message(2, 'alice', { date_unixtime: String(Date.parse('2026-01-06T12:00:00Z') / 1000) }),
		message(3, 'alice', { date_unixtime: String(Date.parse('2026-01-07T00:00:00Z') / 1000) })] };
	const index = buildTelegramAnalyticsIndex(data);
	assert.equal(index.stats.totalMessages, 1);
	assert.equal(index.messages[0].dayLabel, '2026-01-05');
	assert.equal(index.stats.dateRange.end, Date.parse('2026-01-07T00:00:00Z'));
	assert.equal(getTelegramUserStatsById(index, 'useralice')?.lastMessageTimestamp, index.stats.dateRange.end);
	assert.deepEqual(aggregateParticipantTimeline(index).labels, ['2026-01-05', '2026-01-06', '2026-01-07']);
	const buckets = getTelegramUserMetricBuckets(index, 'useralice', { unit: 'day' }, {
		startTimestamp: index.stats.dateRange.start!, endTimestamp: index.stats.dateRange.end! });
	assert.deepEqual(buckets.nonReplyValues, [1, 0, 0]);
	const hourly = getTelegramUserAverageMessagePattern(index, 'useralice', 'day');
	assert.equal(hourly.values[0], 0);
	assert.equal(hourly.values[12], 0);
	assert.equal(hourly.values[23], 0.5);
});

test('mixed media runs count once per kind and preserve authored characters and reactions', () => {
	const data = { messages: [message(1, 'alice', { photo: 'a.jpg', reactions: [{ emoji: '👍', count: 2 }] }),
		message(2, 'alice', { photo: 'b.jpg', text: 'more words', reactions: [{ emoji: '👍', count: 3 }] }),
		message(3, 'alice', { text: '', file: 'a.mp4', media_type: 'video_file' }),
		message(4, 'alice', { text: 'forwarded words', forwarded_from: 'channel' })] };
	const index = buildTelegramAnalyticsIndex(data);
	const raw = buildTelegramAnalyticsIndex(data, { messageCounting: 'raw' });
	const stats = getTelegramUserStatsById(index, 'useralice')!;
	assert.equal(stats.totalMessages, 1);
	assert.equal(stats.totalMediaMessages, 1);
	assert.equal(stats.imageMessages, 1);
	assert.equal(stats.videoMessages, 1);
	assert.equal(stats.totalTextLength, getTelegramUserStatsById(raw, 'useralice')?.totalTextLength);
	assert.equal(stats.averageTextLength, stats.totalTextLength);
	assert.deepEqual(getTelegramReactionStatsSummary(index).reactionsByEmoji, [{ emoji: '👍', count: 5 }]);
	assert.equal(getTelegramReactionStatsSummary(index).messagesWithReactions, 1);
	assert.equal(getTelegramUserBestMessagesById(index, 'useralice')?.mostReactions[0].reactionCount, 5);
	const media = getTelegramUserMediaBuckets(index, 'useralice', { unit: 'day' });
	assert.equal(sum(media.series!.find((entry) => entry.key === 'image')!.values), 1);
	assert.equal(sum(media.series!.find((entry) => entry.key === 'video')!.values), 1);
	const characters = getTelegramUserMetricBuckets(index, 'useralice', { unit: 'day' }, undefined, 'characters');
	assert.equal(sum(characters.replyValues) + sum(characters.nonReplyValues), stats.totalTextLength);
});

test('reply aliases deduplicate repeated targets, keep multiple recipients and use actual raw timestamps', () => {
	const index = buildTelegramAnalyticsIndex({ messages: [message(1), message(2), message(3, 'bob'),
		message(4, 'carol', { reply_to_message_id: 2 }), message(5, 'carol', { reply_to_message_id: 1 }),
		message(6, 'carol', { reply_to_message_id: 3 }), message(7, 'carol', { reply_to_message_id: 4 })] });
	const carol = index.messageById.get(4)!;
	assert.deepEqual(carol.replies.map((reply) => reply.targetId), [1, 3]);
	assert.equal(carol.replies[0].latencyMs, 120_000);
	assert.equal(getTelegramUserStatsById(index, 'usercarol')?.repliesSent, 1);
	assert.equal(getTelegramUserStatsById(index, 'useralice')?.repliesReceived, 1);
	assert.equal(getTelegramUserStatsById(index, 'userbob')?.repliesReceived, 1);
	assert.equal(index.replyEdges.length, 2);
	const best = getTelegramUserBestMessagesById(index, 'useralice')!.mostReplies[0];
	assert.equal(best.messageId, 1);
	assert.equal(best.replyCount, 1);
	assert.equal(best.replies.length, 1);
	assert.equal(best.replies[0].preview, 'hello world hello world hello world hello world');
});

test('unresolved targets count as sent replies once per group', () => {
	const index = buildTelegramAnalyticsIndex({ messages: [message(1, 'alice', { reply_to_message_id: 999 }),
		message(2, 'alice', { reply_to_message_id: 999 })] });
	assert.equal(index.messages[0].replies.length, 1);
	assert.equal(getTelegramUserStatsById(index, 'useralice')?.repliesSent, 1);
	assert.equal(index.replyEdges.length, 0);
	assert.equal(analyzeTelegramExport({ messages: index.messages[0].sourceMessages }).replyMessages, 1);
});

test('ignored blank records do not introduce reactions when joined with counted messages', () => {
	const data = { messages: [message(1, 'alice', { text: '', reactions: [{ emoji: '👍', count: 2 }] }),
		message(2, 'alice', { reactions: [{ emoji: '👍', count: 3 }] })] };
	const grouped = buildTelegramAnalyticsIndex(data);
	const raw = buildTelegramAnalyticsIndex(data, { messageCounting: 'raw' });
	assert.equal(grouped.stats.totalReactions, raw.stats.totalReactions);
	assert.deepEqual(getTelegramReactionStatsSummary(grouped).reactionsByEmoji, [{ emoji: '👍', count: 3 }]);
});

test('chronological ordering happens before grouping, preserving export order for equal timestamps', () => {
	const timestamp = '1767607200';
	const index = buildTelegramAnalyticsIndex({ messages: [message(3, 'bob', { date_unixtime: timestamp }),
		message(2, 'alice', { date_unixtime: timestamp }), message(1, 'alice', { date_unixtime: timestamp })] });
	assert.deepEqual(index.messages.map((entry) => entry.sourceMessages.map((part) => part.id)), [[3], [2, 1]]);
});

test('server page data uses one counting mode for totals and every user chart, with no raw per-user metric', () => {
	const data = { messages: [message(1), message(2), message(3, 'bob'), message(4)] };
	for (const mode of ['consecutive', 'raw'] as const) {
		const page = prepareTelegramPageData(data, mode);
		const index = buildTelegramAnalyticsIndex(data, { messageCounting: mode });
		assert.equal(page.periodReports.day.totalMessages, index.stats.totalMessages);
		assert.equal(page.periodReports.day.rawMessageCount, 4);
		for (const card of page.userInfoCards) {
			const stats = getTelegramUserStats(index).find((user) => user.userId === card.userId)!;
			assert.equal(card.metrics.messages.totalValue, stats.totalMessages);
			const chart = card.metrics.messages.messageBucketsByPeriod.day;
			assert.equal(sum(chart.replyValues) + sum(chart.nonReplyValues), stats.totalMessages);
			assert.deepEqual(Object.keys(card.metrics), ['messages', 'characters', 'media']);
		}
	}
});
