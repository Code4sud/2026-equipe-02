// Chargement de l'index (data/index/) et recherche des métiers, dans le navigateur.
// La liaison suit exactement la méthode de src/link_jobs.py :
// exact -> normalisé -> similarité, puis vérification croisée ONISEP / ROME.

import { normaliser, similarite } from "./similarite.js";

export const SEUIL_SUR = 0.9;
export const SEUIL_A_VERIFIER = 0.75;
const SEUIL_ACCORD = 0.83;

let fiches = null;      // id -> fiche (ONISEP « MET.xxx » ou ROME « A1101 »)
let catalogue = null;   // [{ norm, nom, ref, id }]
let formations = null;  // chargé seulement quand on en a besoin

export async function chargerMetiers(base = ".") {
  if (fiches) return;
  const d = await (await fetch(`${base}/data/index/metiers.json`)).json();
  fiches = new Map();
  catalogue = [];
  const vus = new Set();
  for (const [ref, liste] of [["onisep", d.onisep], ["rome", d.rome]]) {
    for (const f of liste) {
      f.ref = ref;
      fiches.set(f.id, f);
      for (const nom of f.noms) {
        const cle = ref + "|" + f.id + "|" + nom;
        if (vus.has(cle)) continue;
        vus.add(cle);
        catalogue.push({ norm: normaliser(nom), nom, ref, id: f.id });
      }
    }
  }
}

export async function chargerFormations(base = ".") {
  if (!formations) formations = (await (await fetch(`${base}/data/index/formations.json`)).json()).formations;
  return formations;
}

export const fiche = (id) => fiches.get(id);

export function confiance(score) {
  if (score >= SEUIL_SUR) return "sûr";
  if (score >= SEUIL_A_VERIFIER) return "à vérifier";
  return "non relié";
}

const RANG = { "sûr": 2, "à vérifier": 1, "non relié": 0 };
export const ECART_AMBIGU = 0.02; // deux fiches différentes presque à égalité : on ne choisit pas

// Meilleure (et deuxième meilleure) fiche ONISEP et ROME pour un nom de métier
function relierBrut(titre) {
  const titreMin = titre.trim().toLowerCase();
  const titreNorm = normaliser(titre);
  const res = {}, scores = {};
  for (const ref of ["onisep", "rome"]) {
    let m = { id: null, nom: null, score: 0, methode: null };
    const parFiche = new Map(); // meilleur score de chaque fiche (pour repérer l'ambiguïté)
    for (const c of catalogue) {
      if (c.ref !== ref) continue;
      if (c.nom.trim().toLowerCase() === titreMin) { m = { id: c.id, nom: c.nom, score: 1, methode: "exact" }; parFiche.clear(); break; }
      // Même forme normalisée, mais seulement après avoir retiré une précision entre parenthèses
      // (« Conseiller (IARD) ») : ce n'est qu'une correspondance approchée
      const perdu = c.norm === titreNorm && c.nom.includes("(") && !titre.includes("(");
      const s = c.norm === titreNorm ? (perdu ? 0.85 : 1) : similarite(titreNorm, c.norm);
      if (s > (parFiche.get(c.id) || 0)) parFiche.set(c.id, s);
      if (s > m.score || (s === m.score && m.nom && c.nom.length < m.nom.length)) {
        m = { id: c.id, nom: c.nom, score: s, methode: c.norm === titreNorm && !perdu ? "normalisé" : "similarité" };
      }
    }
    m.confiance = confiance(m.score);
    res[ref] = m; scores[ref] = parFiche;
  }
  // Vérification croisée : la fiche ONISEP cite le même code ROME -> « sûr »
  const o = res.onisep, r = res.rome;
  const fo = o.id && fiches.get(o.id);
  if (o.score >= SEUIL_ACCORD && r.score >= SEUIL_ACCORD && normaliser(o.nom) !== normaliser(r.nom)
      && fo && fo.romes.some((x) => x.code === r.id)) {
    for (const x of [o, r]) if (x.confiance !== "sûr") { x.confiance = "sûr"; x.methode += " + accord ONISEP/ROME"; }
  }
  // Fiche principale : ONISEP (plus complète) sauf si le ROME est nettement plus sûr
  const refPrincipale = RANG[o.confiance] >= RANG[r.confiance] ? "onisep" : "rome";
  const principal = res[refPrincipale];
  let confiancePrincipale = principal.confiance, ambigu = false;
  // Ambiguïté : une correspondance seulement approchée, et une AUTRE fiche presque aussi proche,
  // sans lien avec elle (pas le même code ROME) -> on ne choisit pas au hasard : « je ne sais pas »
  if (confiancePrincipale === "à vérifier") {
    const codes = (id) => { const f = fiches.get(id); return f ? (f.ref === "rome" ? [f.id, f.parent] : f.romes.map((x) => x.code)) : []; };
    const miens = codes(principal.id);
    // Concurrentes : les fiches presque aussi proches du même référentiel, et le meilleur de l'autre
    const autreRef = refPrincipale === "onisep" ? "rome" : "onisep";
    const concurrentes = [...scores[refPrincipale]];
    if (res[autreRef].id) concurrentes.push([res[autreRef].id, res[autreRef].score]);
    for (const [id, sc] of concurrentes) {
      if (id === principal.id || sc < principal.score - ECART_AMBIGU) continue;
      // Une autre fiche presque aussi proche, d'une autre famille de métiers : on ne choisit pas
      if (!codes(id).some((c) => c && miens.includes(c))) { ambigu = true; confiancePrincipale = "non relié"; break; }
    }
  }
  return {
    titre,
    confiance: confiancePrincipale,
    score: principal.score,
    ambigu,
    fiche: confiancePrincipale === "non relié" ? null : fiches.get(principal.id),
    onisep: o, rome: r,
  };
}

