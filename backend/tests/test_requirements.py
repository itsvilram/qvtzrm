from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]


def pins(path: Path) -> dict[str, str]:
    """Package name -> pinned requirement line, ignoring comments and extras."""
    lines = (line.strip() for line in path.read_text().splitlines())
    return {
        line.split("==")[0].split("[")[0].lower(): line
        for line in lines
        if "==" in line and not line.startswith("#")
    }


def test_vercel_requirements_use_the_backend_pins():
    backend = pins(BACKEND / "requirements.txt")
    vercel = pins(BACKEND.parent / "requirements.txt")

    assert vercel, "repo-root requirements.txt (used by Vercel) is missing or empty"
    for name, requirement in vercel.items():
        assert backend.get(name) == requirement, f"{name} differs from backend/requirements.txt"
