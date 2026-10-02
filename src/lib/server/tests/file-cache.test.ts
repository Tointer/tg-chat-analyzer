import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileCache } from '../file-cache';
import { prepareTelegramPageData } from '../telegram-page-data';

test('file cache shares concurrent preparation and invalidates on file replacement', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'telegram-cache-'));
	try {
		const path = join(directory, 'result.json');
		await writeFile(path, '{"value":1}');
		let calls = 0;
		const get = createFileCache(path, (raw) => { calls++; return JSON.parse(raw) as { value: number }; });
		const [first, second] = await Promise.all([get(), get()]);
		assert.equal(first, second);
		assert.equal(calls, 1);
		assert.equal(await get(), first);
		await writeFile(path, '{"value":100}');
		assert.deepEqual(await get(), { value: 100 });
		assert.equal(calls, 2);
	} finally { await rm(directory, { recursive: true, force: true }); }
});

test('failed preparation is retried and missing files do not serve stale results', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'telegram-cache-'));
	try {
		const path = join(directory, 'result.json');
		await writeFile(path, 'data');
		let calls = 0;
		const get = createFileCache(path, () => {
			if (++calls === 1) throw new Error('Failed preparation');
			return calls;
		});
		await assert.rejects(get(), /Failed preparation/);
		assert.equal(await get(), 2);
		await rm(path);
		await assert.rejects(get(), /ENOENT/);
	} finally { await rm(directory, { recursive: true, force: true }); }
});

test('page preparation handles empty and single-message exports and preserves edge buckets', () => {
	const empty = prepareTelegramPageData({ messages: [] });
	assert.deepEqual(empty.userInfoCards, []);
	assert.deepEqual(empty.periodReports.day.messageBuckets.labels, []);
	const single = prepareTelegramPageData({ messages: [{ id: 1, type: 'message', date: '2026-01-05T12:00:00Z', from_id: 'user1', text: 'Hello world' }] });
	assert.equal(single.periodReports.day.totalMessages, 1);
	assert.deepEqual(single.periodReports.day.messageBuckets.nonReplyValues, [1]);
	assert.deepEqual(single.periodReports.week.messageBuckets.nonReplyValues, [1]);
	assert.equal(single.userInfoCards[0].averageMessages.chartsByPeriod.day.values[12], 1);
});