// Relie un titre ; si le titre contient un mot coupé par une césure (« Électri-cien »),
// on essaie aussi sans le trait d'union et on garde la meilleure correspondance
export function relier(titre) {
  const brut = relierBrut(titre);
  if (brut.confiance === "sûr" || !/\p{L}-\p{L}/u.test(titre)) return brut;
  const recolle = relierBrut(titre.replace(/(\p{L})-(\p{L})/gu, "$1$2"));
  return RANG[recolle.confiance] > RANG[brut.confiance] ? { ...recolle, titre } : brut;
}

// Recherche libre (barre de recherche) : les N métiers les plus proches, sans doublon de fiche
export function rechercher(texte, n = 6) {
  const q = normaliser(texte);
  if (!q) return [];
  const meilleurs = new Map();
  for (const c of catalogue) {
    const s = c.norm === q ? 1 : similarite(q, c.norm);
    if (s < 0.6) continue;
    const bonus = c.ref === "onisep" ? 0.01 : 0; // à score égal, la fiche ONISEP est plus complète
    const prec = meilleurs.get(c.id);
    if (!prec || s + bonus > prec.s) meilleurs.set(c.id, { s: s + bonus, nom: c.nom, fiche: fiches.get(c.id) });
  }
  return [...meilleurs.values()].sort((a, b) => b.s - a.s).slice(0, n);
}

// Codes ROME d'une fiche (ONISEP : ceux qu'elle cite ; ROME : le sien)
export function codesRome(f) {
  // Pour une fiche ROME 4.0, on ajoute le code parent (ancien code v3) que l'ONISEP utilise encore
  return f.ref === "rome" ? [...new Set([f.id, f.parent].filter(Boolean))] : f.romes.map((r) => r.code);
}

// Fiche ONISEP liée à une fiche ROME (même code ROME), pour avoir niveau, salaire, formations.
// On prend la plus proche par le nom, et seulement si son nom ressemble assez (score >= 0.85) :
// un même code ROME couvre parfois des métiers de niveaux très différents.
export function ficheOnisepLiee(f) {
  if (!f || f.ref !== "rome" || !f.onisep.length) return null;
  const n = normaliser(f.nom);
  let meilleur = null;
  for (const id of f.onisep) {
    const g = fiches.get(id);
    const s = Math.max(...g.noms.map((x) => similarite(n, normaliser(x))));
    if (s >= 0.85 && (!meilleur || s > meilleur.s)) meilleur = { s, g };
  }
  return meilleur ? meilleur.g : null;
}
