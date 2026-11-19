// Accueil : des lucioles qui flottent derrière le texte, et un mini ciel où des métiers
// s'allument tour à tour pour montrer le produit sans rien lire.
// Tout s'arrête quand le rapport est chargé, quand l'onglet est caché, et rien ne bouge
// si la personne a demandé de réduire les animations (prefers-reduced-motion).

const calme = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const NB_LUCIOLES = 18; // 20 au maximum, pour rester léger sur téléphone

// ---------- 1. Les lucioles du fond (canvas) ----------

const canvas = document.getElementById("lucioles-fond");
const c2d = canvas.getContext("2d");
let lucioles = [];
let anime = null;
let largeur = 0, hauteur = 0;

function dimensionner() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  largeur = r.width; hauteur = r.height;
  canvas.width = Math.round(largeur * dpr);
  canvas.height = Math.round(hauteur * dpr);
  c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function creer() {
  lucioles = Array.from({ length: NB_LUCIOLES }, (_, i) => ({
    x: Math.random() * largeur, y: Math.random() * hauteur,
    vx: (Math.random() - 0.5) * 9, vy: -4 - Math.random() * 6,   // montée lente (px par seconde)
    rayon: 1.6 + Math.random() * 1.6,
    phase: Math.random() * Math.PI * 2, vitesse: 0.6 + Math.random() * 0.9, i,
  }));
}

function dessiner(t) {
  c2d.clearRect(0, 0, largeur, hauteur);
  c2d.globalCompositeOperation = "lighter";
  for (const l of lucioles) {
    const eclat = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * l.vitesse + l.phase)); // lueur qui respire
    const halo = c2d.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.rayon * 7);
    halo.addColorStop(0, `rgba(242, 196, 110, ${0.55 * eclat})`);
    halo.addColorStop(1, "rgba(242, 196, 110, 0)");
    c2d.fillStyle = halo;
    c2d.beginPath(); c2d.arc(l.x, l.y, l.rayon * 7, 0, Math.PI * 2); c2d.fill();
    c2d.fillStyle = `rgba(255, 232, 170, ${0.9 * eclat})`;
    c2d.beginPath(); c2d.arc(l.x, l.y, l.rayon, 0, Math.PI * 2); c2d.fill();
  }
  c2d.globalCompositeOperation = "source-over";
}

let avant = 0;
function boucle(maintenant) {
  const dt = Math.min(0.05, (maintenant - avant) / 1000 || 0);
  avant = maintenant;
  const t = maintenant / 1000;
  for (const l of lucioles) {
    l.x += (l.vx + Math.sin(t * 0.7 + l.phase) * 6) * dt;
    l.y += l.vy * dt;
    if (l.y < -20) { l.y = hauteur + 20; l.x = Math.random() * largeur; }
    if (l.x < -20) l.x = largeur + 20;
    if (l.x > largeur + 20) l.x = -20;
  }
  dessiner(t);
  anime = requestAnimationFrame(boucle);
}

function demarrerFond() {
  if (calme() || anime || !document.body.classList.contains("etat-accueil")) return;
  dimensionner();
  if (!lucioles.length) creer();
  avant = performance.now();
  anime = requestAnimationFrame(boucle);
}
function arreterFond() {
  if (anime) cancelAnimationFrame(anime);
  anime = null;
}

// ---------- 2. Le mini ciel (SVG) ----------

const NS = "http://www.w3.org/2000/svg";
const apercu = document.getElementById("apercu");
const svg = (tag, attrs = {}, texte) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (texte) e.textContent = texte;
  return e;
};
// Métiers du rapport FICTIF, avec ce que dit vraiment leur fiche
// La montée en miniature : Toi en bas, 5 étages de nuit au-dessus
const TOI = { x: 160, y: 296 };
const ETAGES_Y = [262, 210, 158, 106, 54]; // milieu de chaque étage, zone 1 en bas
const EXEMPLES = [
  { x: 96, y: ETAGES_Y[1], nom: "Boulanger", info: "Sans bac : oui" },
  { x: 232, y: ETAGES_Y[3], nom: "Orthophoniste", info: "5 ans après le bac" },
  { x: 236, y: ETAGES_Y[1], nom: "Fleuriste", info: "CAP en 2 ans" },
  { x: 84, y: ETAGES_Y[4], nom: "Toiletteur de chevaux", info: "Je ne sais pas", gris: true },
];
const DECOR = [[60, 262], [250, 262], [150, 210], [70, 158], [180, 158], [270, 158], [130, 106], [250, 54], [160, 54]];
const FONDS_ETAGES = ["#2f3a15", "#29331a", "#222c1d", "#1b2420", "#161d25"];
let pointsApercu = [];

