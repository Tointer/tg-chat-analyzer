import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyzeTelegramExport, type TelegramExport } from '$lib/telegram-analysis';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const filePath = resolve('src', 'messages', 'result.json');
	const rawExport = await readFile(filePath, 'utf-8');
	const telegramExport = JSON.parse(rawExport) as TelegramExport;

	return analyzeTelegramExport(telegramExport);
};