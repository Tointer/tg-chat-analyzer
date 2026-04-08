import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type AppThemeName = 'midnight' | 'dawn';

export type AppTheme = {
	name: AppThemeName;
	label: string;
	className: `theme-${AppThemeName}`;
	chart: {
		mediaBar: string;
		mediaBarHover: string;
		textBar: string;
		textBarHover: string;
		legendText: string;
		axisText: string;
		grid: string;
		tooltipBackground: string;
		tooltipBorder: string;
		tooltipTitle: string;
		tooltipBody: string;
		tooltipFooter: string;
	};
	miniArea: {
		line: string;
		fill: string;
		overlay: string;
	};
};

export const appThemes = {
	midnight: {
		name: 'midnight',
		label: 'Midnight',
		className: 'theme-midnight',
		chart: {
			mediaBar: '#84cc16',
			mediaBarHover: '#a3e635',
			textBar: '#f97316',
			textBarHover: '#fb923c',
			legendText: '#f6ede2',
			axisText: '#cbb8a5',
			grid: 'rgba(203, 184, 165, 0.12)',
			tooltipBackground: 'rgba(18, 13, 10, 0.94)',
			tooltipBorder: 'rgba(251, 146, 60, 0.24)',
			tooltipTitle: '#fff7ed',
			tooltipBody: '#f6ede2',
			tooltipFooter: '#bef264'
		},
		miniArea: {
			line: '#f97316',
			fill: 'rgba(249, 115, 22, 0.18)',
			overlay: '#84cc16'
		}
	},
	dawn: {
		name: 'dawn',
		label: 'Dawn',
		className: 'theme-dawn',
		chart: {
			mediaBar: '#f59e0b',
			mediaBarHover: '#d97706',
			textBar: '#0f766e',
			textBarHover: '#115e59',
			legendText: '#27272a',
			axisText: '#3f3f46',
			grid: 'rgba(15, 23, 42, 0.08)',
			tooltipBackground: 'rgba(255, 255, 255, 0.96)',
			tooltipBorder: 'rgba(15, 118, 110, 0.12)',
			tooltipTitle: '#18181b',
			tooltipBody: '#3f3f46',
			tooltipFooter: '#0f766e'
		},
		miniArea: {
			line: '#0f766e',
			fill: 'rgba(15, 118, 110, 0.14)',
			overlay: '#f59e0b'
		}
	}
} satisfies Record<AppThemeName, AppTheme>;

export const themeOrder = Object.keys(appThemes) as AppThemeName[];
export const defaultThemeName: AppThemeName = 'midnight';
export const defaultTheme = appThemes[defaultThemeName];

const storageKey = 'tg-chat-analyzer.theme';
let didInitializeThemeStore = false;

export const activeThemeName = writable<AppThemeName>(defaultThemeName);

function isThemeName(value: string | null): value is AppThemeName {
	return value !== null && value in appThemes;
}

export function getTheme(name: AppThemeName): AppTheme {
	return appThemes[name];
}

export function setTheme(name: AppThemeName) {
	activeThemeName.set(name);
}

export function cycleTheme() {
	activeThemeName.update((currentName) => {
		const currentIndex = themeOrder.indexOf(currentName);
		const nextIndex = (currentIndex + 1) % themeOrder.length;
		return themeOrder[nextIndex] ?? defaultThemeName;
	});
}

export function initializeThemeStore() {
	if (!browser || didInitializeThemeStore) {
		return;
	}

	didInitializeThemeStore = true;

	const storedThemeName = window.localStorage.getItem(storageKey);
	if (isThemeName(storedThemeName)) {
		activeThemeName.set(storedThemeName);
	}

	activeThemeName.subscribe((themeName) => {
		window.localStorage.setItem(storageKey, themeName);
	});
}