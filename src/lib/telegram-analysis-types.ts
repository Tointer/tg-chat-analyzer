export type TelegramTextEntity = {
	type?: string;
	text?: string;
	document_id?: string;
};

export type TelegramTextPart = string | TelegramTextEntity;

export type TelegramExportMessage = {
	type?: string;
	date?: string;
	date_unixtime?: string;
	action?: string;
	actor?: string;
	actor_id?: string;
	from?: string;
	from_id?: string;
	members?: string[];
	text?: string | TelegramTextPart[];
	text_entities?: TelegramTextEntity[];
	photo?: string;
	file?: string;
	media_type?: string;
	mime_type?: string;
	sticker_emoji?: string;
};

export type TelegramExport = {
	name?: string;
	messages?: TelegramExportMessage[];
};

export type WeeklyAggregate = {
	label: string;
	textCount: number;
	mediaOnlyCount: number;
	weekStart: string;
};

export type WeeklyChartData = {
	chatName: string;
	participantTimeline: {
		labels: string[];
		values: number[];
		activeValues: number[];
		currentCount: number;
		currentActiveCount: number;
		peakCount: number;
	};
	weeklyMessages: {
		labels: string[];
		textValues: number[];
		mediaOnlyValues: number[];
	};
	totalMessages: number;
	textMessages: number;
	mediaOnlyMessages: number;
	weekCount: number;
	busiestWeek: {
		label: string;
		count: number;
	};
	range: {
		start: string;
		end: string;
	};
};

export type MessageClassification = 'text' | 'media-only' | 'ignore';