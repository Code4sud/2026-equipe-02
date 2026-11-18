"""
Tests de la normalisation et de la similarité des noms de métiers.

Lancer :  python -m pytest tests/
Le dernier test compare Python et JavaScript (il faut Node.js installé).
"""

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "src"))

from similarite import normaliser, similarite  # noqa: E402

# Exemples inventés ou tirés des référentiels publics (jamais des rapports privés)
EXEMPLES = [
    "Serveur / Serveuse",
    "serveur/euse en restauration (restaurant, café-bar-brasserie)",
    "Agent / Agente de silo",
    "Chanteur / musicien",
    "ASH (Agent de Service Hospitalier)",
    "Peintre - Plaquiste",
    "Hôte / Hôtesse d'accueil",
    "Œnologue",
    "",
]


def test_normaliser_genre():
    assert normaliser("Serveur / Serveuse") == "serveur"
    assert normaliser("Agent / Agente de silo") == "agent silo"
    assert normaliser("serveur/euse en restauration (café)") == "serveur restauration"


def test_normaliser_slash_ou():
    assert normaliser("Chanteur / musicien") == "chanteur musicien"


def test_normaliser_sigle():
    assert normaliser("ASH (Agent de service hospitalier)") == "agent service hospitalier"


def test_similarite_bornes():
    assert similarite("serveur", "serveur") == 1.0
    assert similarite("", "serveur") == 0.0
    assert similarite("serveur", "cuisinier") < 0.5


def test_pas_de_faux_ami():
    # Aucun mot entier en commun : jamais « sûr »
    assert similarite(normaliser("Charcutier"), normaliser("Chaudronnier")) <= 0.7


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js absent")
def test_python_et_javascript_identiques():
    paires = [(a, b) for a in EXEMPLES for b in EXEMPLES]
    script = (
        "import { normaliser, similarite } from './js/similarite.js';"
        f"const paires = {json.dumps(paires, ensure_ascii=False)};"
        "console.log(JSON.stringify(paires.map(([a, b]) => "
        "[normaliser(a), similarite(normaliser(a), normaliser(b))])));"
    )
    sortie = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=RACINE, capture_output=True, text=True, check=True,
    ).stdout
    js = json.loads(sortie)
    py = [[normaliser(a), similarite(normaliser(a), normaliser(b))] for a, b in paires]
    assert js == py
