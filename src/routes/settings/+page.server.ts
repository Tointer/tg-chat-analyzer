import { base } from '$app/paths';
import { fail, redirect } from '@sveltejs/kit';
import { exportLibrary } from '$lib/server/export-library';
import { createTelegramExportMerger } from '$lib/analyzers/telegram-export-merge';
import { importTelegramExports } from '$lib/server/telegram-html-import';
import type { Actions, PageServerLoad } from './$types';

const MAX_TOTAL_BYTES = 512 * 1024 * 1024;
const MAX_FILES = 2000;
export const load: PageServerLoad = () => exportLibrary.list();

export const actions: Actions = {
	counting: async ({ request }) => {
		const form = await request.formData();
		const mode = form.get('mode');
		if (mode !== 'raw' && mode !== 'consecutive') return fail(400, { error: 'Choose grouped or raw counting.' });
		try { await exportLibrary.setMessageCounting(mode); }
		catch { return fail(500, { error: 'Could not save message counting settings.' }); }
		redirect(303, `${base}/?period=${form.get('period') === 'day' ? 'day' : 'week'}`);
	},
	merge: async ({ request }) => {
		try {
			const form = await request.formData();
			const files = form.getAll('files').filter((value): value is File => typeof value !== 'string' && value.size > 0);
			if (!files.length || files.length > MAX_FILES) return fail(400, { error: 'Choose between 1 and 2,000 JSON files or HTML pages.' });
			if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) {
				return fail(413, { error: 'The selected files exceed the 512 MB upload limit.' });
			}
			const merger = createTelegramExportMerger();
			const exports = await importTelegramExports(files);
			for (const entry of exports) merger.add(entry);
			const merged = merger.finish();
			const requestedLabel = form.get('label');
			const label = typeof requestedLabel === 'string' && requestedLabel.trim()
				? requestedLabel.trim().slice(0, 120)
				: `${merged.export.name}${exports.length > 1 ? ' — merged' : ''}`;
			const saved = await exportLibrary.add(merged.export, label, exports.length, false);
			return { savedId: saved.id, savedLabel: saved.label, messageCount: saved.messageCount,
				duplicateMessageCount: merged.duplicateMessageCount };
		} catch (error) {
			return fail(400, { error: error instanceof Error ? error.message : 'Could not import these exports.' });
		}
	},
	activate: async ({ request }) => {
		const form = await request.formData();
		const id = form.get('id');
		if (typeof id !== 'string') return fail(400, { error: 'Choose an export to analyze.' });
		try { await exportLibrary.activate(id); }
		catch { return fail(400, { error: 'This export is unavailable. Choose another export.' }); }
		redirect(303, `${base}/?period=${form.get('period') === 'day' ? 'day' : 'week'}`);
	}
};
