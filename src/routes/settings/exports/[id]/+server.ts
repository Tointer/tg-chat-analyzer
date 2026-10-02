import { error } from '@sveltejs/kit';
import { createReadableStream } from '@sveltejs/kit/node';
import { stat } from 'node:fs/promises';
import { exportLibrary } from '$lib/server/export-library';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	let path: string;
	try {
		({ path } = await exportLibrary.read(params.id));
		await stat(path);
	} catch { error(404, 'Export not found.'); }
	return new Response(createReadableStream(path), { headers: {
		'Content-Type': 'application/json; charset=utf-8',
		'Content-Disposition': 'attachment; filename="result.json"',
		'Cache-Control': 'no-store'
	} });
};
