"""Vérifie avec pytest que toutes les couleurs du site respectent les contrastes (voir contrastes.py)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from contrastes import mesurer  # noqa: E402


def test_tous_les_contrastes():
    assert mesurer() == []