function construireApercu() {
  apercu.replaceChildren();
  ETAGES_Y.forEach((y, k) => {
    apercu.append(svg("rect", { x: 0, y: y - 26, width: 320, height: 52, fill: FONDS_ETAGES[k] }),
      svg("line", { class: "ap-anneau", x1: 0, y1: y - 26, x2: 320, y2: y - 26 }));
  });
  apercu.append(svg("line", { class: "ap-chemin", x1: TOI.x, y1: TOI.y - 18, x2: TOI.x, y2: TOI.y - 18 }));
  for (const [x, y] of DECOR) apercu.append(svg("circle", { class: "ap-point", cx: x, cy: y, r: 4 }));
  pointsApercu = EXEMPLES.map((e) => {
    const g = svg("g", { class: "ap-metier" + (e.gris ? " gris" : "") });
    g.append(svg("circle", { class: "ap-halo", cx: e.x, cy: e.y, r: 14 }), svg("circle", { class: "ap-coeur", cx: e.x, cy: e.y, r: 6 }));
    const largeurEtiquette = Math.max(e.nom.length, e.info.length) * 7.2 + 20;
    const ex = Math.min(Math.max(e.x - largeurEtiquette / 2, 4), 316 - largeurEtiquette);
    const ey = e.y < 80 ? e.y + 14 : e.y - 56;
    const etiquette = svg("g", { class: "ap-etiquette" });
    etiquette.append(svg("rect", { x: ex, y: ey, width: largeurEtiquette, height: 42, rx: 10 }),
      svg("text", { x: ex + 10, y: ey + 18, class: "ap-nom" }, e.nom),
      svg("text", { x: ex + 10, y: ey + 34, class: "ap-info" }, e.info));
    g.append(etiquette);
    apercu.append(g);
    return { g, e };
  });
  apercu.append(svg("rect", { x: 0, y: 288 - 4, width: 320, height: 40, fill: "#2f3a15" }),
    svg("circle", { class: "ap-toi-cercle", cx: TOI.x, cy: TOI.y, r: 18 }),
    svg("text", { class: "ap-toi", x: TOI.x, y: TOI.y + 5, "text-anchor": "middle" }, "Toi"));
}

let minuteur = null, courant = -1;
function allumerSuivant() {
  courant = (courant + 1) % pointsApercu.length;
  pointsApercu.forEach(({ g }, i) => g.classList.toggle("allume", i === courant));
  const { e } = pointsApercu[courant];
  const ligne = apercu.querySelector(".ap-chemin");
  ligne.setAttribute("x2", e.x); ligne.setAttribute("y2", e.y);
  ligne.classList.toggle("gris", Boolean(e.gris));
  ligne.classList.remove("trace"); void ligne.getBoundingClientRect(); ligne.classList.add("trace");
}
function demarrerApercu() {
  if (!pointsApercu.length) construireApercu();
  if (minuteur) return;
  allumerSuivant();
  if (calme()) return; // animations réduites : une seule luciole allumée, immobile
  minuteur = setInterval(allumerSuivant, 2200);
}
function arreterApercu() { clearInterval(minuteur); minuteur = null; }

// ---------- 3. Cycle de vie ----------

function arreter() { arreterFond(); arreterApercu(); }
function reprendre() { demarrerFond(); demarrerApercu(); }

window.lucioleAccueil = { arreter, reprendre };
document.addEventListener("visibilitychange", () => (document.hidden ? arreter() : document.body.classList.contains("etat-accueil") && reprendre()));
window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => { arreter(); c2d.clearRect(0, 0, largeur, hauteur); if (document.body.classList.contains("etat-accueil")) reprendre(); });
new ResizeObserver(() => { if (anime) { dimensionner(); creer(); } }).observe(canvas);
reprendre();
