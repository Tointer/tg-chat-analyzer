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

export type TimeBucketUnit = 'day' | 'week' | 'month';

export type TimeBucketSpec = {
	unit: TimeBucketUnit;
	size?: number;
};

export type NormalizedTimeBucket = {
	unit: TimeBucketUnit;
	size: number;
};

export type MessageBucketAggregate = {
	label: string;
	tooltipLabel: string;
	start: string;
	end: string;
	textCount: number;
	mediaOnlyCount: number;
};

export type TelegramAnalysisOptions = {
	messageBuckets?: TimeBucketSpec;
};

export type TelegramAnalysisReport = {
	chatName: string;
	participantTimeline: {
		labels: string[];
		values: number[];
		activeValues: number[];
		currentCount: number;
		currentActiveCount: number;
		peakCount: number;
	};
	messageBuckets: {
		bucket: NormalizedTimeBucket;
		title: string;
		groupingLabel: string;
		trimmedEdgeBucketCount: number;
		labels: string[];
		tooltipLabels: string[];
		textValues: number[];
		mediaOnlyValues: number[];
	};
	totalMessages: number;
	textMessages: number;
	mediaOnlyMessages: number;
	bucketCount: number;
	busiestBucket: {
		label: string;
		tooltipLabel: string;
		count: number;
	};
	range: {
		start: string;
		end: string;
	};
};

export type MessageClassification = 'text' | 'media-only' | 'ignore';