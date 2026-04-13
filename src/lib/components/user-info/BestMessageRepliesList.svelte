<script lang="ts">
	import type { BestMessageEntry } from './UserInfoSection.types';

	type Props = {
		replies: BestMessageEntry['replies'];
	};

	let { replies }: Props = $props();
</script>

<div class="mt-4 space-y-2 border-t border-app-border/70 pt-4">
	{#each replies as reply (reply.messageId)}
		<div class="rounded-xl bg-app-surface-alt/70 px-3 py-2">
			<p class="m-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-app-accent">
				{reply.authorName}
			</p>
			<p class="mt-1 text-sm leading-5 text-app-text">{reply.preview}</p>
		</div>
	{/each}
</div>