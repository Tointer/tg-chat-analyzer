<script lang="ts">
	import type { AppThemeName } from '$lib';

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
	<div class="flex items-end justify-between gap-4">
		<div class="min-w-0">
			<p class="m-0 text-sm uppercase tracking-widest text-app-accent">Chat Stats</p>
			<h1 class="mt-2 mb-0 text-5xl leading-none font-display sm:text-6xl lg:text-7xl">
				{chatName}
			</h1>
		</div>
		<button
			type="button"
			class="relative ml-auto inline-flex h-9 w-16 shrink-0 translate-y-3 items-center rounded-full border border-app-border bg-app-surface-alt p-1 shadow-app-card transition-colors duration-150 hover:bg-app-surface"
			aria-label={`Switch theme. Current theme: ${activeThemeLabel}. Next theme: ${nextThemeLabel}.`}
			onclick={onToggleTheme}
		>
			<span class="sr-only">Toggle theme</span>
			<span
				class={`block h-7 w-7 rounded-full bg-app-accent-strong shadow-app-button transition-transform duration-200 ${themeName === 'midnight' ? 'translate-x-0' : 'translate-x-7'}`}
			></span>
		</button>
	</div>
</section>