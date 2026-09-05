import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from helpers.supabase_mock import SupabaseMock, SAMPLE_TRANSACTIONS

SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)


def compute_totals():
    income = sum(abs(t["amount"]) for t in SAMPLE_TRANSACTIONS if t["type"] == "income")
    expenses = sum(abs(t["amount"]) for t in SAMPLE_TRANSACTIONS if t["type"] == "expense")
    balance = income - expenses
    return income, expenses, balance


async def test_dashboard_overview_cards():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        mock = SupabaseMock()
        await mock.install(page)

        await page.goto("http://localhost:8080/")
        await page.wait_for_selector("text=Finance Overview", timeout=10000)

        income, expenses, balance = compute_totals()
        balance_text = f"₹{balance:,.2f}"
        income_text = f"₹{income:,.2f}"
        expense_text = f"₹{expenses:,.2f}"

        await page.wait_for_selector(f"text={balance_text}", timeout=10000)
        await page.wait_for_selector(f"text={income_text}", timeout=10000)
        await page.wait_for_selector(f"text={expense_text}", timeout=10000)

        await page.screenshot(path=str(SCREENSHOTS / "dashboard_overview.png"))
        print("PASS: dashboard overview cards show correct totals")
        await browser.close()


async def test_dashboard_recent_transactions():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        mock = SupabaseMock()
        await mock.install(page)

        await page.goto("http://localhost:8080/")
        await page.wait_for_selector("text=Recent Transactions", timeout=10000)

        for tx in SAMPLE_TRANSACTIONS:
            await page.wait_for_selector(f"text={tx['description']}")

        await page.screenshot(path=str(SCREENSHOTS / "dashboard_recent.png"))
        print("PASS: dashboard shows recent transactions")
        await browser.close()


async def test_dashboard_category_chart():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        mock = SupabaseMock()
        await mock.install(page)

        await page.goto("http://localhost:8080/")
        await page.wait_for_selector("text=Expenses by Category", timeout=10000)
        # Wait for SVG charts to render (Recharts draws in an <svg>)
        await page.wait_for_selector("svg", timeout=10000)

        await page.screenshot(path=str(SCREENSHOTS / "dashboard_chart.png"))
        print("PASS: dashboard renders category chart")
        await browser.close()


async def main():
    await test_dashboard_overview_cards()
    await test_dashboard_recent_transactions()
    await test_dashboard_category_chart()


if __name__ == "__main__":
    asyncio.run(main())
