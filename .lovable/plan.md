# Real-data finance workflows and Zerodha analysis

## Outcome
Connect the existing dashboard workflows to real transaction data, provide a transparent short-term cash projection, and extend the Zerodha Signals workspace with daily-price charts and AI trend commentary.

## Work
1. **Google Sheets access and honest verification**
   - Show the spreadsheet permission issue and clear sharing steps: share the file with the Google account connected to Lovable Sheets, then refresh the dashboard.
   - Recheck the actual sheet after access is granted; compare imported rows and dashboard totals against the sheet rather than claiming unverified totals.
2. **Beru and statement reconciliation**
   - Keep Beru grounded in the loaded transaction feed and surface safe function errors.
   - Deploy Beru and OCR only when the hosted backend is active. Run a real transaction Q&A after deployment and data access are working.
   - After a statement is uploaded and reviewed in Controller, let the user add confirmed statement rows to the local transaction feed; preserve match status, amount/date comparisons, and unresolved exceptions. Refresh transaction-dependent screens after import.
3. **Budgets and cash forecast**
   - Ensure budget alerts recalculate from the refreshed transaction feed after statement imports.
   - Add a dedicated Cash Forecast page using historical income/expenses and saved budgets, with visible assumptions and a month-by-month projection for the next few months. Do not invent opening cash or recurring income; identify missing assumptions clearly.
4. **Zerodha Signals enhancements**
   - Add selected-stock daily OHLC/volume candles, SMA overlays, and crossover markers to the Signals workspace.
   - Add a secure server-side AI Gateway action that explains user-provided ticker/signal/candles, including trend context, uncertainty, and potential risks. Validate and cap input, keep credentials off the browser, and show gateway errors faithfully.

## Technical approach
- Preserve the React/Vite app, current semantic design system, transaction loader, local budget storage, and Lovable Cloud edge-function boundary.
- Add one forecast route/page and a sidebar entry; keep market chart and AI analysis in the existing Zerodha Signals area.
- Keep statement imports in the current guest/local-storage transaction model and invalidate the shared React Query transaction key after confirmation.
- The spreadsheet currently returns Google `403 PERMISSION_DENIED`; the hosted database is paused. Live sheet totals, deployed edge functions, real Q&A, and real OCR matching cannot be truthfully verified until access is fixed, the backend is resumed, and a statement is uploaded.
