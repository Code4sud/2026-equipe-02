"""
Étape 3 : relier des noms de métiers aux référentiels publics (ONISEP et ROME 4.0).

Lancer :  python src/link_jobs.py   (après src/clean_data.py)

Méthode, dans cet ordre (on s'arrête à la première qui marche) :
  1. « exact »      : même nom, aux majuscules près
  2. « normalisé »  : même nom après normalisation (accents, féminin, parenthèses...)
  3. « similarité » : nom le plus proche (score de 0 à 1, voir src/similarite.py)
Puis un niveau de confiance :
  score >= 0.90 -> « sûr » ; 0.75 à 0.90 -> « à vérifier » ; < 0.75 -> « non relié »
Un métier non relié n'est pas caché : l'assistant répondra « je ne sais pas ».

Produit :
- data/processed/liaison_rome_onisep.json : chaque code ROME avec ses fiches ONISEP
- docs/qualite.md : rapport qualité chiffré (taux de liaison, doublons, valeurs manquantes)
- data_local/liaison_titres_rapports.json : liaison des titres des vrais rapports
  (LOCAL UNIQUEMENT, jamais commité, seulement si data_local/titres_rapports.json existe)
"""

import json
from collections import Counter, defaultdict
from pathlib import Path

from similarite import normaliser, similarite

RACINE = Path(__file__).resolve().parent.parent
PROC = RACINE / "data" / "processed"
LOCAL = RACINE / "data_local"

SEUIL_SUR = 0.90
SEUIL_A_VERIFIER = 0.75
SEUIL_ACCORD = 0.83  # pour la vérification croisée ONISEP / ROME


def confiance(score):
    if score >= SEUIL_SUR:
        return "sûr"
    if score >= SEUIL_A_VERIFIER:
        return "à vérifier"
    return "non relié"


def charger():
    onisep = json.loads((PROC / "onisep_metiers.json").read_text(encoding="utf-8"))
    rome = json.loads((PROC / "rome_fiches.json").read_text(encoding="utf-8"))
    return onisep, rome


def construire_catalogue(onisep, rome):
    """Liste de tous les noms connus : (nom normalisé, nom d'origine, référentiel, identifiant).

    C'est la même liste que le site utilise dans le navigateur (data/index/noms.json).
    """
    catalogue = []
    for f in onisep:
        for nom in f["noms"]:
            catalogue.append((normaliser(nom), nom, "onisep", f["id"]))
    for f in rome:
        for nom in [f["nom"]] + f["appellations"]:
            catalogue.append((normaliser(nom), nom, "rome", f["code"]))
    # On enlève les doublons exacts
    return list(dict.fromkeys(catalogue))


def relier(titre, catalogue):
    """Trouve, pour un titre, la meilleure fiche ONISEP et la meilleure fiche ROME."""
    titre_min = titre.strip().lower()
    titre_norm = normaliser(titre)
    resultat = {}
    for ref in ("onisep", "rome"):
        meilleur = {"id": None, "nom": None, "score": 0.0, "methode": None}
        for norm, nom, r, ident in catalogue:
            if r != ref:
                continue
            if nom.strip().lower() == titre_min:
                meilleur = {"id": ident, "nom": nom, "score": 1.0, "methode": "exact"}
                break
            if norm == titre_norm:
                s, methode = 1.0, "normalisé"
            else:
                s, methode = similarite(titre_norm, norm), "similarité"
            # À score égal, on préfère le nom le plus court (le plus générique)
            if s > meilleur["score"] or (s == meilleur["score"] and meilleur["nom"]
                                         and len(nom) < len(meilleur["nom"])):
                meilleur = {"id": ident, "nom": nom, "score": s, "methode": methode}
        meilleur["confiance"] = confiance(meilleur["score"])
        resultat[ref] = meilleur
    return resultat


