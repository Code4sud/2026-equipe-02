"""
Normalisation et similarité des noms de métiers.

Pourquoi un module à nous plutôt qu'une bibliothèque ?
La même formule existe en JavaScript (js/similarite.js) pour le site.
Le score mesuré ici en Python est donc exactement celui que verra le jeune
dans le navigateur. Un test (tests/test_similarite.py) vérifie les deux.

Le score va de 0 (rien à voir) à 1 (identique).
"""

import re
import unicodedata

# Petits mots qui n'aident pas à reconnaître un métier
MOTS_VIDES = {
    "de", "du", "des", "d", "la", "le", "les", "l", "en", "et", "a", "au", "aux",
    "un", "une", "pour", "par", "sur", "dans", "ou",
}


def normaliser(nom):
    """« Serveur / Serveuse (café-bar) » -> « serveur »

    1. minuscules et sans accents
    2. on enlève ce qui est entre parenthèses
    3. on garde la forme avant « / » (forme masculine du ROME et d'ONISEP),
       et on enlève les terminaisons du type « serveur/euse »
    4. on garde seulement lettres et chiffres, puis on enlève les petits mots
    """
    if not nom:
        return ""
    texte = unicodedata.normalize("NFD", nom.lower())
    texte = "".join(c for c in texte if unicodedata.category(c) != "Mn")  # enlève les accents
    texte = texte.replace("œ", "oe").replace("æ", "ae")
    sans_parentheses = re.sub(r"\([^)]*\)?", " ", texte)
    # Cas d'un sigle : « ASH (Agent de service hospitalier) » -> on garde le texte entre parenthèses
    if len(re.sub(r"[^a-z]", "", sans_parentheses)) <= 5 and "(" in texte:
        texte = texte.split("(", 1)[1].rstrip(")")
    else:
        texte = sans_parentheses                          # contenu entre parenthèses enlevé
    texte = re.sub(r"(\w)/\w{1,5}\b", r"\1", texte)       # serveur/euse -> serveur
    if " / " in texte:
        avant, apres = texte.split(" / ", 1)
        if avant.split() and apres.split() and avant.split()[0][:3] == apres.split()[0][:3]:
            # Masculin / féminin : « Agent / Agente de silo » -> « agent » + « de silo »
            n = len(avant.split())
            texte = " ".join(avant.split() + apres.split()[n:])
        else:
            # « Chanteur / musicien » : le « / » veut dire « ou », on garde les deux
            texte = avant + " " + apres
    texte = re.sub(r"[^a-z0-9]+", " ", texte)
    mots = [m for m in texte.split() if m not in MOTS_VIDES]
    return " ".join(mots)


def bigrammes(texte):
    """Découpe un texte en paires de lettres : « chef » -> {"ch", "he", "ef"}."""
    texte = texte.replace(" ", "")
    return {texte[i:i + 2] for i in range(len(texte) - 1)}


def similarite(a, b):
    """Score entre deux noms DÉJÀ normalisés.

    - coefficient de Dice sur les paires de lettres (tolère les fautes et les pluriels)
    - si tous les mots du nom le plus court se retrouvent dans l'autre,
      score entre 0.6 et 0.95 selon la part de mots en commun
      (« serveur » dans « serveur restauration » -> 0.775, « à vérifier »)
    """
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    ba, bb = bigrammes(a), bigrammes(b)
    dice = 2 * len(ba & bb) / (len(ba) + len(bb)) if ba and bb else 0.0
    petit, grand = sorted([set(a.split()), set(b.split())], key=len)
    if not (petit & grand):
        # Aucun mot entier en commun (« charcutier » / « chaudronnier ») : jamais plus de 0.7
        dice = min(dice, 0.7)
    inclus = 0.6 + 0.35 * len(petit) / len(grand) if petit <= grand else 0.0
    return round(max(dice, inclus), 3)
