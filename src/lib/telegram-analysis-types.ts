export type TelegramTextEntity = {
	type?: string;
	text?: string;
	document_id?: string;
};

export type TelegramTextPart = string | TelegramTextEntity;

export type TelegramExportMessage = {
	id?: number;
	type?: string;
	date?: string;
	date_unixtime?: string;
	forwarded_from?: string;
	forwarded_from_id?: string;
	reply_to_message_id?: number;
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
	otherCount: number;
	lowInfoCount: number;
	mediaOnlyCount: number;
};

export type MessageBucketValueMetric = 'messages' | 'characters';

export type TimeRangeSpec = {
	startTimestamp?: number;
	endTimestamp?: number;
};

export type NormalizedTimeRange = {
	startTimestamp: number;
	endTimestamp: number;
};

export type TelegramAnalysisOptions = {
	messageBuckets?: TimeBucketSpec;
	timeRange?: TimeRangeSpec;
};

export type MessageBucketsChart = {
	bucket: NormalizedTimeBucket;
	title: string;
	groupingLabel: string;
	trimmedEdgeBucketCount: number;
	labels: string[];
	tooltipLabels: string[];
	otherValues: number[];
	lowInfoValues: number[];
	mediaOnlyValues: number[];
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
	messageBuckets: MessageBucketsChart;
	totalMessages: number;
	otherMessages: number;
	lowInfoMessages: number;
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

export type MessageClassification = 'other' | 'low-info' | 'media-only' | 'ignore';