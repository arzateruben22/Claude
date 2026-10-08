import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import benchmark  # noqa: E402


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    """Tests never reach Coinbase: the benchmark sees an unreachable network unless a test hands it prices."""
    def no_network(url):
        raise OSError("offline in tests")

    monkeypatch.setattr(benchmark, "fetch_json", no_network)
