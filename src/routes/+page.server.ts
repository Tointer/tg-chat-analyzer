import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { getTelegramPageData } from '$lib/server/telegram-page-data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	try {
		return { ...await getTelegramPageData(), selectedPeriod: url.searchParams.get('period') === 'day' ? 'day' : 'week' };
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') redirect(303, `${base}/settings`);
		throw error;
	}
};
