import pytest

from app.snapshot import Snapshot
from tests.samples import sample_snapshot


@pytest.fixture
def snapshot() -> Snapshot:
    return sample_snapshot()
