import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { getTelegramPageData } from '$lib/server/telegram-page-data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	try {
		const counting = url.searchParams.get('counting');
		const messageCounting = counting === 'raw' || counting === 'consecutive' ? counting : undefined;
		return { ...await getTelegramPageData(messageCounting), selectedPeriod: url.searchParams.get('period') === 'day' ? 'day' : 'week' };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') redirect(303, `${base}/settings`);
		throw error;
	}
};
