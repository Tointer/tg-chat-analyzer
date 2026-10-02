<script lang="ts">
	import type { AppThemeName } from '$lib';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	type Props = {
		chatName: string;
		activeThemeLabel: string;
		nextThemeLabel: string;
		themeName: AppThemeName;
		onToggleTheme: () => void;
	};

	let { chatName, activeThemeLabel, nextThemeLabel, themeName, onToggleTheme }: Props = $props();
</script>

<section class="relative z-10 mb-2">
	<div class="flex flex-wrap items-end justify-between gap-4">
		<div class="min-w-0 flex-1">
			<p class="m-0 text-sm uppercase tracking-widest text-app-accent">Chat Stats</p>
			<h1 class="mt-2 mb-0 break-words text-5xl leading-none font-display sm:text-6xl lg:text-7xl">
				{chatName}
			</h1>
		</div>
		<div class="ml-auto flex shrink-0 translate-y-3 items-center gap-4">
		<a href={resolve(`/settings?period=${page.url.searchParams.get('period') === 'day' ? 'day' : 'week'}`)} class="inline-flex h-9 items-center rounded-xl border border-app-border bg-app-surface-alt px-4 text-sm text-app-muted hover:text-app-text">Settings</a>
		<button
			type="button"
			class="relative inline-flex h-9 w-16 shrink-0 items-center rounded-full border border-app-border bg-app-surface-alt p-1 shadow-app-card transition-colors duration-150 hover:bg-app-surface"
			aria-label={`Switch theme. Current theme: ${activeThemeLabel}. Next theme: ${nextThemeLabel}.`}
			onclick={onToggleTheme}
		>
			<span class="sr-only">Toggle theme</span>
			<span
				class={`block h-7 w-7 rounded-full bg-app-accent-strong shadow-app-button transition-transform duration-200 ${themeName === 'midnight' ? 'translate-x-0' : 'translate-x-7'}`}
			></span>
		</button>
		</div>
	</div>
</section>
