import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildTelegramAnalyticsIndex } from '$lib/telegram-analytics-index';
import { analyzeTelegramAnalyticsIndex, type TelegramExport } from '$lib/telegram-analysis';
import type { TimeBucketSpec } from '$lib/telegram-analysis';
import type { PageServerLoad } from './$types';

const MESSAGE_BUCKETS: Record<'day' | 'week', TimeBucketSpec> = {
	day: {
		unit: 'day',
		size: 1
	},
	week: {
		unit: 'week',
		size: 1
	}
};

export const load: PageServerLoad = async ({ url }) => {
	const filePath = resolve('src', 'messages', 'result.json');
	const rawExport = await readFile(filePath, 'utf-8');
	const telegramExport = JSON.parse(rawExport) as TelegramExport;
	const analyticsIndex = buildTelegramAnalyticsIndex(telegramExport);
	const requestedPeriod = url.searchParams.get('period');
	const selectedPeriod = requestedPeriod === 'day' ? 'day' : 'week';

	return {
		selectedPeriod,
		periodReports: {
			day: analyzeTelegramAnalyticsIndex(analyticsIndex, {
				messageBuckets: MESSAGE_BUCKETS.day
			}),
			week: analyzeTelegramAnalyticsIndex(analyticsIndex, {
				messageBuckets: MESSAGE_BUCKETS.week
			})
		}
	};
};