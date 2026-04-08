<script lang="ts">
	import { fromStore } from 'svelte/store';
	import {
		activeThemeName,
		ChatPageHeader,
		ChatSummaryCards,
		cycleTheme,
		getTheme,
		MessageBucketsSection,
		UserInfoSection,
		themeOrder
	} from '$lib';
	import type { MessageBucketsChart, TelegramAnalysisReport } from '$lib/telegram-analysis';

	type PeriodKey = 'day' | 'week';

	type PageData = {
		selectedPeriod: 'day' | 'week';
		periodReports: Record<PeriodKey, TelegramAnalysisReport>;
		userInfoCards: Array<{
			userId: string;
			userName: string;
			messageCount: number;
			messageBucketsByPeriod: Record<PeriodKey, MessageBucketsChart>;
		}>;
	};

	let { data }: { data: PageData } = $props();
	let selectedPeriod = $state<PeriodKey>('week');
	let selectedUserId = $state<string | null>(null);
	let selectedUserPeriod = $state<PeriodKey>('week');

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

	$effect(() => {
		selectedPeriod = data.selectedPeriod;
		selectedUserId = data.userInfoCards[0]?.userId ?? null;
		selectedUserPeriod = 'week';
	});
</script>

<svelte:head>
	<title>Telegram Chat Analyzer</title>
	<meta
		name="description"
		content={`Analyze Telegram exports and explore message volume by ${currentReport.messageBuckets.groupingLabel}.`}
	/>
</svelte:head>

<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
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
		{activeTheme}
		onSelectUser={selectUser}
		onSelectPeriod={selectUserPeriod}
	/>
</div>
