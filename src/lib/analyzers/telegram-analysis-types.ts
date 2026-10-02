export type TelegramTextEntity = {
	type?: string;
	text?: string;
	document_id?: string;
};

export type TelegramReactionRecent = {
	from?: string;
	from_id?: string;
	date?: string;
	date_unixtime?: string;
};

export type TelegramReaction = {
	type?: string;
	count?: number;
	emoji?: string;
	recent?: TelegramReactionRecent[];
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
	reactions?: TelegramReaction[];
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

export type MediaMessageGroup = 'image' | 'video' | 'gif' | 'sticker' | 'audio' | 'document';

export type ChartSeriesColorKey = 'reply' | 'nonReply' | MediaMessageGroup;

export type MessageBucketsChartSeries = {
	key: string;
	label: string;
	colorKey: ChartSeriesColorKey;
	values: number[];
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
	replyCount: number;
	nonReplyCount: number;
};

export type MessageBucketValueMetric = 'messages' | 'characters';

export type TimeRangeSpec = {
	startTimestamp?: number;
	endTimestamp?: number;
};

export type AverageMessagePatternMode = 'day' | 'week';

export type AverageMessagePatternChart = {
	mode: AverageMessagePatternMode;
	title: string;
	labels: string[];
	tooltipLabels: string[];
	values: number[];
	peakLabel: string;
	peakValue: number;
	summaryValueLabel: string;
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
	series?: MessageBucketsChartSeries[];
	replyValues: number[];
	nonReplyValues: number[];
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
	totalMediaMessages: number;
	peopleChatted: number;
	totalReactions: number;
	replyMessages: number;
	nonReplyMessages: number;
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
	messageSpan: {
		startTimestamp: number | null;
		endTimestamp: number | null;
		durationMs: number | null;
	};
};

export type MessageClassification = 'other' | 'low-info' | 'media-only' | 'ignore';