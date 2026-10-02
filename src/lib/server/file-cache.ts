import { readFile, stat } from 'node:fs/promises';

/** Cache one file's prepared data, sharing in-flight work and retrying failed reads. */
export function createFileCache<T>(path: string, prepare: (raw: string) => T | Promise<T>) {
	let cached: { signature: string; promise: Promise<T> } | undefined;
	async function signature() {
		const info = await stat(path);
		return `${info.dev}:${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
	}
	return async function get(): Promise<T> {
		const before = await signature();
		if (cached?.signature === before) return cached.promise;
		const entry = {
			signature: before,
			promise: (async () => {
				const raw = await readFile(path, 'utf-8');
				if (await signature() !== before) {
					throw new Error('Telegram export changed while reading. Retry the page load.');
				}
				return prepare(raw);
			})()
		};
		cached = entry;
		try {
			return await entry.promise;
		} catch (error) {
			if (cached === entry) cached = undefined;
			throw error;
		}
	};
}
