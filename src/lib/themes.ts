import { browser } from '$app/environment';
import { writable } from 'svelte/store';

export type AppThemeName = 'midnight' | 'dawn';

export type AppTheme = {
	name: AppThemeName;
	label: string;
	className: `theme-${AppThemeName}`;
	chart: {
		replyBar: string;
		replyBarHover: string;
		nonReplyBar: string;
		nonReplyBarHover: string;
		imageBar: string;
		imageBarHover: string;
		videoBar: string;
		videoBarHover: string;
		gifBar: string;
		gifBarHover: string;
		stickerBar: string;
		stickerBarHover: string;
		audioBar: string;
		audioBarHover: string;
		documentBar: string;
		documentBarHover: string;
		legendText: string;
		axisText: string;
		grid: string;
		tooltipBackground: string;
		tooltipBorder: string;
		tooltipTitle: string;
		tooltipBody: string;
		tooltipFooter: string;
	};
};

export const appThemes = {
	midnight: {
		name: 'midnight',
		label: 'Midnight',
		className: 'theme-midnight',
		chart: {
			replyBar: '#9a6b3a',
			replyBarHover: '#b08968',
			nonReplyBar: '#f97316',
			nonReplyBarHover: '#fb923c',
			imageBar: '#d97706',
			imageBarHover: '#f59e0b',
			videoBar: '#7c3aed',
			videoBarHover: '#8b5cf6',
			gifBar: '#0f766e',
			gifBarHover: '#14b8a6',
			stickerBar: '#db2777',
			stickerBarHover: '#ec4899',
			audioBar: '#0284c7',
			audioBarHover: '#38bdf8',
			documentBar: '#78716c',
			documentBarHover: '#a8a29e',
			legendText: '#f6ede2',
			axisText: '#cbb8a5',
			grid: 'rgba(203, 184, 165, 0.12)',
			tooltipBackground: 'rgba(18, 13, 10, 0.94)',
			tooltipBorder: 'rgba(251, 146, 60, 0.24)',
			tooltipTitle: '#fff7ed',
			tooltipBody: '#f6ede2',
			tooltipFooter: '#bef264'
		}
	},
	dawn: {
		name: 'dawn',
		label: 'Dawn',
		className: 'theme-dawn',
		chart: {
			replyBar: '#2f6f43',
			replyBarHover: '#3f8754',
			nonReplyBar: '#9fd8a8',
			nonReplyBarHover: '#88c993',
			imageBar: '#f59e0b',
			imageBarHover: '#fbbf24',
			videoBar: '#6366f1',
			videoBarHover: '#818cf8',
			gifBar: '#0f766e',
			gifBarHover: '#14b8a6',
			stickerBar: '#ec4899',
			stickerBarHover: '#f472b6',
			audioBar: '#0369a1',
			audioBarHover: '#0284c7',
			documentBar: '#57534e',
			documentBarHover: '#78716c',
			legendText: '#27272a',
			axisText: '#3f3f46',
			grid: 'rgba(15, 23, 42, 0.08)',
			tooltipBackground: 'rgba(255, 255, 255, 0.96)',
			tooltipBorder: 'rgba(15, 118, 110, 0.12)',
			tooltipTitle: '#18181b',
			tooltipBody: '#3f3f46',
			tooltipFooter: '#0f766e'
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