import type { MessageBucketsChart as MessageBucketsChartData } from '$lib/analyzers/telegram-analysis';

export type PeriodKey = 'day' | 'week';
export type MetricKey = 'messages' | 'characters' | 'media';
export type ViewKey = MetricKey | 'favorites';

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
	favorites: {
		label: string;
		leaderboardValue: number;
		leaderboardValueLabel: string;
		entries: ReplyFavoriteEntry[];
	};
};