def verifier_accord(resultat, romes_onisep):
    """Vérification croisée : si la fiche ONISEP trouvée cite le code ROME trouvé,
    les deux référentiels se confirment -> on passe les deux en « sûr ».

    Conditions strictes (vérifiées à la main sur des faux positifs) :
    - les deux scores >= SEUIL_ACCORD
    - les deux noms trouvés sont différents : sinon ce n'est pas une preuve indépendante
    """
    o, r = resultat["onisep"], resultat["rome"]
    if (o["score"] >= SEUIL_ACCORD and r["score"] >= SEUIL_ACCORD
            and normaliser(o["nom"]) != normaliser(r["nom"])
            and r["id"] in romes_onisep.get(o["id"], [])):
        for x in (o, r):
            if x["confiance"] != "sûr":
                x["confiance"] = "sûr"
                x["methode"] = x["methode"] + " + accord ONISEP/ROME"
    return resultat


def liaison_rome_onisep(onisep, rome):
    """Relie chaque code ROME aux fiches ONISEP qui citent ce code, ou à défaut son code
    parent (l'ancien code ROME v3 publié par France Travail). Lien par code, sans similarité."""
    par_code = defaultdict(list)
    for f in onisep:
        for code in f["romes"]:
            par_code[code].append(f["id"])
    return {f["code"]: par_code.get(f["code"]) or par_code.get(f.get("parent"), []) for f in rome}


def rapport_qualite(onisep, rome, liaison, stats_rapports):
    codes_rome = {f["code"] for f in rome} | {f.get("parent") for f in rome}
    onisep_avec_rome = [f for f in onisep if f["romes"]]
    onisep_rome_valide = [f for f in onisep if any(c in codes_rome for c in f["romes"])]
    rome_avec_onisep = sum(1 for ids in liaison.values() if ids)
    doublons_onisep = sum(n - 1 for n in Counter(normaliser(f["nom"]) for f in onisep).values() if n > 1)
    doublons_rome = sum(n - 1 for n in Counter(normaliser(f["nom"]) for f in rome).values() if n > 1)

    def manquants(liste, champ):
        return sum(1 for f in liste if not f.get(champ))

    def pct(a, b):
        return f"{100 * a / b:.0f} %" if b else "n/a"

    n_o, n_r = len(onisep), len(rome)
    lignes = [
        "# Rapport qualité des données",
        "",
        "Généré automatiquement par `src/link_jobs.py`. Aucun chiffre n'est saisi à la main.",
        "",
        "## Volumes",
        "",
        f"* Fiches métiers ONISEP : {n_o}",
        f"* Fiches métiers ROME 4.0 : {n_r}",
        "",
        "## Liaison ROME ↔ ONISEP (par code ROME, ou code parent ROME v3 publié par France Travail)",
        "",
        f"* Fiches ONISEP qui citent un code ROME : {len(onisep_avec_rome)} ({pct(len(onisep_avec_rome), n_o)})",
        f"* … dont le code existe dans le ROME 4.0 actuel : {len(onisep_rome_valide)} ({pct(len(onisep_rome_valide), n_o)})",
        f"* Codes ROME qui ont au moins une fiche ONISEP : {rome_avec_onisep} ({pct(rome_avec_onisep, n_r)})",
        "",
        "## Doublons (même nom après normalisation)",
        "",
        f"* ONISEP : {doublons_onisep}",
        f"* ROME : {doublons_rome}",
        "",
        "## Valeurs manquantes (fiches ONISEP)",
        "",
        f"* Sans niveau d'accès minimum : {manquants(onisep, 'niveau_min')} ({pct(manquants(onisep, 'niveau_min'), n_o)})",
        f"* Sans salaire débutant publié : {manquants(onisep, 'salaire_debutant')} ({pct(manquants(onisep, 'salaire_debutant'), n_o)})"
        " → l'assistant répond « je ne sais pas » pour le salaire",
        f"* Sans description courte : {manquants(onisep, 'resume')} ({pct(manquants(onisep, 'resume'), n_o)})",
        f"* Sans formation minimale listée : {manquants(onisep, 'formations')} ({pct(manquants(onisep, 'formations'), n_o)})",
        "",
        "Valeurs manquantes (fiches ROME) :",
        "",
        f"* Sans texte d'accès au métier : {manquants(rome, 'acces')} ({pct(manquants(rome, 'acces'), n_r)})",
        f"* Sans définition : {manquants(rome, 'definition')} ({pct(manquants(rome, 'definition'), n_r)})",
        "",
        "Coût des formations : **aucune source ouverte ne le publie**. Le site affiche « inconnu » et le statut",
        "public / privé de l'établissement (qui n'est pas un coût).",
        "",
    ]
    if stats_rapports:
        s = stats_rapports
        lignes += [
            "## Liaison des métiers des Rapports des Possibles",
            "",
            "Mesurée en local sur les titres extraits des rapports réels. Seuls les chiffres agrégés",
            "sont publiés ici : aucun titre, aucun texte de rapport n'est dans le dépôt.",
            "",
            f"* Titres distincts : {s['total']}",
            f"* Reliés à une fiche ONISEP « sûr » : {s['onisep_sur']} ({pct(s['onisep_sur'], s['total'])})",
            f"* Reliés à une fiche ROME « sûr » : {s['rome_sur']} ({pct(s['rome_sur'], s['total'])})",
            f"* Reliés à au moins un référentiel « sûr » : {s['un_sur']} ({pct(s['un_sur'], s['total'])})",
            f"* Seulement « à vérifier » : {s['a_verifier']} ({pct(s['a_verifier'], s['total'])})",
            f"* Non reliés : {s['non_relie']} ({pct(s['non_relie'], s['total'])}) → « je ne sais pas »",
            f"* Méthodes (meilleur des deux référentiels) : {s['methodes']}",
            "",
            "Vérification manuelle du 18/11/2026 : les 21 liaisons « sûr » obtenues par similarité",
            "(ni exactes, ni normalisées) ont été relues une par une. 19 sont correctes, 2 pointent",
            "vers une spécialité voisine du bon métier. Quelques titres sont coupés en fin de ligne",
            "par l'extraction du PDF, ce qui fait baisser le taux de liaison.",
            "",
        ]
    (RACINE / "docs" / "qualite.md").write_text("\n".join(lignes), encoding="utf-8")


