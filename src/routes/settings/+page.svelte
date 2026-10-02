<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { SvelteMap } from 'svelte/reactivity';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let dialog = $state<HTMLDialogElement>();
	let selectedFiles = $state<File[]>([]);
	const selectedExports = $derived.by(() => {
		const groups = new SvelteMap<string | File, File[]>();
		for (const file of selectedFiles) {
			const path = file.webkitRelativePath || file.name;
			const key = /\.html?$/i.test(file.name) ? path.replace(/[^/]+$/, '') : file;
			const group = groups.get(key) ?? []; group.push(file); groups.set(key, group);
		}
		return [...groups].map(([key, files]) => ({ key, files, label: typeof key === 'string' ? key.replace(/\/$/, '') || 'HTML export pages' : files[0].name }));
	});
	let busy = $state(false);
	const numberFormatter = new Intl.NumberFormat('en-US');
	const inputClass = 'w-full rounded-xl border border-app-border bg-app-surface-alt px-4 py-3 text-app-text focus:border-app-accent focus:ring-app-accent';
	const buttonClass = 'inline-flex items-center justify-center rounded-xl border border-app-border px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-app-surface-alt disabled:cursor-wait disabled:opacity-50';

	function chooseFiles(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const added = [...(input.files ?? [])].filter((file) => /\.json$/i.test(file.name) || /^messages\d*\.html?$/i.test(file.name)).sort((left, right) => left.lastModified - right.lastModified);
		selectedFiles = [...selectedFiles, ...added];
		// The selection lives in state; clear the picker so the same path can be chosen again.
		input.value = '';
	}
	function moveFile(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= selectedExports.length) return;
		const next = [...selectedExports];
		[next[index], next[target]] = [next[target], next[index]];
		selectedFiles = next.flatMap((entry) => entry.files);
	}
	function formatSize(bytes: number) {
		return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

<svelte:head>
	<title>Export settings · Telegram Chat Analyzer</title>
	<meta name="description" content="Import, merge, download, and select Telegram chat exports." />
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
	<a href={resolve('/')} class="text-sm text-app-muted hover:text-app-accent">← Back to analysis</a>
	<header class="mt-6 mb-8 flex flex-wrap items-end justify-between gap-4">
		<div>
			<p class="text-sm uppercase tracking-widest text-app-accent">Settings</p>
			<h1 class="mt-2 text-4xl font-display sm:text-5xl">Your chat exports</h1>
			<p class="mt-3 max-w-2xl text-app-muted">Choose the chat log to analyze, or bring several exports together into one history.</p>
		</div>
		<button type="button" class={`${buttonClass} bg-app-accent-strong text-app-accent-contrast`} onclick={() => dialog?.showModal()}>Import or merge exports</button>
	</header>

	{#if form?.error}
		<p role="alert" class="mb-6 rounded-xl border border-app-border bg-app-surface-alt p-4 text-app-accent">{form.error}</p>
	{/if}
	{#if form?.savedId}
		<div role="status" class="surface-card mb-6 p-5">
			<p class="font-semibold">Saved {form.savedLabel}</p>
			<p class="mt-2 text-sm text-app-muted">{numberFormatter.format(form.messageCount ?? 0)} unique messages. {numberFormatter.format(form.duplicateMessageCount ?? 0)} {form.duplicateMessageCount === 1 ? 'duplicate copy' : 'duplicate copies'} removed.</p>
			<div class="mt-4 flex flex-wrap gap-3">
				<a class={buttonClass} href={resolve('/settings/exports/[id]', { id: form.savedId })} download>Download merged JSON</a>
			</div>
		</div>
	{/if}

	<section class="surface-card overflow-hidden" aria-label="Saved exports">
		<div class="border-b border-app-border p-5 sm:p-6">
			<h2 class="text-xl font-display">Available exports</h2>
			<p class="mt-2 text-sm text-app-muted">Imports are saved locally on the server. Your original result.json remains available.</p>
		</div>
		{#each data.entries as entry (entry.id)}
			<article class="flex flex-wrap items-center justify-between gap-4 border-b border-app-border p-5 last:border-b-0 sm:p-6">
				<div class="min-w-0 flex-1">
					<div class="flex flex-wrap items-center gap-3">
						<h3 class="break-words text-lg font-semibold">{entry.label}</h3>
						{#if entry.id === data.activeId}<span class="rounded-full bg-app-accent-strong px-3 py-1 text-xs font-semibold text-app-accent-contrast">Analyzing</span>{/if}
					</div>
					<p class="mt-2 text-sm text-app-muted">{entry.chatName ? `${entry.chatName} · ` : ''}{entry.messageCount === null ? '' : `${numberFormatter.format(entry.messageCount)} messages · `}{formatSize(entry.bytes)}{entry.sourceCount > 1 ? ` · ${entry.sourceCount} exports merged` : ''}</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<a class={buttonClass} href={resolve('/settings/exports/[id]', { id: entry.id })} download>Download JSON</a>
					{#if entry.id !== data.activeId}
						<form method="POST" action="?/activate" use:enhance>
							<input type="hidden" name="id" value={entry.id} />
							<button class={`${buttonClass} text-app-accent`} type="submit">Analyze this export</button>
						</form>
					{/if}
				</div>
			</article>
		{:else}
			<p class="p-6 text-app-muted">No exports yet. Import a Telegram JSON export to get started.</p>
		{/each}
	</section>
</div>

<dialog bind:this={dialog} aria-labelledby="import-title" class="m-auto max-h-11/12 w-11/12 max-w-2xl overflow-y-auto rounded-3xl border border-app-border bg-app-bg p-0 text-app-text shadow-app-card backdrop:bg-black/70" oncancel={(event) => { if (busy) event.preventDefault(); }}>
	<div class="p-5 sm:p-8">
		<div class="flex items-start justify-between gap-4">
			<div>
				<h2 id="import-title" class="text-2xl font-display">Import or merge exports</h2>
				<p class="mt-2 text-sm text-app-muted">Import JSON files or Telegram HTML export folders. Combine exports from the same chat into one downloadable JSON log.</p>
			</div>
			<button type="button" aria-label="Close import helper" class={buttonClass} disabled={busy} onclick={() => dialog?.close()}>✕</button>
		</div>
		<form method="POST" action="?/merge" enctype="multipart/form-data" class="mt-6 space-y-5" use:enhance={({ formData }) => {
			formData.delete('files');
			formData.delete('folder');
			for (const file of selectedFiles) formData.append('files', file, file.webkitRelativePath || file.name);
			busy = true;
			return async ({ result, update }) => {
				try {
					await update({ reset: result.type === 'success' });
					if (result.type === 'success') { selectedFiles = []; dialog?.close(); }
				} finally { busy = false; }
			};
		}}>
			<label class="block">
				<span class="mb-2 block text-sm font-semibold">Add Telegram export files</span>
				<input class={inputClass} type="file" name="files" accept=".json,.html,.htm,application/json,text/html" multiple disabled={busy} onchange={chooseFiles} />
			</label>
			<label class="block">
				<span class="mb-2 block text-sm font-semibold">Add HTML export folder</span>
				<input class={inputClass} type="file" name="folder" webkitdirectory multiple disabled={busy} onchange={chooseFiles} />
			</label>
			<p class="text-sm text-app-muted">Add files one at a time from different folders, or select several together. Each selection adds to the list below.</p>
			<p class="text-xs text-app-subtle">Up to 2,000 files/pages, 512 MB total. The folder picker includes messages*.html pages and JSON files; media and scripts are skipped. Include every page of an HTML export.</p>
			<p class="text-sm text-app-muted">HTML omits chat and sender IDs. Mixed imports need at least 3 shared messages to verify the chat and recover identities from JSON. HTML-only analysis groups senders by displayed name; exact service times are estimated where absent.</p>
			{#if selectedFiles.length > 0}
				<div class="rounded-2xl border border-app-border bg-app-surface-alt p-4">
					<h3 class="font-semibold">Priority: oldest export first</h3>
					<p class="mt-2 text-sm text-app-muted">Check this order before saving. New selections are added at the end, with each batch sorted by file modification time. These times may change when files are copied. The first file wins when a message appears in more than one export.</p>
					<ol class="mt-4 space-y-3">
						{#each selectedExports as entry, index (entry.key)}
							<li class="flex items-center gap-3 rounded-xl border border-app-border p-3">
								<span class="text-app-accent">{index + 1}</span>
								<div class="min-w-0 flex-1"><p class="break-words text-sm font-semibold">{entry.label}</p><p class="mt-1 text-xs text-app-muted">{entry.files.length > 1 ? `${entry.files.length} pages · ` : ''}{formatSize(entry.files.reduce((sum, file) => sum + file.size, 0))} · Modified {new Date(entry.files[0].lastModified).toLocaleString()}</p></div>
								<button class={buttonClass} type="button" aria-label={`Move ${entry.label} earlier`} disabled={busy || index === 0} onclick={() => moveFile(index, -1)}>↑</button>
								<button class={buttonClass} type="button" aria-label={`Move ${entry.label} later`} disabled={busy || index === selectedExports.length - 1} onclick={() => moveFile(index, 1)}>↓</button>
								<button class={buttonClass} type="button" aria-label={`Remove export ${index + 1}: ${entry.label}`} disabled={busy} onclick={() => { selectedFiles = selectedFiles.filter((file) => !entry.files.includes(file)); }}>✕</button>
							</li>
						{/each}
					</ol>
				</div>
			{/if}
			<label class="block"><span class="mb-2 block text-sm font-semibold">Saved export name (optional)</span><input class={inputClass} type="text" name="label" maxlength="120" placeholder="e.g. Complete chat history" disabled={busy} /></label>
			{#if form?.error}<p role="alert" class="text-sm text-app-accent">{form.error}</p>{/if}
			<p class="text-sm text-app-muted">All messages found in any selected file are kept. Duplicates are matched by message ID, and older copies keep their original text, reactions, and other fields.</p>
			<div class="sticky bottom-0 bg-app-bg pt-4">
				<button type="submit" disabled={busy || selectedFiles.length === 0} class={`${buttonClass} w-full bg-app-accent-strong text-app-accent-contrast`}>{busy ? 'Saving export…' : selectedExports.length > 1 ? 'Merge and save exports' : 'Save export'}</button>
			</div>
		</form>
	</div>
</dialog>
