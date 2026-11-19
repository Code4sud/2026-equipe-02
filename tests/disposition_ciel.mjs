// Vérifie la disposition du ciel : node tests/disposition_ciel.mjs
// Écart entre lucioles (>= 48 px dès 328 px de large) et distance aux noms de zones.
import { disposer, etiquettes, hauteurCiel } from "../js/ciel.js";
const cas = { fictif: [5, 5, 5, 5, 5], A: [5, 5, 5, 1, 1], B: [0, 5, 5, 5, 5], C: [2, 5, 5, 5, 5], D: [3, 5, 5, 2, 4] };
for (const W of [300, 328, 358, 420, 560]) {
  const H = hauteurCiel(W);
  const res = Object.entries(cas).map(([n, c]) => {
    const pts = disposer(c.map((k) => Array.from({ length: k }, (_, i) => i)), W, H);
    let m = Infinity, e = Infinity;
    for (const a of pts) for (const b of pts) if (a !== b) m = Math.min(m, Math.hypot(a.x - b.x, a.y - b.y));
    for (const a of pts) for (const o of etiquettes(W, H)) e = Math.min(e, Math.hypot(a.x - o.x, a.y - o.y));
    return `${n} ${m.toFixed(0)}/${e.toFixed(0)}`;
  });
  console.log(`W=${W} (écart lucioles / distance aux noms) : ${res.join(" · ")}`);
}
