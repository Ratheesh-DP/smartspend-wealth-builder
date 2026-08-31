import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from helpers.supabase_mock import SupabaseMock

SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)


async def test_app_loads_without_login():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        mock = SupabaseMock()
        await mock.install(page)

        await page.goto("http://localhost:8080/")
        await page.wait_for_selector("text=Finance Overview", timeout=10000)
        await page.screenshot(path=str(SCREENSHOTS / "smoke_loads.png"))
        print("PASS: app loads without login")
        await browser.close()


async def test_sidebar_navigation():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        mock = SupabaseMock()
        await mock.install(page)

        await page.goto("http://localhost:8080/")
        await page.click("a:has-text('Transactions')")
        await page.wait_for_url("**/transactions")
        await page.wait_for_selector("h1:has-text('Transactions')")

        await page.click("a:has-text('Insights')")
        await page.wait_for_url("**/insights")
        await page.wait_for_selector("h1:has-text('Smart Insights')")

        await page.screenshot(path=str(SCREENSHOTS / "smoke_navigation.png"))
        print("PASS: sidebar navigation works")
        await browser.close()


async def main():
    await test_app_loads_without_login()
    await test_sidebar_navigation()


if __name__ == "__main__":
    asyncio.run(main())
