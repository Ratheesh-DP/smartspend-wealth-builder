import json
import time
from typing import Any, Dict, List

SAMPLE_TRANSACTIONS: List[Dict[str, Any]] = [
    {
        "id": "tx-1",
        "description": "Monthly Salary",
        "amount": 75000,
        "type": "income",
        "category": "Salary",
        "date": "2026-08-01",
        "user_id": "guest",
    },
    {
        "id": "tx-2",
        "description": "Rent",
        "amount": -22000,
        "type": "expense",
        "category": "Housing",
        "date": "2026-08-02",
        "user_id": "guest",
    },
    {
        "id": "tx-3",
        "description": "Swiggy Order",
        "amount": -650,
        "type": "expense",
        "category": "Food",
        "date": "2026-08-05",
        "user_id": "guest",
    },
    {
        "id": "tx-4",
        "description": "Freelance Payment",
        "amount": 15000,
        "type": "income",
        "category": "Freelance",
        "date": "2026-08-10",
        "user_id": "guest",
    },
    {
        "id": "tx-5",
        "description": "Petrol",
        "amount": -1200,
        "type": "expense",
        "category": "Transport",
        "date": "2026-08-12",
        "user_id": "guest",
    },
]


class SupabaseMock:
    def __init__(self):
        self.transactions = [dict(t) for t in SAMPLE_TRANSACTIONS]

    def reset(self):
        self.transactions = [dict(t) for t in SAMPLE_TRANSACTIONS]

    async def handle_route(self, route, request):
        url = request.url
        method = request.method

        if "/functions/v1/sheets-transactions" in url and method == "POST":
            await route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({"source": "Google Sheets", "sheetTitle": "Transactions", "transactions": self.transactions}),
            )
            return

        if "/rest/v1/transactions" in url and method == "GET":
            await route.fulfill(
                status=200,
                content_type="application/json",
                headers={"content-range": f"0-{len(self.transactions) - 1}/{len(self.transactions)}"},
                body=json.dumps(self.transactions),
            )
            return

        if "/rest/v1/transactions" in url and method == "POST":
            body = json.loads(request.post_data or "[]")
            rows = body if isinstance(body, list) else [body]
            new_rows = []
            for row in rows:
                new_row = dict(row)
                new_row["id"] = f"tx-{int(time.time() * 1000)}-{len(self.transactions)}"
                self.transactions.append(new_row)
                new_rows.append(new_row)
            await route.fulfill(
                status=201,
                content_type="application/json",
                body=json.dumps(new_rows),
            )
            return

        if "/rest/v1/transactions" in url and method == "DELETE":
            # Parse id=eq.<value> query param
            if "id=eq." in url:
                eq_value = url.split("id=eq.")[-1].split("&")[0]
                self.transactions = [t for t in self.transactions if t["id"] != eq_value]
            await route.fulfill(status=204)
            return

        await route.continue_()

    async def install(self, page):
        self.reset()
        await page.route("**/rest/v1/**", self.handle_route)
        await page.route("**/functions/v1/**", self.handle_route)
