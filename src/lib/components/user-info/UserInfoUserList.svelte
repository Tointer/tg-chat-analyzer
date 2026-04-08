<script lang="ts">
	import RankedListItem from './RankedListItem.svelte';
	import type { UserInfoCardItem, ViewKey } from './UserInfoSection.types';

	type Props = {
		users: UserInfoCardItem[];
		selectedUserId: string | null;
		selectedMetric: ViewKey;
		onSelectUser: (userId: string) => void;
	};

	let { users, selectedUserId, selectedMetric, onSelectUser }: Props = $props();
	let scrollViewport = $state<HTMLDivElement | undefined>(undefined);
	let showTopFade = $state(false);
	let showBottomFade = $state(false);
	const numberFormatter = new Intl.NumberFormat('en-US');

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
		void users;
		void selectedMetric;
		void selectedUserId;
		queueMicrotask(() => {
			updateScrollFades();
		});
	});
</script>

<div class="flex min-h-0 flex-col rounded-3xl border border-app-border bg-app-surface-alt p-3 lg:min-h-0">
	<div class="relative min-h-0 flex-1 overflow-hidden rounded-2xl">
		<div class={`pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-linear-to-b from-app-surface-alt to-transparent transition-opacity duration-200 ${showTopFade ? 'opacity-100' : 'opacity-0'}`}></div>
		<div class={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-linear-to-t from-app-surface-alt to-transparent transition-opacity duration-200 ${showBottomFade ? 'opacity-100' : 'opacity-0'}`}></div>
		<div
			bind:this={scrollViewport}
			class="user-list-scroll min-h-0 h-full overflow-y-auto pr-1"
			onscroll={updateScrollFades}
		>
			<div class="space-y-2">
				{#each users as user, index (user.userId)}
					<RankedListItem
						rank={index + 1}
						interactive
						selected={selectedUserId === user.userId}
						onClick={() => onSelectUser(user.userId)}
						contentClass="flex min-w-0 flex-1 items-center justify-between gap-3 py-3 pl-0"
					>
						<span class="min-w-0 pr-3">
							<span class="block truncate text-sm font-semibold sm:text-base">{user.userName}</span>
						</span>
						<strong class="shrink-0 text-lg font-display">
							{selectedMetric === 'favorites'
								? numberFormatter.format(user.favorites.leaderboardValue)
								: numberFormatter.format(user.metrics[selectedMetric].totalValue)}
						</strong>
					</RankedListItem>
				{/each}
			</div>
		</div>
	</div>
</div>

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