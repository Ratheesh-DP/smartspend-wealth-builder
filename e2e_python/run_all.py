import asyncio
import sys
from pathlib import Path

# Make helpers importable from the e2e_python directory
sys.path.insert(0, str(Path(__file__).parent))

from test_smoke import main as smoke_main
from test_dashboard import main as dashboard_main
from test_transactions import main as transactions_main
from test_preferences import main as preferences_main
from test_controller import main as controller_main


async def main():
    print("\n=== E2E Test Suite ===\n")
    await smoke_main()
    await dashboard_main()
    await transactions_main()
    await preferences_main()
    await controller_main()
    print("\n=== All E2E tests passed ===")


if __name__ == "__main__":
    asyncio.run(main())
