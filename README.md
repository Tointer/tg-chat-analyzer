
![Telegram Chat Analyzer](./docs/image.png)

# Telegram Chat Analyzer

Small web app to explore Telegram group chat export data locally

## What it can do

- Show message activity over time by day or week
- Break down per-user stats for messages, characters, media, and average activity
- Surface reply relationships and favorite reply peers
- Highlight top messages by reactions and replies
- Inspect first-order replies for standout messages

## Counting and loading

- Message and media totals include voice messages, audio files, and documents.
- Charts retain the first and last buckets, including partial periods.
- Sent replies are counted even when the target message is absent from the export.
- Participant charts and reply-peer analysis share membership intervals. Name-only events are resolved only when the name identifies one user in the export.
- The server caches prepared analytics and refreshes them when the export file changes. Restarting the server clears the cache.

## What it can't do
- It can't show actual images and videos in messages highlight section
- Custom time range is not supported yet
- It will probably break if there is too little messages or time horizon is too big, I didn't stress test it


## How to use
For now, by putting "result.json" from telegram chat export to the ./src/messages folder, and run it in any way

## Dev run

Install dependencies: `bun install`
Start a development server: `bun run dev`