import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
from helpers.supabase_mock import SupabaseMock

SCREENSHOTS = Path(__file__).parent / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)


async def test_privacy_mode_masks_amounts():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        mock = SupabaseMock()
        await mock.install(page)

        await page.goto("http://localhost:8080/")
        await page.wait_for_selector("text=Finance Overview", timeout=10000)

        # Toggle privacy mode via the eye icon button
        await page.click("button[aria-label='Toggle privacy mode']")
        await page.wait_for_selector("text=₹ ••••••")

        await page.screenshot(path=str(SCREENSHOTS / "privacy_mode.png"))
        print("PASS: privacy mode masks amounts")
        await browser.close()


async def test_rbac_hides_add_button():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 900})
        mock = SupabaseMock()
        await mock.install(page)

        await page.goto("http://localhost:8080/transactions")
        await page.wait_for_selector("h1:has-text('Transactions')", timeout=10000)

        # Add button should be visible in admin mode
        assert await page.is_visible("button:has-text('Add')")

        # Toggle to viewer via the role button in the top bar
        await page.click("button:has-text('admin')")
        await page.wait_for_selector("text=Viewer mode")
        assert await page.is_visible("button:has-text('Add')") is False

        await page.screenshot(path=str(SCREENSHOTS / "rbac_viewer.png"))
        print("PASS: RBAC toggle hides add button in viewer mode")
        await browser.close()


async def main():
    await test_privacy_mode_masks_amounts()
    await test_rbac_hides_add_button()


if __name__ == "__main__":
    asyncio.run(main())
