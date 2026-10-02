// Preserve coverage of the original raw counting behavior alongside the grouped-mode tests.
import { buildTelegramAnalyticsIndex } from '../telegram-analytics-index';
import { analyzeTelegramExport } from '../telegram-analysis';
import type { TelegramAnalysisOptions, TelegramExport } from '../telegram-analysis-types';

export function buildRawAnalyticsIndex(data: TelegramExport) {
	return buildTelegramAnalyticsIndex(data, { messageCounting: 'raw' });
}

export function analyzeRawTelegramExport(data: TelegramExport, options: TelegramAnalysisOptions = {}) {
	return analyzeTelegramExport(data, { ...options, messageCounting: 'raw' });
}
