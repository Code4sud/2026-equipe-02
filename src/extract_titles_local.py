"""
Extraction LOCALE des titres de métiers à partir des vrais Rapports des Possibles.

CONFIDENTIALITÉ : ce script lit des PDF privés (hors du repo) et écrit son
résultat dans data_local/, un dossier ignoré par git. Le résultat ne doit
JAMAIS être commité. Il sert seulement à mesurer le taux de liaison
des métiers des rapports avec ROME / ONISEP (voir src/link_jobs.py).

Lancer :  python src/extract_titles_local.py ../rapports_prives
Outil requis : pdftotext (brew install poppler), qui garde la mise en page.
"""

import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SORTIE = RACINE / "data_local" / "titres_rapports.json"

# Un titre de zone ressemble à « 1ère ZONE DE MÉTIERS » ou « 2ème ZONE DE MÉTIERS »
RE_ZONE = re.compile(r"^\s*([1-5])\s*(?:ère|er|ème|e)\s+ZONE DE M[ÉE]TIERS", re.I)
# Un numéro de page ressemble à « 8/17 »
RE_PAGE = re.compile(r"^\s*\d+\s*/\s*\d+\s*$")


def texte_du_pdf(chemin_pdf):
    """Renvoie le texte du PDF en gardant la mise en page (colonnes, retraits)."""
    resultat = subprocess.run(
        ["pdftotext", "-layout", str(chemin_pdf), "-"],
        capture_output=True, text=True, check=True,
    )
    return resultat.stdout


def extraire_metiers(texte):
    """Repère les titres de métiers dans la partie « champ des possibles ».

    Règle observée : un titre est une ligne courte, très en retrait, sans point final,
    suivie d'une ligne de description qui commence presque au bord gauche.
    """
    lignes = texte.splitlines()
    zone = None
    metiers = []
    for i, ligne in enumerate(lignes):
        m = RE_ZONE.match(ligne)
        if m:
            zone = int(m.group(1))
            continue
        if zone is None or not ligne.strip() or RE_PAGE.match(ligne):
            continue
        # La partie des zones s'arrête à la section suivante du rapport
        if zone == 5 and re.match(r"^\S", ligne) and ligne.isupper():
            zone = None
            continue
        retrait = len(ligne) - len(ligne.lstrip())
        titre = ligne.strip()
        suivante = next((l for l in lignes[i + 1:] if l.strip()), "")
        retrait_suivante = len(suivante) - len(suivante.lstrip())
        if (
            retrait >= 4
            and len(titre) <= 70
            and not titre.endswith((".", ",", ":"))
            and retrait_suivante < retrait
            and not titre.lower().startswith(("métiers accessibles", "un apprentissage"))
        ):
            metiers.append({"zone": zone, "titre": titre})
    return metiers


if __name__ == "__main__":
    dossier = Path(sys.argv[1] if len(sys.argv) > 1 else RACINE.parent / "rapports_prives")
    tous = []
    par_rapport = []
    for pdf in sorted(dossier.glob("rapport-*.pdf")):
        metiers = extraire_metiers(texte_du_pdf(pdf))
        par_rapport.append(len(metiers))
        tous.extend(metiers)

    # On ne garde que des titres génériques et leur zone, aucune description ni identifiant
    # On écarte les parasites évidents (adresse de site web en pied de page)
    tous = [m for m in tous if not re.search(r"\.(org|fr|com)\b", m["titre"], re.I)]
    compte = Counter(m["titre"] for m in tous)
    zones = {}
    for m in tous:
        zones.setdefault(m["titre"], set()).add(m["zone"])
    titres = [
        {"titre": t, "nb_rapports": n, "zones": sorted(zones[t])}
        for t, n in compte.most_common()
    ]
    SORTIE.parent.mkdir(exist_ok=True)
    SORTIE.write_text(json.dumps(titres, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(par_rapport)} rapports, métiers par rapport : {par_rapport}")
    print(f"{len(titres)} titres distincts -> {SORTIE} (local, ignoré par git)")