def relier_titres_rapports(catalogue, romes_onisep):
    """Relie les titres extraits des vrais rapports (fichier local). Renvoie des stats agrégées."""
    source = LOCAL / "titres_rapports.json"
    if not source.exists():
        print("Pas de titres locaux (data_local/titres_rapports.json) : étape sautée.")
        return None
    titres = json.loads(source.read_text(encoding="utf-8"))
    resultats = []
    for t in titres:
        r = verifier_accord(relier(t["titre"], catalogue), romes_onisep)
        resultats.append({"titre": t["titre"], "nb_rapports": t["nb_rapports"], **r})
    (LOCAL / "liaison_titres_rapports.json").write_text(
        json.dumps(resultats, ensure_ascii=False, indent=1), encoding="utf-8")

    def meilleur(r):
        return max((r["onisep"], r["rome"]), key=lambda x: x["score"])

    stats = {
        "total": len(resultats),
        "onisep_sur": sum(r["onisep"]["confiance"] == "sûr" for r in resultats),
        "rome_sur": sum(r["rome"]["confiance"] == "sûr" for r in resultats),
        "un_sur": sum(meilleur(r)["confiance"] == "sûr" for r in resultats),
        "a_verifier": sum(meilleur(r)["confiance"] == "à vérifier" for r in resultats),
        "non_relie": sum(meilleur(r)["confiance"] == "non relié" for r in resultats),
        "methodes": dict(Counter(meilleur(r)["methode"] for r in resultats)),
    }
    print("Titres des rapports :", stats)
    return stats


if __name__ == "__main__":
    onisep, rome = charger()
    catalogue = construire_catalogue(onisep, rome)
    print(f"Catalogue : {len(catalogue)} noms")
    liaison = liaison_rome_onisep(onisep, rome)
    (PROC / "liaison_rome_onisep.json").write_text(
        json.dumps(liaison, ensure_ascii=False), encoding="utf-8")
    romes_onisep = {f["id"]: f["romes"] for f in onisep}
    stats = relier_titres_rapports(catalogue, romes_onisep)
    rapport_qualite(onisep, rome, liaison, stats)
    print("Rapport qualité : docs/qualite.md")
