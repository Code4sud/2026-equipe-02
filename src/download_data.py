"""
Étape 1 : télécharger les données publiques ouvertes dans data/raw/.

Lancer :  python src/download_data.py

Pourquoi un script ? Les fichiers bruts ne sont pas mis dans git (trop lourds).
N'importe qui dans l'équipe peut les retélécharger avec cette seule commande.
Toutes les sources (URL, licence, date) sont décrites dans docs/sources.md.
"""

import zipfile
from pathlib import Path

import requests  # pour télécharger des fichiers par HTTP

# Dossier où ranger les fichiers bruts
RAW = Path(__file__).resolve().parent.parent / "data" / "raw"

# Nom du fichier local -> URL officielle (vérifiée le 18/11/2026)
SOURCES = {
    # ROME 4.0, France Travail, Licence Ouverte : toutes les données du ROME (zip de CSV)
    "rome_csv.zip": "https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/csv",
    # ONISEP Idéo-Fiches métiers, ODbL : fiches détaillées (XML) avec niveau d'accès et formations
    "onisep_fiches_metiers.zip": "https://data.onisep.fr/api/v1/downloads/5fe0808a2da6f/5fe0808a2da6f.zip",
    # ONISEP Idéo-Formations initiales en France, ODbL : la liste des formations (diplômes)
    "onisep_formations.csv": "https://data.onisep.fr/api/v1/downloads/5fa591127f501/5fa591127f501.csv",
    # ONISEP Idéo-Actions de formation Provence-Alpes-Côte d'Azur, ODbL : où se préparent les formations en Région Sud
    "onisep_actions_paca.zip": "https://data.onisep.fr/api/v1/downloads/5fa4389e34b6a/5fa4389e34b6a.zip",
    # Parcoursup 2025, MESR, Licence Ouverte : lieu, sélection (taux d'accès), statut public/privé
    "parcoursup_2025.csv": (
        "https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/"
        "datasets/fr-esr-parcoursup/exports/csv?delimiter=%3B"
    ),
}


def telecharger(nom, url):
    """Télécharge un fichier s'il n'est pas déjà là, puis le dézippe si besoin."""
    chemin = RAW / nom
    if chemin.exists() and chemin.stat().st_size > 0:
        print(f"déjà présent : {nom}")
    else:
        print(f"téléchargement : {nom} ...")
        reponse = requests.get(url, timeout=300)
        reponse.raise_for_status()  # arrête le script si le serveur renvoie une erreur
        chemin.write_bytes(reponse.content)
        print(f"  ok, {len(reponse.content) / 1e6:.1f} Mo")

    # Les .zip sont décompressés dans un dossier du même nom (sans .zip)
    if nom.endswith(".zip"):
        dossier = RAW / nom.replace(".zip", "")
        if not dossier.exists():
            with zipfile.ZipFile(chemin) as z:
                z.extractall(dossier)


if __name__ == "__main__":
    RAW.mkdir(parents=True, exist_ok=True)
    for nom, url in SOURCES.items():
        telecharger(nom, url)
    print("Terminé. Fichiers dans", RAW)
