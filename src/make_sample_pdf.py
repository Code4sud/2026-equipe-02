"""
Fabrique un FAUX Rapport des Possibles en PDF (data/sample/rapport_fictif.pdf),
à partir de data/sample/rapport_fictif.json (contenu inventé par l'équipe).

But : tester le lecteur de rapport du site et faire les captures et la vidéo
sans jamais montrer un vrai rapport. La mise en page imite seulement la
structure générale : titre avec le numéro de rendez-vous, puis une page par zone,
avec des titres de métiers en gros et des descriptions en petit.

Lancer :  python src/make_sample_pdf.py
Bibliothèque : reportlab (pip install reportlab)
"""

import json
import textwrap
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

RACINE = Path(__file__).resolve().parent.parent
SOURCE = RACINE / "data" / "sample" / "rapport_fictif.json"
SORTIE = RACINE / "data" / "sample" / "rapport_fictif.pdf"

ZONES = {
    "1": ("Métiers accessibles en 0 à 6 mois", "Une courte formation suffit. Certains métiers demandent le bac."),
    "2": ("Métiers accessibles en 3 mois à 2 ans", "Apprentissage du métier, souvent avec un CAP ou un BEP."),
    "3": ("Métiers accessibles en 1 à 3 ans après le bac", "Souvent avec un BTS, un BUT ou une licence professionnelle."),
    "4": ("Métiers accessibles avec un master", "Ou une licence suivie d'un concours."),
    "5": ("Métiers accessibles après le master", "Doctorat ou spécialisation après le master."),
}
TOTAL_PAGES = 10
LARGEUR, HAUTEUR = A4


def pied_de_page(c, numero):
    c.setFont("Helvetica", 10)
    c.drawCentredString(LARGEUR / 2, 35, f"{numero}/{TOTAL_PAGES}")
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(71, 20, "DOCUMENT FICTIF — démonstration, aucune donnée réelle")


def main():
    r = json.loads(SOURCE.read_text(encoding="utf-8"))
    c = canvas.Canvas(str(SORTIE), pagesize=A4)
    c.setTitle(f"Ton rapport des possibles – Rdv {r['rdv']} (FICTIF)")

    # Page 1 : couverture
    c.setFont("Helvetica-Bold", 14)
    c.drawString(71, 760, f"Ton rapport des possibles – Rdv {r['rdv']}")
    c.setFont("Helvetica", 11)
    c.drawString(78, 722, "Rapport du")
    c.drawString(80, 706, r["date"])
    c.setFont("Helvetica-Bold", 24)
    c.drawString(71, 560, "Explore")
    c.drawString(71, 525, "ton avenir professionnel")
    c.setFont("Helvetica", 11)
    c.drawString(71, 450, f"Rapport fictif de {r['prenom']}, créé pour la démonstration.")
    pied_de_page(c, 1)
    c.showPage()

    # Pages 2 à 4 : sections de profil, volontairement vides (on ne les lit pas)
    for n, titre in [(2, "Tes intérêts professionnels"), (3, "Tes jeux d'aptitudes"), (4, "Ta personnalité")]:
        c.setFont("Helvetica-Bold", 22)
        c.drawString(71, 746, titre.upper())
        c.setFont("Helvetica", 11)
        c.drawString(71, 700, "Section fictive. L'assistant ne lit pas et n'interprète jamais cette partie.")
        pied_de_page(c, n)
        c.showPage()

    # Page 5 : introduction des zones
    c.setFont("Helvetica-Bold", 22)
    c.drawString(71, 746, "Ton champ des possibles par zone de métiers")
    c.setFont("Helvetica", 11)
    c.drawString(71, 700, "Jusqu'à 5 propositions par zone de métiers. Certaines zones peuvent apparaître vides.")
    pied_de_page(c, 5)
    c.showPage()

    # Pages 6 à 10 : une page par zone
    for i, (zone, metiers) in enumerate(r["zones"].items()):
        y = 746
        c.setFont("Helvetica-Bold", 22)
        c.drawString(71, y, zone)
        c.setFont("Helvetica-Bold", 13)
        c.drawString(84, y + 7, "ère" if zone == "1" else "ème")
        c.setFont("Helvetica-Bold", 22)
        c.drawString(110, y, "ZONE DE MÉTIERS")
        c.setFont("Helvetica", 11)
        y -= 30
        for ligne in ZONES[zone]:
            c.drawString(71, y, ligne)
            y -= 13
        y -= 30
        for m in metiers:
            c.setFont("Helvetica-Bold", 15)
            c.drawString(107, y, m["titre"])
            y -= 19
            c.setFont("Helvetica", 11)
            for ligne in textwrap.wrap(m["description"], 88):
                c.drawString(79, y, ligne)
                y -= 13
            y -= 28
        pied_de_page(c, 6 + i)
        c.showPage()
    c.save()
    print("PDF fictif :", SORTIE)


if __name__ == "__main__":
    main()
