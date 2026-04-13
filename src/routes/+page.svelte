<script lang="ts">
	import { fromStore } from 'svelte/store';
	import {
		activeThemeName,
		BestMessagesSection,
		ChatPageHeader,
		ChatSummaryCards,
		cycleTheme,
		getTheme,
		MessageBucketsSection,
		UserInfoSection,
		themeOrder
	} from '$lib';
	import type {
		AverageMessagePatternChart,
		MessageBucketsChart,
		TelegramAnalysisReport
	} from '$lib/analyzers/telegram-analysis';

	type PeriodKey = 'day' | 'week';
	type UserMetricKey = 'messages' | 'characters' | 'media';
	type UserInfoViewKey = UserMetricKey | 'average' | 'favorites';

	type PageData = {
		selectedPeriod: 'day' | 'week';
		periodReports: Record<PeriodKey, TelegramAnalysisReport>;
		userInfoCards: Array<{
			userId: string;
			userName: string;
			metrics: Record<
				UserMetricKey,
				{
					label: string;
					totalValue: number;
					messageBucketsByPeriod: Record<PeriodKey, MessageBucketsChart>;
				}
			>;
			averageMessages: {
				label: string;
				leaderboardValue: number;
				leaderboardValueLabel: string;
				chartsByPeriod: Record<PeriodKey, AverageMessagePatternChart>;
			};
			favorites: {
				label: string;
				leaderboardValue: number;
				leaderboardValueLabel: string;
				entries: Array<{
					targetUserId: string;
					targetUserName: string;
					observedReplies: number;
					expectedReplies: number;
					residual: number;
					favoriteScore: number;
					overlapMessageCount: number;
					overlapTargetMessageCount: number;
					overlapReplyCount: number;
				}>;
			};
			bestMessages: {
				mostReactions: Array<{
					messageId: number;
					authorName: string;
					forwardedFrom: string | null;
					timestamp: number;
					preview: string;
					reactionCount: number;
					replyCount: number;
				}>;
				mostReplies: Array<{
					messageId: number;
					authorName: string;
					forwardedFrom: string | null;
					timestamp: number;
					preview: string;
					reactionCount: number;
					replyCount: number;
				}>;
			};
		}>;
	};

	let { data }: { data: PageData } = $props();
	let selectedPeriod = $state<PeriodKey>('week');
	let selectedUserId = $state<string | null>(null);
	let selectedUserPeriod = $state<PeriodKey>('week');
	let selectedUserMetric = $state<UserInfoViewKey>('messages');

	const currentReport = $derived(data.periodReports[selectedPeriod]);
	const themeName = fromStore(activeThemeName);
	const activeTheme = $derived(getTheme(themeName.current));
	const nextTheme = $derived(
		getTheme(themeOrder[(themeOrder.indexOf(themeName.current) + 1) % themeOrder.length] ?? themeOrder[0])
	);

	function selectPeriod(period: PeriodKey) {
		selectedPeriod = period;
	}

	function selectUser(userId: string) {
		selectedUserId = userId;
	}

	function selectUserPeriod(period: PeriodKey) {
		selectedUserPeriod = period;
	}

	function selectUserMetric(metric: UserInfoViewKey) {
		selectedUserMetric = metric;
	}

	$effect(() => {
		selectedPeriod = data.selectedPeriod;
		selectedUserId = data.userInfoCards[0]?.userId ?? null;
		selectedUserPeriod = 'week';
		selectedUserMetric = 'messages';
	});
</script>

<svelte:head>
	<title>Telegram Chat Analyzer</title>
	<meta
		name="description"
		content={`Analyze Telegram exports and explore message volume by ${currentReport.messageBuckets.groupingLabel}.`}
	/>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
	<ChatPageHeader
		chatName={currentReport.chatName}
		activeThemeLabel={activeTheme.label}
		nextThemeLabel={nextTheme.label}
		themeName={themeName.current}
		onToggleTheme={cycleTheme}
	/>

	<ChatSummaryCards report={currentReport} activeTheme={activeTheme} />

	<MessageBucketsSection
		report={currentReport}
		activeTheme={activeTheme}
		selectedPeriod={selectedPeriod}
		onSelectPeriod={selectPeriod}
	/>

	<UserInfoSection
		users={data.userInfoCards}
		selectedUserId={selectedUserId}
		selectedPeriod={selectedUserPeriod}
		selectedMetric={selectedUserMetric}
		{activeTheme}
		onSelectUser={selectUser}
		onSelectPeriod={selectUserPeriod}
		onSelectMetric={selectUserMetric}
	/>

	<BestMessagesSection users={data.userInfoCards} />
</div>
