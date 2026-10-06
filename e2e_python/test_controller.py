import asyncio
import base64
import datetime
import json
from pathlib import Path
from playwright.async_api import async_playwright

sys_path = str(Path(__file__).parent)
import sys
sys.path.insert(0, sys_path)
from helpers.supabase_mock import SupabaseMock

SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        await page.goto("http://localhost:8080/controller")
        await page.wait_for_selector("h1:has-text('Run the books and the cash position')", timeout=10000)
        assert await page.locator("text=64").count() >= 1
        assert await page.locator("text=92.2%").count() >= 1
        assert await page.locator("text=5 unresolved").count() >= 1
        await page.get_by_role("button", name="Run reconciliation").click()
        await page.wait_for_selector("text=Run #2", timeout=3000)
        await page.screenshot(path=str(SCREENSHOTS / "controller.png"))
        print("PASS: finance controller reports full batch, match rate, cash position, and exceptions")

        review_page = await browser.new_page(viewport={"width": 1280, "height": 900})
        mock = SupabaseMock()
        await mock.install(review_page)
        today = datetime.date.today().isoformat()
        current_month = datetime.date.today().month
        current_year = datetime.date.today().year
        await review_page.add_init_script(f"window.localStorage.setItem('smartspend_budgets', JSON.stringify([{{id:'budget-review-test',category:'Utilities',amount:100,month:{current_month},year:{current_year}}}]));")

        async def fake_ocr(route):
            await route.fulfill(status=200, content_type="application/json", body=json.dumps({"transactions": [{
                "id": "ocr-review-test", "description": "Unmatched Pharmacy Purchase", "amount": -250,
                "type": "expense", "category": "Other", "date": today, "source": "ocr"
            }]}))

        await review_page.route("**/functions/v1/ocr-transactions", fake_ocr)
        fake_statement = SCREENSHOTS / "review-statement.png"
        fake_statement.write_bytes(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/fL8AAAAASUVORK5CYII="))
        await review_page.goto("http://localhost:8080/controller")
        await review_page.locator("input[type=file]").set_input_files({"name": "statement.png", "mimeType": "image/png", "buffer": fake_statement.read_bytes()})
        await review_page.get_by_role("button", name="Match rows").click()
        await review_page.get_by_label("Category for Unmatched Pharmacy Purchase").click()
        await review_page.get_by_role("option", name="Utilities").click()
        await review_page.get_by_label("Date for Unmatched Pharmacy Purchase").fill(today)
        await review_page.get_by_label("Amount for Unmatched Pharmacy Purchase").fill("1250")
        await review_page.get_by_role("button", name="Add reviewed unmatched rows").click()
        await review_page.get_by_text("Reviewed", exact=True).wait_for(timeout=5000)
        saved = await review_page.evaluate("JSON.parse(localStorage.getItem('smartspend_imported_transactions') || '[]')")
        added = next((row for row in saved if row["id"] == "ocr-review-test"), None)
        assert added and added["category"] == "Utilities" and added["date"] == today and added["amount"] == -1250 and added["reviewed"] is True
        await review_page.goto("http://localhost:8080/budget")
        await review_page.wait_for_timeout(700)
        await review_page.screenshot(path=str(SCREENSHOTS / "controller_review_budget.png"))
        budget_text = await review_page.locator("body").inner_text()
        assert "₹1,250.00 of ₹100.00" in budget_text
        assert await review_page.get_by_text("1 category is over budget.").count() == 1
        await review_page.goto("http://localhost:8080/")
        await review_page.get_by_text("Unmatched Pharmacy Purchase").wait_for(timeout=5000)
        print("PASS: unmatched statement row edits persist; dashboard and budget feed refresh after confirmation")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
