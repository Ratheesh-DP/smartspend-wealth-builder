# Sheets recovery and freshness

## User-facing changes
- Add a dashboard status line showing the transaction source mix and the most recent successful Google Sheets read, while retaining the previous successful timestamp when a read fails.
- Add an in-app Google Sheets error explainer that accepts a pasted error, then presents a likely cause and safe recovery steps.

## Technical approach
- Extend `loadTransactions()` to count sheet and local rows and persist/read the last successful Sheets timestamp in browser storage.
- Add a Lovable Cloud edge function that authenticates the signed-in user, validates and bounds the submitted error text, calls `openai/gpt-6-astra` through the streamed Responses API with strict JSON output, and returns safe gateway errors without exposing credentials.
- Add a focused dashboard status view and error-explainer dialog using existing UI patterns; verify freshness and source display, then run relevant existing checks.
- Record the shared data-source/freshness and secure AI boundary conventions in `AGENTS.md`, and update the roadmap.
