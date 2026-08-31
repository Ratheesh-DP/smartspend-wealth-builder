import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from helpers.supabase_mock import SupabaseMock, SAMPLE_TRANSACTIONS

SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)


async def test_transactions_list():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        mock = SupabaseMock()
        await mock.install(page)

        await page.goto("http://localhost:8080/transactions")
        await page.wait_for_selector("h1:has-text('Transactions')", timeout=10000)

        for tx in SAMPLE_TRANSACTIONS:
            await page.wait_for_selector(f"text={tx['description']}")

        await page.screenshot(path=str(SCREENSHOTS / "transactions_list.png"))
        print("PASS: transactions page lists all transactions")
        await browser.close()


async def test_transactions_search_filter():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        mock = SupabaseMock()
        await mock.install(page)

        await page.goto("http://localhost:8080/transactions")
        await page.wait_for_selector("h1:has-text('Transactions')", timeout=10000)

        await page.fill("input[placeholder='Search...']", "Swiggy")
        await page.wait_for_selector("text=Swiggy Order")
        assert await page.is_visible("text=Monthly Salary") is False

        await page.screenshot(path=str(SCREENSHOTS / "transactions_search.png"))
        print("PASS: transactions search filter works")
        await browser.close()


async def test_transactions_type_filter():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        mock = SupabaseMock()
        await mock.install(page)

        await page.goto("http://localhost:8080/transactions")
        await page.wait_for_selector("h1:has-text('Transactions')", timeout=10000)

        # Open the type filter select (first Select on the page)
        selects = await page.query_selector_all("button[role='combobox']")
        await selects[0].click()
        await page.click("div[role='option']:has-text('Income')")

        await page.wait_for_selector("text=Monthly Salary")
        assert await page.is_visible("text=Rent") is False

        await page.screenshot(path=str(SCREENSHOTS / "transactions_type_filter.png"))
        print("PASS: transactions type filter works")
        await browser.close()


async def test_add_transaction():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        mock = SupabaseMock()
        await mock.install(page)

        await page.goto("http://localhost:8080/transactions")
        await page.wait_for_selector("h1:has-text('Transactions')", timeout=10000)

        # Click the page-level "+ Add" button (not the TopBar "Add Transaction")
        add_btn = page.get_by_role("button", name="Add", exact=True)
        await add_btn.click()
        dialog = page.locator("[role='dialog']")
        await dialog.wait_for(timeout=10000)
        await dialog.locator("text=Add Transaction").wait_for(timeout=10000)

        # Type = Expense (default)
        # Open the Category select inside the dialog
        category_combobox = dialog.locator("button[role='combobox']").last
        await category_combobox.click()
        await page.click("div[role='option']:has-text('Food')")

        await dialog.locator("input[placeholder='e.g. Swiggy Order']").fill("Test Expense")
        await dialog.locator("input[type='number']").fill("500")

        await dialog.locator("button:has-text('Add Transaction')").click()
        await page.wait_for_selector("text=Test Expense")
        await page.wait_for_selector("text=₹500.00")

        await page.screenshot(path=str(SCREENSHOTS / "transactions_add.png"))
        print("PASS: adds a new transaction")
        await browser.close()


async def main():
    await test_transactions_list()
    await test_transactions_search_filter()
    await test_transactions_type_filter()
    await test_add_transaction()


if __name__ == "__main__":
    asyncio.run(main())
