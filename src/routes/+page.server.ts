import { getTelegramPageData } from '$lib/server/telegram-page-data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => ({
	...await getTelegramPageData(),
	selectedPeriod: url.searchParams.get('period') === 'day' ? 'day' : 'week'
});
