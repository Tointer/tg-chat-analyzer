import type {
	AverageMessagePatternChart as AverageMessagePatternChartData,
	MessageBucketsChart as MessageBucketsChartData
} from '$lib/analyzers/telegram-analysis';

export type PeriodKey = 'day' | 'week';
export type MetricKey = 'messages' | 'characters' | 'media';
export type ViewKey = MetricKey | 'average' | 'favorites';

export type ReplyFavoriteEntry = {
	targetUserId: string;
	targetUserName: string;
	observedReplies: number;
	expectedReplies: number;
	residual: number;
	favoriteScore: number;
	overlapMessageCount: number;
	overlapTargetMessageCount: number;
	overlapReplyCount: number;
};

export type BestMessageEntry = {
	messageId: number;
	authorName: string;
	forwardedFrom: string | null;
	timestamp: number;
	preview: string;
	reactionCount: number;
	replyCount: number;
	replies: Array<{
		messageId: number;
		authorName: string;
		preview: string;
	}>;
};

export type UserInfoCardItem = {
	userId: string;
	userName: string;
	metrics: Record<
		MetricKey,
		{
			label: string;
			totalValue: number;
			messageBucketsByPeriod: Record<PeriodKey, MessageBucketsChartData>;
		}
	>;
	averageMessages: {
		label: string;
		leaderboardValue: number;
		leaderboardValueLabel: string;
		chartsByPeriod: Record<PeriodKey, AverageMessagePatternChartData>;
	};
	favorites: {
		label: string;
		leaderboardValue: number;
		leaderboardValueLabel: string;
		entries: ReplyFavoriteEntry[];
	};
	bestMessages: {
		mostReactions: BestMessageEntry[];
		mostReplies: BestMessageEntry[];
	};
};