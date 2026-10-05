# SmartSpend task roadmap

- [ ] Verify real dashboard totals after the user shares the sheet with the Google account connected in Lovable (current access error: Google Sheets 403; backend paused).
- [ ] Deploy Beru and OCR, then verify a real transaction Q&A and real statement reconciliation (blocked until Lovable Cloud resumes, sheet access is granted, and a real statement is uploaded).
- [x] Add confirmed statement-row import, preserve reconciliation outcomes, and refresh budget alerts from the shared transaction feed.
- [x] Add a transparent four-month cash forecast based on transactions and saved budgets, with explicit assumptions.
- [x] Add Zerodha selected-stock daily candle/SMA/crossover chart and server-side AI trend/risk explanation.
- [ ] Verify spreadsheet totals, deployed Beru/OCR/Kite functions, live Q&A, and real statement reconciliation after Sheets access and Lovable Cloud availability are restored. Build and 12 existing E2E tests pass; new live integrations cannot be verified while Cloud is paused.
- [x] Add secure Zerodha Kite login and session reuse (Cloud deployment pending project resume).
- [x] Add Zerodha user profile and Nifty 100 SMA Signals tabs (live API calls pending deployment).
- [x] Document Zerodha dashboard setup and local development.
