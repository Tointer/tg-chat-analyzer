<script lang="ts">
	import RankedListItem from './RankedListItem.svelte';
	import type { ReplyFavoriteEntry } from './UserInfoSection.types';

	type Props = {
		favorites: ReplyFavoriteEntry[];
		expandedFavoriteId: string | null;
		onToggleFavoriteDetails: (targetUserId: string) => void;
	};

	let { favorites, expandedFavoriteId, onToggleFavoriteDetails }: Props = $props();
	const numberFormatter = new Intl.NumberFormat('en-US');
	const decimalFormatter = new Intl.NumberFormat('en-US', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1
	});

	function formatSignedDecimal(value: number) {
		const absoluteValue = decimalFormatter.format(Math.abs(value));
		return `${value > 0 ? '+' : value < 0 ? '-' : ''}${absoluteValue}`;
	}
</script>

<div class="user-list-scroll min-h-0 flex-1 overflow-y-auto pr-1">
	{#if favorites.length > 0}
		<div class="space-y-3">
			{#each favorites as favorite, index (favorite.targetUserId)}
				<RankedListItem rank={index + 1} contentClass="min-w-0 flex-1 p-4">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div class="flex min-w-0 items-start gap-3">
							<div class="min-w-0">
								<h4 class="m-0 truncate text-base font-semibold text-app-text sm:text-lg">{favorite.targetUserName}</h4>
								<div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-app-muted">
									<span>
										Observed {numberFormatter.format(favorite.observedReplies)} replies vs expected {decimalFormatter.format(favorite.expectedReplies)}
									</span>
									<button
										type="button"
										class="flex h-5 min-w-5 items-center justify-center rounded-full border border-app-border bg-app-surface-strong px-1 text-[11px] font-semibold text-app-muted transition-colors hover:text-app-text"
										aria-expanded={expandedFavoriteId === favorite.targetUserId}
										aria-label={`${expandedFavoriteId === favorite.targetUserId ? 'Hide' : 'Show'} overlap details for ${favorite.targetUserName}`}
										onclick={() => onToggleFavoriteDetails(favorite.targetUserId)}
									>
										<span class={`transition-transform duration-200 ${expandedFavoriteId === favorite.targetUserId ? 'rotate-180' : ''}`}>▾</span>
									</button>
								</div>
							</div>
						</div>
						<div class="text-right">
							<p class="m-0 text-xs uppercase tracking-widest text-app-subtle">Score</p>
							<strong class="mt-2 block text-2xl font-display text-app-text">{formatSignedDecimal(favorite.favoriteScore)}</strong>
						</div>
					</div>
					{#if expandedFavoriteId === favorite.targetUserId}
						<div class="mt-4 grid gap-3 border-t border-app-border pt-4 text-sm text-app-muted sm:grid-cols-3">
							<div>
								<p class="m-0 text-[11px] uppercase tracking-widest text-app-subtle">Excess replies</p>
								<strong class="mt-1 block text-base font-display text-app-text">{formatSignedDecimal(favorite.residual)}</strong>
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
					{/if}
				</RankedListItem>
			{/each}
		</div>
	{:else}
		<p class="grid h-full place-items-center rounded-2xl border border-dashed border-app-border bg-app-empty p-6 text-center text-base text-app-muted">
			This user does not have enough reply activity to estimate favorites yet.
		</p>
	{/if}
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