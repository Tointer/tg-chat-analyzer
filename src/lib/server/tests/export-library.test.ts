import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createExportLibrary } from '../export-library';
import { parseTelegramChatExport } from '../../analyzers/telegram-export-merge';

const chat = parseTelegramChatExport('{"id":42,"type":"private_supergroup","name":"Test chat","messages":[]}');

test('counting preferences persist through imports and export switches without changing files', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'telegram-counting-'));
	try {
		const original = JSON.stringify(chat);
		await writeFile(join(directory, 'result.json'), original);
		const library = createExportLibrary(directory);
		assert.equal((await library.list()).messageCounting, 'consecutive');
		await library.setMessageCounting('raw');
		const saved = await library.add(chat, 'Other export', 1, false);
		await library.activate(saved.id);
		const reopened = createExportLibrary(directory);
		assert.equal((await reopened.list()).messageCounting, 'raw');
		assert.equal((await reopened.activeSelection()).entry.id, saved.id);
		await reopened.activate('original');
		assert.equal((await reopened.activeSelection()).messageCounting, 'raw');
		await reopened.setMessageCounting('consecutive');
		assert.equal((await library.list()).messageCounting, 'consecutive');
		assert.equal(await readFile(join(directory, 'result.json'), 'utf8'), original);
	} finally { await rm(directory, { recursive: true, force: true }); }
});

test('imports and selection persist while the original export stays untouched', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'telegram-library-'));
	try {
		const original = JSON.stringify(chat);
		await writeFile(join(directory, 'result.json'), original);
		const library = createExportLibrary(directory);
		assert.equal((await library.list()).activeId, 'original');
		const saved = await library.add(chat, 'Merged history', 2, true);
		assert.equal((await library.list()).entries.length, 2);
		assert.equal((await library.list()).activeId, saved.id);
		const reopened = createExportLibrary(directory);
		assert.equal(await reopened.activePath(), (await library.read(saved.id)).path);
		assert.deepEqual(JSON.parse(await readFile(await reopened.activePath(), 'utf-8')), chat);
		assert.equal(await readFile(join(directory, 'result.json'), 'utf-8'), original);
		await reopened.activate('original');
		assert.equal(await reopened.activePath(), join(directory, 'result.json'));
		await assert.rejects(reopened.activate('../../anything'), /Unknown export/);
		await assert.rejects(reopened.read('../../anything'), /Unknown export/);
		assert.equal((await reopened.list()).activeId, 'original');
	} finally { await rm(directory, { recursive: true, force: true }); }
});

test('empty installations can import a first export and concurrent saves retain every entry', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'telegram-library-'));
	try {
		const library = createExportLibrary(directory);
		assert.deepEqual((await library.list()).entries, []);
		const [first, second] = await Promise.all([library.add(chat, 'First', 1, true), library.add(chat, 'Second', 1, false)]);
		const state = await library.list();
		assert.deepEqual(state.entries.map((entry) => entry.id), [first.id, second.id]);
		assert.equal(state.activeId, first.id);
	} finally { await rm(directory, { recursive: true, force: true }); }
});

test('saving a merged download does not change the active analysis', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'telegram-library-'));
	try {
		await writeFile(join(directory, 'result.json'), JSON.stringify(chat));
		const library = createExportLibrary(directory);
		const saved = await library.add(chat, 'Download only', 2, false);
		assert.equal((await library.list()).activeId, 'original');
		assert.equal(await library.activePath(), join(directory, 'result.json'));
		assert.equal((await library.read(saved.id)).entry.messageCount, 0);
	} finally { await rm(directory, { recursive: true, force: true }); }
});
