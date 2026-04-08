<script lang="ts">
	import MessageBucketsChart from '$lib/MessageBucketsChart.svelte';
	import MessagePeriodToggle from '$lib/MessagePeriodToggle.svelte';
	import type { AppTheme } from '$lib';
	import type { MessageBucketsChart as MessageBucketsChartData } from '$lib/telegram-analysis';

	type PeriodKey = 'day' | 'week';

	export type UserInfoCardItem = {
		userId: string;
		userName: string;
		messageCount: number;
		messageBucketsByPeriod: Record<PeriodKey, MessageBucketsChartData>;
	};

	type Props = {
		users: UserInfoCardItem[];
		selectedUserId: string | null;
		selectedPeriod: PeriodKey;
		activeTheme: AppTheme;
		onSelectUser: (userId: string) => void;
		onSelectPeriod: (period: PeriodKey) => void;
	};

	let { users, selectedUserId, selectedPeriod, activeTheme, onSelectUser, onSelectPeriod }: Props =
		$props();
	let scrollViewport = $state<HTMLDivElement | undefined>(undefined);
	let showTopFade = $state(false);
	let showBottomFade = $state(false);

	const selectedUser = $derived(
		users.find((user) => user.userId === selectedUserId) ?? users[0] ?? null
	);
	const selectedMessageBuckets = $derived(
		selectedUser?.messageBucketsByPeriod[selectedPeriod] ?? null
	);

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
		selectedUserId;
		queueMicrotask(() => {
			updateScrollFades();
		});
	});
</script>

<section
	class="surface-card mt-4 flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden p-5 sm:p-6"
	aria-label="User information"
>
	<div class="mb-4 shrink-0">
		<h2 class="m-0 text-2xl font-display sm:text-3xl">User info</h2>
		<p class="mt-2 text-sm text-app-muted">Select a participant to inspect their message volume by day or week.</p>
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
					{#each users as user}
						<button
							type="button"
							class={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-colors ${selectedUser?.userId === user.userId ? 'bg-app-accent-strong text-app-accent-contrast shadow-app-button' : 'bg-app-surface hover:bg-app-empty text-app-text'}`}
							onclick={() => onSelectUser(user.userId)}
						>
							<span class="min-w-0 pr-3">
								<span class="block truncate text-sm font-semibold sm:text-base">{user.userName}</span>
								<span class={`block text-xs uppercase tracking-wide ${selectedUser?.userId === user.userId ? 'text-app-accent-contrast/80' : 'text-app-muted'}`}>
									Messages
								</span>
							</span>
							<strong class="shrink-0 text-lg font-display">{user.messageCount}</strong>
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
						<p class="m-0 text-sm uppercase tracking-widest text-app-accent">Selected user</p>
						<h3 class="mt-2 text-2xl font-display sm:text-3xl">{selectedUser.userName}</h3>
					</div>
					<div class="flex flex-wrap items-end justify-end gap-3 sm:gap-4">
						<div class="text-right">
							<p class="m-0 text-xs uppercase tracking-widest text-app-subtle">Total messages</p>
							<strong class="mt-2 block text-3xl font-display text-app-text">{selectedUser.messageCount}</strong>
						</div>
						<MessagePeriodToggle
							selectedPeriod={selectedPeriod}
							onSelectPeriod={onSelectPeriod}
							ariaLabel="User message period selector"
						/>
					</div>
				</div>

				<div class="min-h-0 flex-1">
					<MessageBucketsChart
						messageBuckets={selectedMessageBuckets ?? selectedUser.messageBucketsByPeriod.week}
						{activeTheme}
						heightClass="h-full min-h-0"
						emptyMessage="Not enough data to draw this user's chart yet."
					/>
				</div>
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