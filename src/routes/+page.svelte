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
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import type { PeriodKey, ViewKey } from '$lib/components/user-info/UserInfoSection.types';

	let { data }: { data: PageData } = $props();
	const selectedPeriod = $derived<PeriodKey>(page.url.searchParams.get('period') === 'day' ? 'day' : 'week');
	let selectedUserId = $state<string | null>(null);
	let selectedUserPeriod = $state<PeriodKey>('week');
	let selectedUserMetric = $state<ViewKey>('messages');

	const currentReport = $derived(data.periodReports[selectedPeriod]);
	const themeName = fromStore(activeThemeName);
	const activeTheme = $derived(getTheme(themeName.current));
	const nextTheme = $derived(
		getTheme(themeOrder[(themeOrder.indexOf(themeName.current) + 1) % themeOrder.length] ?? themeOrder[0])
	);

	async function selectPeriod(period: PeriodKey) {
		const url = new URL(page.url);
		url.searchParams.set('period', period);
		await goto(resolve(`/?${url.searchParams.toString()}${url.hash}`), { noScroll: true, keepFocus: true });
	}

	function selectUser(userId: string) {
		selectedUserId = userId;
	}

	function selectUserPeriod(period: PeriodKey) {
		selectedUserPeriod = period;
	}

	function selectUserMetric(metric: ViewKey) {
		selectedUserMetric = metric;
	}

	$effect(() => {
		if (!data.userInfoCards.some((user) => user.userId === selectedUserId)) {
			selectedUserId = data.userInfoCards[0]?.userId ?? null;
		}
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
