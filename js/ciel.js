// Le ciel de lucioles : chaque métier du rapport est une luciole placée dans sa zone.
// Toi au centre ; zone 1 (métiers les plus rapides à atteindre) tout près, zone 5 au bord.
//
// Accessibilité : chaque luciole est un vrai <button> (Tab, Entrée, Espace, flèches),
// avec un libellé pour lecteur d'écran. Zone tactile de 48 px, jamais de chevauchement :
// les lucioles sont écartées (au moins 50 px) sans sortir de la bande de leur zone.
// Aucune donnée n'est envoyée : tout est calculé dans la page.

const NS = "http://www.w3.org/2000/svg";
const ECART = 50;          // distance minimale entre deux lucioles (px) > zone tactile de 48 px
const R_CENTRE = 0.2;      // rayon du cercle « Toi » (part du rayon total)

const bord = (k) => R_CENTRE + ((1 - R_CENTRE) * k) / 5; // bord extérieur de la zone k (0 = centre)

function svg(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

const R_ETIQUETTE = 38;

// Hauteur du ciel : plus haut que large sur téléphone, pour garder 48 px par luciole
export const hauteurCiel = (W) => Math.round(W * (W < 400 ? 1.45 : W < 500 ? 1.3 : 1.15));    // les lucioles restent à distance des noms de zones

// Où écrire « Zone k » : en haut, juste à l'intérieur de l'anneau k
export function etiquettes(W, H) {
  const cx = W / 2, cy = H / 2, ry = cy - 26;
  return [1, 2, 3, 4, 5].map((k) => ({ k, x: cx, y: cy - ry * bord(k) + 14 }));
}

// Positions des lucioles (en px) : départ régulier dans chaque bande, puis on les écarte
// des autres lucioles et des noms de zones, sans sortir de la bande
export function disposer(zones, W, H) {
  const cx = W / 2, cy = H / 2, rx = cx - 26, ry = cy - 26;
  const obstacles = etiquettes(W, H);
  const pts = [];
  zones.forEach((liste, k) => {
    liste.forEach((item, i) => {
      const a = (2 * Math.PI * i) / liste.length + k * 0.6 - Math.PI / 2;
      const rho = (bord(k) + bord(k + 1)) / 2;
      pts.push({ item, k, x: cx + rx * rho * Math.cos(a), y: cy + ry * rho * Math.sin(a) });
    });
  });
  for (let it = 0; it < 400; it++) {
    for (const p of pts) for (const q of pts) {
      if (p === q) continue;
      const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy) || 0.01;
      if (d < ECART) { const f = ((ECART - d) / 2 / d) * 0.5; p.x += dx * f; p.y += dy * f; }
    }
    for (const p of pts) for (const o of obstacles) {
      const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy) || 0.01;
      if (d < R_ETIQUETTE) { const f = ((R_ETIQUETTE - d) / d) * 0.5; p.x += (dx || 1) * f; p.y += dy * f; }
    }
    for (const p of pts) { // on ramène chaque luciole dans la bande de sa zone
      const u = (p.x - cx) / rx, v = (p.y - cy) / ry, rho = Math.hypot(u, v) || 0.001;
      const c = Math.min(bord(p.k + 1) - 0.02, Math.max(bord(p.k) + 0.02, rho));
      p.x = cx + (u / rho) * c * rx; p.y = cy + (v / rho) * c * ry;
    }
  }
  return pts;
}

// libelle(item) -> texte lu par le lecteur d'écran ; fiable(item) -> false = luciole grisée
export function dessinerCiel(conteneur, titres, { libelle, fiable, onChoisir, onSurvol }) {
  conteneur.replaceChildren();
  const zones = [1, 2, 3, 4, 5].map((z) => titres.filter((t) => t.zone === z));
  const W = conteneur.clientWidth;
  const H = hauteurCiel(W);
  conteneur.style.height = `${H}px`;
  const cx = W / 2, cy = H / 2, rx = cx - 26, ry = cy - 26;

  // Fond : 5 anneaux, le nom des zones, toi au centre
  const dessin = svg("svg", { class: "ciel-dessin", viewBox: `0 0 ${W} ${H}`, width: W, height: H, "aria-hidden": "true" });
  for (let k = 1; k <= 5; k++) {
    dessin.append(svg("ellipse", { class: "ciel-anneau", cx, cy, rx: rx * bord(k), ry: ry * bord(k) }));
  }
  for (const e of etiquettes(W, H)) {
    const t = svg("text", { class: "ciel-zone", x: e.x, y: e.y + 4, "text-anchor": "middle" });
    t.textContent = `Zone ${e.k}`;
    dessin.append(t);
  }
  const chemins = svg("g", { class: "ciel-chemins" });
  dessin.append(chemins);
  dessin.append(svg("ellipse", { class: "ciel-centre", cx, cy, rx: rx * R_CENTRE * 0.8, ry: ry * R_CENTRE * 0.8 }));
  const toi = svg("text", { class: "ciel-toi", x: cx, y: cy + 6, "text-anchor": "middle" });
  toi.textContent = "Toi";
  dessin.append(toi);
  conteneur.append(dessin);

  // Les lucioles : de vrais boutons, dans l'ordre des zones
  const pts = disposer(zones, W, H);
  const boutons = [];
  for (const p of pts) {
    const ok = fiable(p.item);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "luciole" + (ok ? "" : " incertaine");
    b.style.left = `${p.x}px`;
    b.style.top = `${p.y}px`;
    b.setAttribute("aria-label", libelle(p.item));
    b.dataset.x = p.x; b.dataset.y = p.y;
    b.append(Object.assign(document.createElement("span"), { className: "point" }));
    b.addEventListener("click", () => {
      allumer(b);
      onChoisir(p.item, b);
    });
    b.addEventListener("focus", () => onSurvol && onSurvol(p.item));
    b.addEventListener("mouseenter", () => onSurvol && onSurvol(p.item));
    b.addEventListener("keydown", (e) => { // flèches : luciole suivante / précédente
      const i = boutons.indexOf(b);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); boutons[(i + 1) % boutons.length].focus(); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); boutons[(i - 1 + boutons.length) % boutons.length].focus(); }
    });
    p.bouton = b;
    boutons.push(b);
    conteneur.append(b);
  }

  // Allume une luciole et trace un chemin lumineux jusqu'à toi
  function allumer(b) {
    for (const x of boutons) x.classList.remove("allumee");
    b.classList.add("allumee");
    chemins.replaceChildren();
    const ligne = svg("line", { class: "ciel-chemin", x1: b.dataset.x, y1: b.dataset.y, x2: cx, y2: cy });
    chemins.append(ligne);
    window.eclaireurAnim && window.eclaireurAnim.chemin(ligne);
  }

  return {
    boutons,
    // filtre(item) -> true si la luciole correspond ; les autres s'estompent mais restent accessibles
    filtrer(filtre) {
      let n = 0;
      for (const p of pts) {
        const ok = !filtre || filtre(p.item);
        p.bouton.classList.toggle("hors-filtre", !ok);
        p.bouton.setAttribute("aria-label", libelle(p.item) + (ok ? "" : " Ne correspond pas au filtre."));
        if (ok) n++;
      }
      return n;
    },
    distanceEtiquettes() {
      let m = Infinity;
      for (const p of pts) for (const o of etiquettes(W, H)) m = Math.min(m, Math.hypot(p.x - o.x, p.y - o.y));
      return m;
    },
    distanceMin() {
      let m = Infinity;
      for (const a of pts) for (const b of pts) if (a !== b) m = Math.min(m, Math.hypot(a.x - b.x, a.y - b.y));
      return m;
    },
  };
}
