import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

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
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
