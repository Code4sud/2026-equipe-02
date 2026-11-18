"""
Étape 2 : nettoyer les fichiers bruts (data/raw/) et produire des fichiers simples
dans data/processed/.

Lancer :  python src/clean_data.py   (après src/download_data.py)

Produit :
- onisep_metiers.json  : 1 fiche par métier ONISEP (description, accès, salaire débutant si publié)
- rome_fiches.json     : 1 fiche par code ROME 4.0 (définition, accès, appellations)
- formations_paca.json : 1 ligne par lieu de formation en Région Sud (ONISEP),
                         complétée par le taux d'accès Parcoursup quand on le retrouve

Règle : on ne complète JAMAIS une valeur manquante par une supposition.
Si la source ne dit rien, la valeur est None (affichée « inconnu » sur le site).
"""

import html
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import pandas as pd  # pour lire les CSV facilement

from similarite import normaliser, similarite

RACINE = Path(__file__).resolve().parent.parent
RAW = RACINE / "data" / "raw"
OUT = RACINE / "data" / "processed"

URL_ONISEP_METIER = "https://www.onisep.fr/http/redirection/metier/slug/{}"
URL_ONISEP_FORMATION = "https://www.onisep.fr/http/redirection/formation/slug/{}"
URL_ROME = "https://candidat.francetravail.fr/metierscope/fiche-metier/{}"


def texte_brut(fragment_html, limite=None):
    """Enlève les balises HTML d'un texte ONISEP et coupe proprement s'il est trop long."""
    if not fragment_html:
        return ""
    texte = html.unescape(fragment_html)
    texte = re.sub(r"<h\d>(.*?)</h\d>", r"\n\1 : ", texte)  # les intertitres deviennent « Titre : »
    texte = re.sub(r"<[^>]+>", " ", texte)
    texte = re.sub(r"[ \t]+", " ", texte)
    texte = re.sub(r"\s*\n\s*", "\n", texte).strip()
    if limite and len(texte) > limite:
        coupe = texte[:limite].rsplit(". ", 1)[0]
        texte = coupe + "."
    return texte


def salaire_debutant(vie_pro_html):
    """Extrait la phrase « Salaire du débutant » d'une fiche ONISEP, ou None si absente."""
    if not vie_pro_html:
        return None
    texte = html.unescape(vie_pro_html)
    m = re.search(r"<h5>\s*Salaire du d[ée]butant\s*</h5>\s*<p>(.*?)</p>", texte, re.S | re.I)
    if not m:
        return None
    return re.sub(r"<[^>]+>", "", m.group(1)).strip() or None


# ---------- ONISEP : fiches métiers ----------

def catalogue_formations():
    """FOR.xxx -> durée et niveau de sortie, d'après Idéo-Formations initiales en France."""
    f = pd.read_csv(RAW / "onisep_formations.csv", sep=";", dtype=str)
    f["id"] = f["URL et ID Onisep"].str.extract(r"(FOR\.\d+)")
    f = f.dropna(subset=["id"]).drop_duplicates("id").set_index("id")
    return {i: {"duree": r["durée"] if pd.notna(r["durée"]) else None,
                "niveau_sortie": r["niveau de sortie indicatif"]
                if pd.notna(r["niveau de sortie indicatif"]) else None}
            for i, r in f.iterrows()}


def nettoyer_onisep():
    catalogue = catalogue_formations()
    racine = ET.parse(RAW / "onisep_fiches_metiers" / "Ideo-Fiches metiers.xml").getroot()
    fiches = []
    for m in racine:
        ident = m.findtext("identifiant")
        noms = [m.findtext("nom_metier"), m.findtext("libelle_masculin"), m.findtext("libelle_feminin")]
        for s in m.findall("synonymes/synonyme"):
            noms += [s.findtext("nom_metier"), s.findtext("libelle_masculin"), s.findtext("libelle_feminin")]
        noms = list(dict.fromkeys(n.strip() for n in noms if n and n.strip()))  # sans doublons
        fiches.append({
            "id": ident,
            "nom": m.findtext("nom_metier"),
            "noms": noms,
            "romes": [r.text for r in m.findall("romesV3/romeV3") if r.text],
            "resume": texte_brut(m.findtext("accroche_metier"), 400),
            "journee": texte_brut(m.findtext("nature_travail"), 700),
            "acces": texte_brut(m.findtext("acces_metier"), 700),
            "niveau_min": m.findtext("niveau_acces_min/libelle"),
            "formations": [
                {"id": f.findtext("id"), "libelle": f.findtext("libelle"),
                 **catalogue.get(f.findtext("id"), {"duree": None, "niveau_sortie": None}),
                 "url": URL_ONISEP_FORMATION.format(f.findtext("id"))}
                for f in m.findall("formations_min_requise/formation_min_requise")
            ],
            "salaire_debutant": salaire_debutant(m.findtext("vie_professionnelle")),
            "url": URL_ONISEP_METIER.format(ident),
        })
    return fiches


# ---------- ROME 4.0 : fiches métiers France Travail ----------

