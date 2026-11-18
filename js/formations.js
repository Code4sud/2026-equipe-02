// Formations proches de chez soi (Région Sud uniquement), sans service externe :
// on retrouve la position de la ville ou du code postal tapé dans les données de formation elles-mêmes.
// Ce que le jeune tape n'est envoyé nulle part.

import { normaliser } from "./similarite.js";
import { codesRome } from "./donnees.js";

const DEPTS_REGION_SUD = ["04", "05", "06", "13", "83", "84"];

// Distance « à vol d'oiseau » en km entre deux points GPS (formule de haversine)
export function distanceKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Position moyenne des formations situées dans la ville ou le code postal demandé
export function localiser(lieu, formations) {
  const texte = (lieu || "").trim();
  const cp = (texte.match(/\b\d{5}\b/) || [])[0];
  const ville = normaliser(texte.replace(/\b\d{5}\b/, ""));
  let points = formations.filter((f) => f.lat && (cp ? f.cp === cp : normaliser(f.ville) === ville));
  if (!points.length && ville) points = formations.filter((f) => f.lat && normaliser(f.ville).startsWith(ville));
  if (!points.length && cp && DEPTS_REGION_SUD.includes(cp.slice(0, 2))) {
    points = formations.filter((f) => f.lat && f.cp && f.cp.startsWith(cp.slice(0, 2)));
  }
  if (!points.length) return null;
  const lat = points.reduce((s, f) => s + f.lat, 0) / points.length;
  const lon = points.reduce((s, f) => s + f.lon, 0) / points.length;
  return { lat, lon, nom: cp ? `${cp}` : points[0].ville };
}

// Formations qui mènent au métier : même code ROME, ou formation citée par la fiche ONISEP
export function formationsDuMetier(f, formations) {
  const codes = new Set(codesRome(f));
  const ids = new Set((f.formations || []).map((x) => x.id));
  return formations.filter((x) => ids.has(x.id) || x.romes.some((c) => codes.has(c)));
}

export function formationsProches(f, formations, lieu, n = 5) {
  const centre = localiser(lieu, formations);
  if (!centre) return { centre: null, liste: [] };
  const liste = formationsDuMetier(f, formations)
    .filter((x) => x.lat)
    .map((x) => ({ ...x, km: Math.round(distanceKm(centre, x)) }))
    .sort((a, b) => a.km - b.km);
  // Une même formation peut avoir plusieurs sessions au même endroit : on garde une ligne
  const vus = new Set();
  const uniques = liste.filter((x) => {
    const cle = x.id + "|" + x.etablissement;
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
  return { centre, liste: uniques.slice(0, n), total: uniques.length };
}

// Résumé de la sélection Parcoursup pour un métier, en Région Sud (min et max du taux d'accès)
export function selectionParcoursup(f, formations) {
  const avec = formationsDuMetier(f, formations).filter((x) => x.parcoursup);
  if (!avec.length) return null;
  const taux = avec.map((x) => x.parcoursup.taux_acces);
  return { min: Math.min(...taux), max: Math.max(...taux), nb: avec.length, exemple: avec[0] };
}
