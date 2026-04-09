<script lang="ts">
	import AnimatedNumber from '../charts/AnimatedNumber.svelte';

	type Props = {
		totalMessages: number;
		mediaOnlyMessages: number;
	};

	let { totalMessages, mediaOnlyMessages }: Props = $props();
</script>

<article class="surface-card p-5 sm:p-6">
	<p class="m-0 text-sm uppercase tracking-widest text-app-accent">Total messages</p>
	<strong class="mt-2 block text-3xl leading-none font-display sm:text-4xl">
		<AnimatedNumber value={totalMessages} />
	</strong>
	<div class="mt-4 border-t border-app-border pt-3 text-app-muted">
		<span class="block text-xs uppercase tracking-wide text-app-subtle">Media-only messages</span>
		<b class="mt-1.5 block text-base font-semibold text-app-text font-display">
			<AnimatedNumber value={mediaOnlyMessages} duration={700} />
		</b>
	</div>
</article>