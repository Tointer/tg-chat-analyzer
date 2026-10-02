import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { TelegramChatExport } from '../analyzers/telegram-export-merge';
import type { MessageCountingMode } from '../analyzers/telegram-analysis-types';
import { DEFAULT_MESSAGE_COUNTING } from '../analyzers/telegram-analysis-config';

export type ExportLibraryEntry = {
	id: string;
	label: string;
	chatName: string | null;
	chatId: number | null;
	messageCount: number | null;
	bytes: number;
	createdAt: string | null;
	sourceCount: number;
};
type Manifest = { activeId: string; entries: ExportLibraryEntry[]; messageCounting?: MessageCountingMode };
const ORIGINAL_ID = 'original';
const isStoredId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);

/** Storage is server-local and never uses user-supplied filenames as paths. */
export function createExportLibrary(directory: string) {
	const importsDirectory = join(directory, 'imports');
	const manifestPath = join(directory, 'selection.json');
	let writeQueue: Promise<unknown> = Promise.resolve();

	async function readManifest(): Promise<Manifest> {
		try {
			const value = JSON.parse(await readFile(manifestPath, 'utf-8')) as Manifest;
			if (!value || !Array.isArray(value.entries) || typeof value.activeId !== 'string' ||
				value.entries.some((entry) => !entry || !isStoredId(entry.id)) ||
				(value.activeId !== ORIGINAL_ID && !value.entries.some((entry) => entry.id === value.activeId))) {
				throw new Error('Invalid export library settings.');
			}
			return value;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { activeId: ORIGINAL_ID, entries: [] };
			throw error;
		}
	}
	async function saveManifest(manifest: Manifest) {
		await mkdir(directory, { recursive: true });
		const temporaryPath = `${manifestPath}.${randomUUID()}.tmp`;
		await writeFile(temporaryPath, JSON.stringify(manifest, null, 2), 'utf-8');
		await rename(temporaryPath, manifestPath);
	}
	function serialize<T>(work: () => Promise<T>): Promise<T> {
		const result = writeQueue.then(work);
		writeQueue = result.catch(() => {});
		return result;
	}
	function pathForId(id: string) {
		if (id === ORIGINAL_ID) return join(directory, 'result.json');
		if (!isStoredId(id)) throw new Error('Unknown export.');
		return join(importsDirectory, `${id}.json`);
	}
	async function getEntry(id: string, manifest: Manifest) {
		if (id === ORIGINAL_ID) {
			const info = await stat(pathForId(id));
			return { id, label: 'Original result.json', chatName: null, chatId: null, messageCount: null,
				bytes: info.size, createdAt: null, sourceCount: 1 } satisfies ExportLibraryEntry;
		}
		const entry = manifest.entries.find((entry) => entry.id === id);
		if (!entry) throw new Error('Unknown export.');
		return entry;
	}
	return {
		async list() {
			const manifest = await readManifest();
			let original: ExportLibraryEntry[] = [];
			try { original = [await getEntry(ORIGINAL_ID, manifest)]; }
			catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
			return { activeId: manifest.activeId, entries: [...original, ...manifest.entries], messageCounting: manifest.messageCounting ?? DEFAULT_MESSAGE_COUNTING };
		},
		async activeSelection() {
			const manifest = await readManifest();
			const entry = await getEntry(manifest.activeId, manifest);
			return { path: pathForId(manifest.activeId), entry, messageCounting: manifest.messageCounting ?? DEFAULT_MESSAGE_COUNTING };
		},
		setMessageCounting(messageCounting: MessageCountingMode) {
			return serialize(async () => {
				const manifest = await readManifest();
				await saveManifest({ ...manifest, messageCounting });
			});
		},
		async activePath() {
			const manifest = await readManifest();
			return pathForId(manifest.activeId);
		},
		async read(id: string) {
			const manifest = await readManifest();
			const entry = await getEntry(id, manifest);
			return { entry, path: pathForId(id) };
		},
		activate(id: string) {
			return serialize(async () => {
				const manifest = await readManifest();
				await getEntry(id, manifest);
				await stat(pathForId(id));
				await saveManifest({ ...manifest, activeId: id });
			});
		},
		add(data: TelegramChatExport, label: string, sourceCount: number, activate: boolean) {
			return serialize(async () => {
				const manifest = await readManifest();
				const id = randomUUID();
				const raw = JSON.stringify(data, null, 2);
				await mkdir(importsDirectory, { recursive: true });
				await writeFile(pathForId(id), raw, { encoding: 'utf-8', flag: 'wx' });
				const entry: ExportLibraryEntry = { id, label, chatName: data.name, chatId: data.id,
					messageCount: data.messages.length, bytes: Buffer.byteLength(raw),
					createdAt: new Date().toISOString(), sourceCount };
				await saveManifest({ ...manifest, activeId: activate ? id : manifest.activeId, entries: [...manifest.entries, entry] });
				return entry;
			});
		}
	};
}

export const exportLibrary = createExportLibrary(resolve('src', 'messages'));
