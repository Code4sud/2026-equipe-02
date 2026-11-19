// Lecture du Rapport des Possibles DANS le navigateur.
// Le fichier PDF ne quitte jamais le téléphone : pdf.js le lit localement,
// on ne garde que les titres de métiers et leur zone : ni prénom, ni nom, ni numéro de
// rendez-vous, ni date, ni description.
// Rien n'est envoyé, rien n'est stocké. On ne lit PAS les pages de profil
// (intérêts, aptitudes, personnalité) : l'assistant ne les interprète jamais.

// Hauteurs de texte observées dans la mise en page des rapports (en points)
const HAUTEUR_TITRE_ZONE = 18;      // « 1ère ZONE DE MÉTIERS » : environ 22
const HAUTEUR_TITRE_MIN = 13.5;     // titre de métier : environ 15
const HAUTEUR_TITRE_MAX = 18.5;
const RE_ZONE = /ZONE\s+DE\s+M[ÉE]TIERS/i;
const RE_PAGE = /^\s*\d+\s*\/\s*\d+\s*$/;

// pages : liste de pages ; chaque page est une liste d'éléments { str, x, y, h }
// (c'est ce que renvoie pdf.js, simplifié par lirePDF ci-dessous)
export function analyserPages(pages) {

  const zones = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  let zone = null;
  let fini = false;

  for (const items of pages) {
    if (fini) break;
    // 1. Regrouper les morceaux de texte en lignes (même hauteur sur la page)
    const lignes = [];
    for (const it of items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)) {
      const l = lignes.find((l) => Math.abs(l.y - it.y) < 2.5 && Math.abs(l.h - it.h) < 2);
      if (l) l.items.push(it);
      else lignes.push({ y: it.y, h: it.h, items: [it] });
    }
    for (const l of lignes) {
      l.items.sort((a, b) => a.x - b.x);
      l.x = l.items[0].x;
      l.texte = l.items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
    }

    // 2. Repérer un titre de zone : « ZONE DE MÉTIERS » en gros, avec son chiffre à côté
    for (const l of lignes) {
      if (l.h >= HAUTEUR_TITRE_ZONE && RE_ZONE.test(l.texte)) {
        const chiffre = l.texte.match(/([1-5])/) ||
          lignes.map((x) => x.texte.match(/^([1-5])$/)).find((m) => m);
        if (chiffre) zone = Number(chiffre[1]);
      } else if (zone && l.h >= HAUTEUR_TITRE_ZONE && !/^[1-5]$/.test(l.texte)) {
        fini = true; // une autre grande section commence : fin des zones
      }
    }
    if (!zone) continue;

    // 3. Titres de métiers (texte moyen, en retrait) et descriptions (petit texte)
    let dernier = null;
    let precedente = null;
    for (const l of lignes) {
      if (RE_PAGE.test(l.texte) || l.h >= HAUTEUR_TITRE_ZONE) continue;
      const estTitre = l.h >= HAUTEUR_TITRE_MIN && l.h <= HAUTEUR_TITRE_MAX;
      if (estTitre) {
        // Un titre trop long continue parfois sur la ligne suivante : on recolle
        // (césure en fin de ligne « Électri- » + « cien » : on recolle sans espace)
        if (precedente && precedente.estTitre && precedente.y - l.y < 1.8 * l.h && dernier) {
          dernier.titre += (dernier.titre.endsWith("-") ? "" : " ") + l.texte;
        } else {
          dernier = { titre: l.texte };
          zones[zone].push(dernier);
        }
      }
      precedente = { ...l, estTitre };
    }
  }
  const total = Object.values(zones).reduce((n, z) => n + z.length, 0);
  return { zones, total };
}

// Lit un fichier PDF (objet File du navigateur, ou tableau d'octets) avec pdf.js
export async function lirePDF(donnees, pdfjs) {
  const doc = await pdfjs.getDocument({ data: donnees, verbosity: 0 }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const contenu = await (await doc.getPage(p)).getTextContent();
    pages.push(contenu.items.map((it) => ({
      str: it.str, x: it.transform[4], y: it.transform[5], h: it.height,
    })));
  }
  return analyserPages(pages);
}
