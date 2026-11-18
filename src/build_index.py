"""
Étape 4 : construire l'index JSON léger que le site charge dans le navigateur.

Lancer :  python src/build_index.py   (après clean_data.py et link_jobs.py)

Produit dans data/index/ :
- metiers.json    : toutes les fiches (ONISEP + ROME), chacune avec sa source cliquable
- formations.json : les lieux de formation en Région Sud (chargé seulement si on en a besoin)

Chaque fiche porte « source » : nom du référentiel, lien, licence.
Une valeur absente vaut null : le site affiche alors « inconnu » et l'assistant
dit « je ne sais pas ». On n'invente jamais une valeur.
"""

import json
from datetime import date
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
PROC = RACINE / "data" / "processed"
INDEX = RACINE / "data" / "index"

SOURCE_ONISEP = {"nom": "ONISEP, Idéo-Fiches métiers", "licence": "ODbL"}
SOURCE_ROME = {"nom": "France Travail, ROME 4.0", "licence": "Licence Ouverte 2.0"}
SOURCE_FORMATION = {"nom": "ONISEP, Idéo-Actions de formation Région Sud", "licence": "ODbL"}
SOURCE_PARCOURSUP = {"nom": "Parcoursup 2025 (MESR)", "licence": "Licence Ouverte 2.0"}

# Badge « sans bac » calculé UNIQUEMENT à partir du niveau d'accès minimum publié par l'ONISEP.
#   oui     : le niveau minimum est inférieur au bac (CAP, brevet, sans diplôme)
#   comment : le niveau minimum est le bac. Le bac (par exemple un bac pro) se prépare après la 3e.
#   non     : le niveau minimum est après le bac (bac + 1 et plus)
#   inconnu : l'ONISEP ne donne pas de niveau
NIVEAUX_SANS_BAC = {"sans diplôme", "3E", "diplôme national du brevet",
                    "CAP ou équivalent", "CAP ou équivalent + 1 an"}


def badge_sans_bac(niveau):
    if not niveau or niveau == "autre formation":
        return "inconnu"
    if niveau in NIVEAUX_SANS_BAC:
        return "oui"
    if niveau == "bac ou équivalent":
        return "comment"
    if niveau.startswith("bac +"):
        return "non"
    return "inconnu"


def charger(nom):
    return json.loads((PROC / nom).read_text(encoding="utf-8"))


def construire_metiers():
    onisep = charger("onisep_metiers.json")
    rome = charger("rome_fiches.json")
    liaison = charger("liaison_rome_onisep.json")  # code ROME -> fiches ONISEP
    noms_rome = {f["code"]: f["nom"] for f in rome}

    fiches_onisep = []
    for f in onisep:
        fiches_onisep.append({
            "id": f["id"],
            "nom": f["nom"],
            "noms": f["noms"],
            "resume": f["resume"] or None,
            "journee": f["journee"] or None,
            "acces": f["acces"] or None,
            "niveau_min": f["niveau_min"],
            "sans_bac": badge_sans_bac(f["niveau_min"]),
            "formations": f["formations"],
            "salaire_debutant": f["salaire_debutant"],  # None si l'ONISEP ne le publie pas
            "romes": [{"code": c, "nom": noms_rome[c]} for c in f["romes"] if c in noms_rome],
            "source": {**SOURCE_ONISEP, "url": f["url"]},
        })

    fiches_rome = []
    for f in rome:
        fiches_rome.append({
            "id": f["code"],
            "nom": f["nom"],
            "noms": [f["nom"]] + f["appellations"],
            "resume": f["definition"] or None,
            "acces": f["acces"] or None,
            "sans_bac": "inconnu",  # le ROME ne donne pas de niveau structuré
            "onisep": liaison.get(f["code"], []),
            "source": {**SOURCE_ROME, "url": f["url"]},
        })
    return {
        "genere_le": date.today().isoformat(),
        "onisep": fiches_onisep,
        "rome": fiches_rome,
    }


def construire_formations():
    lignes = charger("formations_paca.json")
    sortie = []
    for l in lignes:
        f = {
            "id": l["formation_id"],
            "intitule": l["intitule"],
            "type": l["type"],
            "niveau": l["niveau"],
            "romes": l["romes"],
            "etablissement": l["etablissement"],
            "statut": l["statut"],
            "ville": l["ville"],
            "cp": l["code_postal"],
            "lat": float(l["lat"]) if l["lat"] else None,
            "lon": float(l["lon"]) if l["lon"] else None,
            "duree_ans": l["duree_ans"],
            "cout": None,  # aucune source ouverte ne publie le coût : « inconnu »
            "source": {**SOURCE_FORMATION, "url": l["url_onisep"]},
        }
        if l["taux_acces"]:
            f["parcoursup"] = {
                "selection": l["selection"],
                "taux_acces": int(float(l["taux_acces"])),
                "places": int(float(l["places"])) if l["places"] else None,
                "source": {**SOURCE_PARCOURSUP, "url": l["url_parcoursup"]},
            }
        sortie.append(f)
    return {"genere_le": date.today().isoformat(), "region": "Provence-Alpes-Côte d'Azur",
            "formations": sortie}


def ecrire(nom, donnees):
    chemin = INDEX / nom
    # separators compacts : fichier plus léger à charger sur téléphone
    chemin.write_text(json.dumps(donnees, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{nom} : {chemin.stat().st_size / 1e6:.1f} Mo")


if __name__ == "__main__":
    INDEX.mkdir(parents=True, exist_ok=True)
    ecrire("metiers.json", construire_metiers())
    ecrire("formations.json", construire_formations())
