<script lang="ts">
	import MessageBucketsChart from '$lib/MessageBucketsChart.svelte';
	import MessagePeriodToggle from '$lib/MessagePeriodToggle.svelte';
	import SegmentedSelector from '$lib/SegmentedSelector.svelte';
	import type { AppTheme } from '$lib';
	import type { MessageBucketsChart as MessageBucketsChartData } from '$lib/telegram-analysis';

	type PeriodKey = 'day' | 'week';
	type MetricKey = 'messages' | 'characters';
	type ViewKey = MetricKey | 'favorites';

	type ReplyFavoriteEntry = {
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
	let scrollViewport = $state<HTMLDivElement | undefined>(undefined);
	let showTopFade = $state(false);
	let showBottomFade = $state(false);
	const numberFormatter = new Intl.NumberFormat('en-US');
	const decimalFormatter = new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	});
	const metricOptions = [
		{ value: 'messages', label: 'Message Count' },
		{ value: 'characters', label: 'Characters Count' },
		{ value: 'favorites', label: 'Reply Favorites' }
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

	function formatSignedDecimal(value: number) {
		const absoluteValue = decimalFormatter.format(Math.abs(value));
		return `${value > 0 ? '+' : value < 0 ? '-' : ''}${absoluteValue}`;
	}

	function updateScrollFades() {
		if (!scrollViewport) {
			showTopFade = false;
			showBottomFade = false;
			return;
		}

		const { scrollTop, scrollHeight, clientHeight } = scrollViewport;
		const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
		const hasOverflow = maxScrollTop > 1;

		showTopFade = hasOverflow && scrollTop > 1;
		showBottomFade = hasOverflow && scrollTop < maxScrollTop - 1;
	}

	$effect(() => {
		if (!scrollViewport) {
			return;
		}

		updateScrollFades();

		const resizeObserver = new ResizeObserver(() => {
			updateScrollFades();
		});

		resizeObserver.observe(scrollViewport);

		return () => {
			resizeObserver.disconnect();
		};
	});

	$effect(() => {
		users;
		selectedMetric;
		selectedUserId;
		queueMicrotask(() => {
			updateScrollFades();
		});
	});
</script>

<section
	class="surface-card mt-4 flex min-h-[32.5rem] flex-col overflow-hidden p-5 sm:min-h-[38rem] sm:p-6 lg:h-[43rem]"
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
		<div class="flex min-h-0 flex-col rounded-3xl border border-app-border bg-app-surface-alt p-3 lg:min-h-0">
			<div class="relative min-h-0 flex-1 overflow-hidden rounded-2xl">
				<div class={`pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-app-surface-alt to-transparent transition-opacity duration-200 ${showTopFade ? 'opacity-100' : 'opacity-0'}`}></div>
				<div class={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-app-surface-alt to-transparent transition-opacity duration-200 ${showBottomFade ? 'opacity-100' : 'opacity-0'}`}></div>
				<div
					bind:this={scrollViewport}
					class="user-list-scroll min-h-0 h-full overflow-y-auto pr-1"
					onscroll={updateScrollFades}
				>
				<div class="space-y-2">
					{#each sortedUsers as user, index}
						<button
							type="button"
							class={`flex w-full items-stretch gap-3 rounded-2xl pr-4 text-left transition-colors ${selectedUser?.userId === user.userId ? 'bg-app-accent-strong text-app-accent-contrast shadow-app-button' : 'bg-app-surface hover:bg-app-empty text-app-text'}`}
							onclick={() => onSelectUser(user.userId)}
						>
							<span class={`flex min-w-14 shrink-0 items-center justify-center rounded-l-2xl px-3 text-xl font-display ${selectedUser?.userId === user.userId ? 'bg-app-accent-contrast/18 text-app-accent-contrast' : 'bg-app-surface-strong text-app-text'}`}>
								{index + 1}
							</span>
							<span class="flex min-w-0 flex-1 items-center justify-between gap-3 py-3 pl-0">
								<span class="min-w-0 pr-3">
								<span class="block truncate text-sm font-semibold sm:text-base">{user.userName}</span>
							</span>
								<strong class="shrink-0 text-lg font-display">
									{selectedMetric === 'favorites'
										? numberFormatter.format(user.favorites.leaderboardValue)
										: numberFormatter.format(user.metrics[selectedMetric].totalValue)}
								</strong>
							</span>
						</button>
					{/each}
				</div>
				</div>
			</div>
		</div>

		<div class="flex min-h-0 flex-col rounded-3xl border border-app-border bg-app-surface-alt p-4 sm:p-5 lg:col-span-2">
			{#if selectedUser}
				<div class="mb-4 shrink-0 flex flex-wrap items-end justify-between gap-3">
					<div>
						<p class="m-0 text-sm uppercase tracking-widest text-app-accent">
							{selectedMetric === 'favorites' ? 'Reply favorites' : 'Selected user'}
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
					<div class="min-h-0 flex-1 overflow-y-auto pr-1">
						{#if selectedFavorites.length > 0}
							<div class="space-y-3">
								{#each selectedFavorites as favorite, index}
									<article class="rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm">
										<div class="flex flex-wrap items-start justify-between gap-3">
											<div class="flex min-w-0 items-start gap-3">
												<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-surface-strong text-base font-display text-app-text">{index + 1}</span>
												<div class="min-w-0">
													<h4 class="m-0 truncate text-base font-semibold text-app-text sm:text-lg">{favorite.targetUserName}</h4>
													<p class="mt-1 text-sm text-app-muted">
														Observed {numberFormatter.format(favorite.observedReplies)} replies vs expected {decimalFormatter.format(favorite.expectedReplies)}
													</p>
												</div>
											</div>
											<div class="text-right">
												<p class="m-0 text-xs uppercase tracking-widest text-app-subtle">Excess replies</p>
												<strong class="mt-2 block text-2xl font-display text-app-text">{formatSignedDecimal(favorite.residual)}</strong>
											</div>
										</div>
										<div class="mt-4 grid gap-3 text-sm text-app-muted sm:grid-cols-3">
											<div>
												<p class="m-0 text-[11px] uppercase tracking-widest text-app-subtle">Score</p>
												<strong class="mt-1 block text-base font-display text-app-text">{formatSignedDecimal(favorite.favoriteScore)}</strong>
											</div>
											<div>
												<p class="m-0 text-[11px] uppercase tracking-widest text-app-subtle">Their messages in overlap</p>
												<strong class="mt-1 block text-base font-display text-app-text">{numberFormatter.format(favorite.overlapTargetMessageCount)}</strong>
											</div>
											<div>
												<p class="m-0 text-[11px] uppercase tracking-widest text-app-subtle">Reply pool in overlap</p>
												<strong class="mt-1 block text-base font-display text-app-text">{numberFormatter.format(favorite.overlapReplyCount)}</strong>
											</div>
										</div>
									</article>
								{/each}
							</div>
						{:else}
							<p class="grid h-full place-items-center rounded-2xl border border-dashed border-app-border bg-app-empty p-6 text-center text-base text-app-muted">
								This user does not have enough reply activity to estimate favorites yet.
							</p>
						{/if}
					</div>
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

<style>
	.user-list-scroll {
		scrollbar-width: thin;
		scrollbar-color: var(--app-accent) transparent;
	}

	.user-list-scroll::-webkit-scrollbar {
		width: 0.7rem;
	}

	.user-list-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.user-list-scroll::-webkit-scrollbar-thumb {
		background: color-mix(in srgb, var(--app-accent) 68%, transparent);
		border: 0.18rem solid transparent;
		border-radius: 9999px;
		background-clip: padding-box;
	}

	.user-list-scroll::-webkit-scrollbar-thumb:hover {
		background: color-mix(in srgb, var(--app-accent) 82%, transparent);
		border: 0.18rem solid transparent;
		background-clip: padding-box;
	}

	.user-list-scroll::-webkit-scrollbar-corner {
		background: transparent;
	}
</style>