"""
Mesure les contrastes de couleur du site (formule officielle WCAG 2.1), en mode clair et en mode sombre.

Lancer :  python tests/contrastes.py        (ou via pytest : tests/test_contrastes.py)

Les couleurs sont lues directement dans css/style.css : si quelqu'un change une couleur,
la mesure suit. Règle : tout texte doit avoir un contraste d'au moins 4,5:1 avec son fond.
Les éléments non textuels (anneau de focus) doivent atteindre 3:1.
"""

import re
from pathlib import Path

CSS = Path(__file__).resolve().parent.parent / "css" / "style.css"

# (couleur du texte, couleur du fond, minimum, où on le voit)
PAIRES = [
    ("texte", "fond", 4.5, "texte courant sur le fond de page"),
    ("texte", "surface", 4.5, "texte dans les cartes"),
    ("texte", "surface-2", 4.5, "texte dans les encadrés (promesse, infos)"),
    ("doux", "fond", 4.5, "texte secondaire sur le fond"),
    ("doux", "surface", 4.5, "texte secondaire dans les cartes"),
    ("doux", "surface-2", 4.5, "texte secondaire dans les encadrés, compteur des zones"),
    ("lien", "surface", 4.5, "liens et sources dans les cartes"),
    ("lien", "fond", 4.5, "liens dans les bulles de chat et le pied de page"),
    ("lien", "surface-2", 4.5, "« Une journée type »"),
    ("lien-survol", "surface", 4.5, "lien survolé"),
    ("action-texte", "action", 4.5, "bouton principal"),
    ("action-texte", "action-survol", 4.5, "bouton principal survolé"),
    ("texte", "jeune", 4.5, "bulle du jeune dans le chat"),
    ("accent-texte", "accent", 4.5, "texte sélectionné"),
    ("oui", "oui-fond", 4.5, "badge « Sans bac : oui »"),
    ("comment", "comment-fond", 4.5, "badge « bac requis »"),
    ("non", "non-fond", 4.5, "badge « Sans bac : non »"),
    ("inconnu", "inconnu-fond", 4.5, "badge « Sans bac : ? »"),
    ("focus", "fond", 3.0, "anneau de focus clavier sur le fond"),
    ("focus", "surface", 3.0, "anneau de focus clavier dans les cartes"),
]


def lire_palettes():
    """Renvoie {"clair": {nom: #hex}, "sombre": {...}} à partir des blocs :root du CSS."""
    css = CSS.read_text(encoding="utf-8")
    sombre_debut = css.index("@media (prefers-color-scheme: dark)")
    blocs = {"clair": css[:sombre_debut], "sombre": css[sombre_debut:css.index("}", css.index("color-scheme: dark"))]}
    palettes = {}
    for mode, texte in blocs.items():
        palettes[mode] = dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{6})", texte))
    # Le mode sombre hérite des valeurs du clair qu'il ne redéfinit pas
    palettes["sombre"] = {**palettes["clair"], **palettes["sombre"]}
    return palettes


def luminance(hexa):
    r, g, b = (int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in (r, g, b)]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contraste(a, b):
    la, lb = sorted([luminance(a), luminance(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


def mesurer():
    echecs = []
    for mode, pal in lire_palettes().items():
        print(f"\n== Mode {mode}")
        for texte, fond, mini, ou in PAIRES:
            c = contraste(pal[texte], pal[fond])
            ok = c >= mini
            print(f"{'OK ' if ok else 'NON'} {c:5.2f}:1 (min {mini}) {texte} {pal[texte]} sur {fond} {pal[fond]} — {ou}")
            if not ok:
                echecs.append((mode, texte, fond, round(c, 2)))
    return echecs


if __name__ == "__main__":
    e = mesurer()
    print(f"\n{len(e)} échec(s)" if e else "\nTous les contrastes sont conformes.")
