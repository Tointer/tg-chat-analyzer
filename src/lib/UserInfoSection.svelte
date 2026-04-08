<script lang="ts">
	import MessageBucketsChart from './MessageBucketsChart.svelte';
	import MessagePeriodToggle from './MessagePeriodToggle.svelte';
	import ReplyPeersList from './ReplyPeersList.svelte';
	import SegmentedSelector from './SegmentedSelector.svelte';
	import UserInfoUserList from './UserInfoUserList.svelte';
	import type { AppTheme } from '$lib';
	import type { PeriodKey, UserInfoCardItem, ViewKey } from './UserInfoSection.types';

	type Props = {
		users: UserInfoCardItem[];
		selectedUserId: string | null;
		selectedPeriod: PeriodKey;
		selectedMetric: ViewKey;
		activeTheme: AppTheme;
		onSelectUser: (userId: string) => void;
		onSelectPeriod: (period: PeriodKey) => void;
		onSelectMetric: (metric: ViewKey) => void;
	};

	let {
		users,
		selectedUserId,
		selectedPeriod,
		selectedMetric,
		activeTheme,
		onSelectUser,
		onSelectPeriod,
		onSelectMetric
	}: Props = $props();
	let expandedFavoriteId = $state<string | null>(null);
	const numberFormatter = new Intl.NumberFormat('en-US');
	const metricOptions = [
		{ value: 'messages', label: 'Message Count' },
		{ value: 'characters', label: 'Characters Count' },
		{ value: 'favorites', label: 'Reply Peers' }
	];
	const isFavoriteView = $derived(selectedMetric === 'favorites');

	const sortedUsers = $derived(
		[...users].sort((left, right) => {
			const valueDifference =
				selectedMetric === 'favorites'
					? right.favorites.leaderboardValue - left.favorites.leaderboardValue
					: right.metrics[selectedMetric].totalValue - left.metrics[selectedMetric].totalValue;

			if (valueDifference !== 0) {
				return valueDifference;
			}

			return left.userName.localeCompare(right.userName);
		})
	);

	const selectedUser = $derived(
		sortedUsers.find((user) => user.userId === selectedUserId) ?? sortedUsers[0] ?? null
	);
	const selectedMessageBuckets = $derived(
		selectedMetric === 'favorites'
			? null
			: selectedUser?.metrics[selectedMetric].messageBucketsByPeriod[selectedPeriod] ?? null
	);
	const selectedMetricData = $derived(
		selectedMetric === 'favorites' ? null : selectedUser?.metrics[selectedMetric] ?? null
	);
	const selectedMetricFallbackBuckets = $derived(
		selectedMetric === 'favorites'
			? null
			: selectedUser?.metrics[selectedMetric].messageBucketsByPeriod.week ?? null
	);
	const selectedChartBuckets = $derived(selectedMessageBuckets ?? selectedMetricFallbackBuckets);
	const selectedFavorites = $derived(selectedUser?.favorites.entries ?? []);
	const selectedFavoritesSummary = $derived(selectedUser?.favorites ?? null);

	function toggleFavoriteDetails(targetUserId: string) {
		expandedFavoriteId = expandedFavoriteId === targetUserId ? null : targetUserId;
	}

	$effect(() => {
		void users;
		void selectedMetric;
		void selectedUserId;
		expandedFavoriteId = null;
	});
</script>

<section
	class="surface-card mt-4 flex min-h-130 flex-col overflow-hidden p-5 sm:min-h-152 sm:p-6 lg:h-172"
	aria-label="User information"
>
	<div class="mb-4 shrink-0">
		<div class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h2 class="m-0 text-2xl font-display sm:text-3xl">User info</h2>
				<p class="mt-2 text-sm text-app-muted">
					{#if isFavoriteView}
						Select a participant to inspect who they reply to more often than overlap-adjusted chance would predict.
					{:else}
						Select a participant to inspect their message or character volume by day or week.
					{/if}
				</p>
			</div>
			<SegmentedSelector
				selectedValue={selectedMetric}
				onSelectValue={(value) => onSelectMetric(value as ViewKey)}
				options={metricOptions}
				ariaLabel="User info metric selector"
			/>
		</div>
	</div>

	<div class="grid min-h-0 flex-1 auto-rows-fr gap-4 lg:grid-cols-3 lg:gap-6">
		<UserInfoUserList
			users={sortedUsers}
			selectedUserId={selectedUser?.userId ?? null}
			selectedMetric={selectedMetric}
			onSelectUser={onSelectUser}
		/>

		<div class="flex min-h-0 flex-col rounded-3xl border border-app-border bg-app-surface-alt p-4 sm:p-5 lg:col-span-2">
			{#if selectedUser}
				<div class="mb-4 shrink-0 flex flex-wrap items-end justify-between gap-3">
					<div>
						<p class="m-0 text-sm uppercase tracking-widest text-app-accent">
							{selectedMetric === 'favorites' ? 'Reply peers for' : 'Selected user'}
						</p>
						<h3 class="mt-2 text-2xl font-display sm:text-3xl">{selectedUser.userName}</h3>
					</div>
					{#if isFavoriteView}
						<div class="text-right">
							<p class="m-0 text-xs uppercase tracking-widest text-app-subtle">{selectedFavoritesSummary?.leaderboardValueLabel}</p>
							<strong class="mt-2 block text-3xl font-display text-app-text">{numberFormatter.format(selectedFavoritesSummary?.leaderboardValue ?? 0)}</strong>
						</div>
					{:else}
						<div class="flex flex-wrap items-end justify-end gap-3 sm:gap-4">
							<div class="text-right">
								<p class="m-0 text-xs uppercase tracking-widest text-app-subtle">Total {selectedMetricData?.label.toLowerCase()}</p>
								<strong class="mt-2 block text-3xl font-display text-app-text">{numberFormatter.format(selectedMetricData?.totalValue ?? 0)}</strong>
							</div>
							<MessagePeriodToggle
								selectedPeriod={selectedPeriod}
								onSelectPeriod={onSelectPeriod}
								ariaLabel="User message period selector"
							/>
						</div>
					{/if}
				</div>

				{#if isFavoriteView}
					<ReplyPeersList
						favorites={selectedFavorites}
						expandedFavoriteId={expandedFavoriteId}
						onToggleFavoriteDetails={toggleFavoriteDetails}
					/>
				{:else}
					<div class="min-h-0 flex-1">
						{#if selectedChartBuckets}
							<MessageBucketsChart
								messageBuckets={selectedChartBuckets}
								{activeTheme}
								heightClass="h-full min-h-0"
								emptyMessage="Not enough data to draw this user's chart yet."
							/>
						{:else}
							<p class="grid h-full place-items-center rounded-2xl border border-dashed border-app-border bg-app-empty p-6 text-center text-base text-app-muted">
								Not enough data to draw this user's chart yet.
							</p>
						{/if}
					</div>
				{/if}
			{:else}
				<div class="min-h-0 flex-1">
					<p class="grid h-full place-items-center rounded-2xl border border-dashed border-app-border bg-app-empty p-6 text-center text-base text-app-muted">
						No users found in this chat history.
					</p>
				</div>
			{/if}
		</div>
	</div>
</section>
