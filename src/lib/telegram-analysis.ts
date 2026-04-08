import { aggregateParticipantTimeline } from './telegram-group-analyzer';
import { aggregateMessagesByWeek, classifyTelegramMessage } from './telegram-text-analyzer';
import type { TelegramExport, WeeklyChartData } from './telegram-analysis-types';

export { classifyTelegramMessage };
export type {
	MessageClassification,
	TelegramExport,
	TelegramExportMessage,
	TelegramTextEntity,
	TelegramTextPart,
	WeeklyChartData
} from './telegram-analysis-types';

export function analyzeTelegramExport(telegramExport: TelegramExport): WeeklyChartData {
	const messages = telegramExport.messages ?? [];
	const participantTimeline = aggregateParticipantTimeline(messages);
	const weeklyMessages = aggregateMessagesByWeek(messages);
	const totalMessages = weeklyMessages.reduce(
		(sum, week) => sum + week.textCount + week.mediaOnlyCount,
		0
	);
	const textMessages = weeklyMessages.reduce((sum, week) => sum + week.textCount, 0);
	const mediaOnlyMessages = weeklyMessages.reduce((sum, week) => sum + week.mediaOnlyCount, 0);
	const busiestWeek = weeklyMessages.reduce(
		(current, week) =>
			week.textCount + week.mediaOnlyCount > current.textCount + current.mediaOnlyCount
				? week
				: current,
		weeklyMessages[0] ?? { label: 'N/A', textCount: 0, mediaOnlyCount: 0, weekStart: 'N/A' }
	);

	return {
		chatName: telegramExport.name ?? 'Telegram Chat',
		participantTimeline,
		weeklyMessages: {
			labels: weeklyMessages.map((week) => week.label),
			textValues: weeklyMessages.map((week) => week.textCount),
			mediaOnlyValues: weeklyMessages.map((week) => week.mediaOnlyCount)
		},
		totalMessages,
		textMessages,
		mediaOnlyMessages,
		weekCount: weeklyMessages.length,
		busiestWeek: {
			label: busiestWeek.label,
			count: busiestWeek.textCount + busiestWeek.mediaOnlyCount
		},
		range: {
			start: weeklyMessages[0]?.label ?? 'N/A',
			end: weeklyMessages.at(-1)?.label ?? 'N/A'
		}
	};
}