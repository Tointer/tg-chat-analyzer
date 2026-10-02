import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeTelegramAnalyticsIndex, type TelegramExportMessage } from '../telegram-analysis';
import { buildTelegramAnalyticsIndex } from '../telegram-analytics-index';
import { getTelegramUserAverageMessagePattern } from '../telegram-user-average-message-pattern';
import { getTelegramUserStatsById } from '../telegram-user-stats';
import { getTelegramUserMediaBuckets } from '../telegram-user-message-buckets';
import { getMembershipIntervalsForUser } from '../telegram-membership-index';

function message(id: number, date: string, extra: Partial<TelegramExportMessage> = {}): TelegramExportMessage {
	return { id, date, type: 'message', from_id: 'user1', from: 'Alice', text: 'Hello world', ...extra };
}

test('single-message users have nonzero hourly and weekday averages', () => {
	const index = buildTelegramAnalyticsIndex({ messages: [message(1, '2026-01-05T12:00:00Z')] });
	assert.equal(getTelegramUserAverageMessagePattern(index, 'user1', 'day').values[12], 1);
	assert.equal(getTelegramUserAverageMessagePattern(index, 'user1', 'week').values[0], 1);
});

test('last export message at midnight contributes to the final day and hour', () => {
	const index = buildTelegramAnalyticsIndex({ messages: [
		message(1, '2026-01-05T12:00:00Z'), message(2, '2026-01-06T00:00:00Z')
	] });
	assert.equal(getTelegramUserAverageMessagePattern(index, 'user1', 'day').values[0], 1);
	assert.equal(getTelegramUserAverageMessagePattern(index, 'user1', 'week').values[1], 1);
});

test('membership removal remains exclusive at midnight', () => {
	const index = buildTelegramAnalyticsIndex({ messages: [
		message(1, '2026-01-05T12:00:00Z'),
		{ type: 'service', date: '2026-01-06T00:00:00Z', action: 'remove_members', members: ['Alice'] }
	] });
	assert.equal(getTelegramUserAverageMessagePattern(index, 'user1', 'week').values[0], 1);
	assert.equal(getTelegramUserAverageMessagePattern(index, 'user1', 'week').values[1], 0);
});

test('unresolved replies count as sent without fabricating received replies or latency', () => {
	const index = buildTelegramAnalyticsIndex({ messages: [message(1, '2026-01-05T12:00:00Z', { reply_to_message_id: 999 })] });
	const stats = getTelegramUserStatsById(index, 'user1');
	assert.equal(stats?.repliesSent, 1);
	assert.equal(stats?.repliesReceived, 0);
	assert.equal(stats?.averageReplyLatencyMs, null);
	assert.equal(analyzeTelegramAnalyticsIndex(index).replyMessages, 1);
});

test('ignored messages do not inflate user activity or reply relationships', () => {
	const index = buildTelegramAnalyticsIndex({ messages: [
		message(1, '2026-01-05T12:00:00Z'),
		message(2, '2026-01-06T12:00:00Z', { text: '', reply_to_message_id: 1 })
	] });
	const stats = getTelegramUserStatsById(index, 'user1');
	assert.equal(stats?.totalMessages, 1);
	assert.equal(stats?.activeDayCount, 1);
	assert.equal(stats?.repliesSent, 0);
	assert.equal(stats?.repliesReceived, 0);
});

test('audio, documents and video messages agree across totals and media charts', () => {
	const index = buildTelegramAnalyticsIndex({ messages: [
		message(1, '2026-01-05T12:00:00Z', { text: '', media_type: 'voice_message', mime_type: 'audio/ogg', file: 'voice.ogg' }),
		message(2, '2026-01-05T13:00:00Z', { text: '', media_type: 'audio_file', mime_type: 'audio/mpeg', file: 'song.mp3' }),
		message(3, '2026-01-05T14:00:00Z', { text: '', mime_type: 'application/pdf', file: 'document.pdf' }),
		message(4, '2026-01-05T15:00:00Z', { text: '', media_type: 'video_message' })
	] });
	const report = analyzeTelegramAnalyticsIndex(index);
	assert.equal(report.totalMessages, 4);
	assert.equal(report.totalMediaMessages, 4);
	assert.equal(getTelegramUserStatsById(index, 'user1')?.totalMediaMessages, 4);
	const chart = getTelegramUserMediaBuckets(index, 'user1', { unit: 'day' });
	assert.deepEqual(chart.series?.find((series) => series.key === 'audio')?.values, [2]);
	assert.deepEqual(chart.series?.find((series) => series.key === 'document')?.values, [1]);
	assert.deepEqual(chart.series?.find((series) => series.key === 'video')?.values, [1]);
});

test('participant chart includes invited users before their first message', () => {
	const index = buildTelegramAnalyticsIndex({ messages: [
		{ type: 'service', date: '2026-01-05T10:00:00Z', action: 'invite_members', actor_id: 'user9', actor: 'Admin', members: ['Alice'] },
		message(1, '2026-01-06T12:00:00Z'),
		{ type: 'service', date: '2026-01-07T10:00:00Z', action: 'remove_members', actor_id: 'user9', actor: 'Admin', members: ['Alice'] }
	] });
	assert.deepEqual(analyzeTelegramAnalyticsIndex(index).participantTimeline.values, [2, 2, 1]);
	assert.equal(getMembershipIntervalsForUser(index, 'user1')[0].startTimestamp, Date.parse('2026-01-05T10:00:00Z'));
});

test('ambiguous display names do not join or remove multiple distinct users', () => {
	const index = buildTelegramAnalyticsIndex({ messages: [
		{ type: 'service', date: '2026-01-05T10:00:00Z', action: 'invite_members', members: ['Alice'] },
		message(1, '2026-01-06T12:00:00Z'),
		message(2, '2026-01-06T13:00:00Z', { from_id: 'user2' }),
		{ type: 'service', date: '2026-01-07T10:00:00Z', action: 'remove_members', members: ['Alice'] }
	] });
	assert.equal(getMembershipIntervalsForUser(index, 'user1')[0].startTimestamp, Date.parse('2026-01-06T12:00:00Z'));
	assert.equal(getMembershipIntervalsForUser(index, 'user2')[0].endTimestamp, null);
	assert.deepEqual(analyzeTelegramAnalyticsIndex(index).participantTimeline.values, [0, 2, 2]);
});
