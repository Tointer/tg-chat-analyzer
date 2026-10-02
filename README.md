
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
Open **Settings** in the app to import a Telegram Desktop JSON or HTML export and select it for analysis. You can still put `result.json` in `src/messages` as the original export.

To merge exports, add files from the same chat and arrange them **oldest export first**. You can add files one at a time from different folders; new selections are appended. Each selection is initially sorted by file modification times, so check the order when files have been copied. JSON chat ID and chat kind must match; renaming a chat or changing its public/private visibility is allowed. The first occurrence of a message ID wins, and messages missing from later exports remain in the merged history. All JSON export fields are preserved, and the result can be downloaded as Telegram-compatible JSON. Importing or merging does not change the current analysis; choose **Analyze this export** separately when you want to switch.

For HTML, use **Add HTML export folder** and select the `ChatExport_...` folder. The helper loads all `messages.html`, `messages2.html`, etc. as one export and skips scripts, styles, and media files. Missing linked pages are rejected to prevent incomplete imports. Alternatively, select every HTML page with the file picker. Add separate HTML exports with the folder picker so their pages stay grouped.

HTML converts on the server to the same message model as JSON: IDs, timezone-aware timestamps, text, replies, forwards, reactions, media types, and recognizable membership events are retained. Visible markup is preserved as inert `html_content` for unsupported details; `text_entities` contains plain text rather than claiming exact JSON formatting. HTML does not contain the numeric chat or sender IDs, and omits exact service-event timestamps. Standalone HTML uses a synthetic chat identity and groups senders by displayed name; users sharing a name cannot be reliably distinguished. Service times are estimated from surrounding messages and marked `html_date_inferred`. A mixed merge requires at least three shared message IDs with identical timestamps; a matching chat title alone is insufficient. JSON restores available sender IDs and exact service times without replacing older HTML text or reaction counts. Converted downloads include `_telegram_html` provenance. Fields never present in HTML cannot be fully reconstructed.

Imported and merged logs are stored in `src/messages/imports`, with the active selection in `src/messages/selection.json`. These files are ignored by Git. Selection is shared by this local server and survives restarts. The original file is never overwritten. JSON imports do not copy the referenced media files.

The upload helper accepts up to 2,000 JSON files/HTML pages with a combined size of 512 MB. Deployment servers must allow the corresponding request size and provide persistent writable storage for `src/messages`.

## Dev run

Install dependencies: `bun install`
Start a development server: `bun run dev`