def nettoyer_rome():
    dossier = RAW / "rome_csv"
    codes = pd.read_csv(next(dossier.glob("unix_referentiel_code_rome_v*_utf8.csv")), dtype=str)
    textes = pd.read_csv(next(dossier.glob("unix_texte_v*_utf8.csv")), dtype=str)
    appel = pd.read_csv(next(dossier.glob("unix_referentiel_appellation_v*_utf8.csv")), dtype=str)

    textes["libelle_texte"] = textes["libelle_texte"].str.replace("''", "'", regex=False)
    textes["position_phrase"] = pd.to_numeric(textes["position_phrase"])
    textes = textes.sort_values(["code_rome", "position_phrase"])

    fiches = []
    for _, ligne in codes.iterrows():
        code = ligne["code_rome"]
        t = textes[textes["code_rome"] == code]
        definition = " ".join(t[t["libelle_type_texte"] == "definition"]["libelle_texte"])
        acces = " ".join(t[t["libelle_type_texte"] == "acces_metier"]["libelle_texte"])
        apps = appel[appel["code_rome"] == code]["libelle_appellation_court"].dropna().tolist()
        fiches.append({
            "code": code,
            "nom": ligne["libelle_rome"].replace("''", "'"),
            "appellations": sorted(set(apps)),
            "definition": definition[:900],
            "acces": acces[:700],
            "url": URL_ROME.format(code),
        })
    return fiches


# ---------- Formations en Région Sud (ONISEP) + Parcoursup ----------

NS = {"l": "http://lheo.gouv.fr/2.3"}


def extra(element, info):
    """Lit un champ <extra info="..."> du format Lhéo."""
    for e in element.iter("{http://lheo.gouv.fr/2.3}extra"):
        if e.get("info") == info:
            return (e.text or "").strip()
    return None


def nettoyer_formations_paca():
    racine = ET.parse(RAW / "onisep_actions_paca" / "lheo_action_PACA.xml").getroot()

    # Parcoursup : on garde la Région Sud et on range les lignes par code UAI d'établissement
    psup = pd.read_csv(RAW / "parcoursup_2025.csv", sep=";", dtype=str, low_memory=False)
    psup = psup[psup["region_etab_aff"].str.contains("Provence", na=False)]
    par_uai = {uai: grp for uai, grp in psup.groupby("cod_uai")}

    lignes = []
    for f in racine.iter("{http://lheo.gouv.fr/2.3}formation"):
        intitule = f.findtext("l:intitule-formation", namespaces=NS)
        romes = [r.text for r in f.findall("l:domaine-formation/l:code-ROME", NS)]
        for a in f.findall("l:action", NS):
            lieu = a.find("l:lieu-de-formation", NS)
            adr = lieu.find("l:coordonnees/l:adresse", NS) if lieu is not None else None
            if adr is None:
                continue
            uai = lieu.findtext("l:code-UAI-lieu-formation/l:code-UAI", namespaces=NS)
            for_id = extra(a, "FOR_ID ONISEP") or f.get("numero", "").split("_")[0]
            ligne = {
                "formation_id": for_id,
                "intitule": intitule,
                "type": extra(a, "TYPE_FORMATION_LIBELLE") or extra(f, "TYPE_FORMATION_LIBELLE"),
                "niveau": extra(a, "NIVEAU_LIBELLE") or extra(f, "NIVEAU_LIBELLE"),
                "romes": romes,
                "etablissement": adr.findtext("l:denomination", namespaces=NS),
                "statut": extra(lieu, "STATUT"),          # public / privé : ce n'est PAS un coût
                "ville": adr.findtext("l:ville", namespaces=NS),
                "code_postal": adr.findtext("l:codepostal", namespaces=NS),
                "lat": adr.findtext("l:geolocalisation/l:latitude", namespaces=NS),
                "lon": adr.findtext("l:geolocalisation/l:longitude", namespaces=NS),
                "duree_ans": a.findtext("l:duree-cycle", namespaces=NS),
                "alternance": (a.findtext("l:modalites-alternance", namespaces=NS) or "-") != "-",
                "url_onisep": URL_ONISEP_FORMATION.format(for_id),
                "uai": uai,
                # Remplis seulement si on retrouve la formation dans Parcoursup :
                "selection": None, "taux_acces": None, "places": None, "url_parcoursup": None,
            }
            # Rapprochement Parcoursup : même établissement (code UAI) + nom de formation proche.
            # Parcoursup ne gère que l'ENTRÉE dans le supérieur : on exclut masters,
            # 2e années, licences pro (elles se font après un bac + 2).
            hors_parcoursup = re.search(r"master|mast[eè]re|2e ann[ée]e|licence professionnelle",
                                        intitule or "", re.I)
            post_bac = (ligne["niveau"] or "").startswith("bac +")  # CAP, bac pro... ne passent pas par Parcoursup
            if uai in par_uai and post_bac and not hors_parcoursup:
                n_intitule = normaliser(intitule)
                meilleur, score = None, 0.0
                for _, p in par_uai[uai].iterrows():
                    # Une « Licence » Parcoursup ne peut correspondre qu'à une licence
                    if p["lib_for_voe_ins"].startswith("Licence") and "licence" not in n_intitule:
                        continue
                    s = max(similarite(n_intitule, normaliser(p["fil_lib_voe_acc"])),
                            similarite(n_intitule, normaliser(p["lib_for_voe_ins"])))
                    if s > score:
                        meilleur, score = p, s
                if meilleur is not None and score >= 0.6:
                    ligne["selection"] = meilleur["select_form"]
                    ligne["taux_acces"] = meilleur["taux_acces_ens"]
                    ligne["places"] = meilleur["capa_fin"]
                    ligne["url_parcoursup"] = meilleur["lien_form_psup"]
            lignes.append(ligne)
    return lignes


def ecrire(nom, donnees):
    chemin = OUT / nom
    chemin.write_text(json.dumps(donnees, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{nom} : {len(donnees)} lignes")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    ecrire("onisep_metiers.json", nettoyer_onisep())
    ecrire("rome_fiches.json", nettoyer_rome())
    ecrire("formations_paca.json", nettoyer_formations_paca())
