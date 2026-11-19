// « La montée » : les métiers du rapport comme des lucioles, sur 5 étages de ciel.
// Toi tout en bas ; zone 1 (métiers les plus rapides à atteindre) juste au-dessus,
// zone 5 tout en haut. On fait défiler la page vers le haut pour « monter ».
//
// Accessibilité : chaque luciole est un vrai <button> avec son nom visible et un libellé
// complet pour le lecteur d'écran. Ordre du clavier = ordre de la montée (zone 1 d'abord).
// Les lucioles sont posées en flux (flex) : elles ne peuvent pas se chevaucher.
// Aucune donnée n'est envoyée : tout est calculé dans la page.

const NS = "http://www.w3.org/2000/svg";

// Titres des étages, en mots simples (d'après le guide du Centre des Possibles)
export const ETAGES = {
  1: ["Tout de suite après le lycée", "de quelques jours à 6 mois, bac pas obligatoire"],
  2: ["En 1 à 2 ans", "souvent avec un CAP"],
  3: ["En 2 à 3 ans après le bac", "BTS, BUT ou licence pro"],
  4: ["En 5 ans après le bac", "master, ou licence et concours"],
  5: ["Après de longues études", "doctorat ou spécialisation"],
};

function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v; else e.setAttribute(k, v);
  }
  e.append(...enfants);
  return e;
}

// libelle(item) -> texte lu par le lecteur d'écran ; fiable(item) -> false = luciole grise
export function dessinerCiel(conteneur, titres, { libelle, fiable, onChoisir, onSurvol }) {
  conteneur.replaceChildren();
  conteneur.classList.add("montee");

  // Calque du chemin lumineux (au-dessus des étages, ne capte pas les clics)
  const calque = document.createElementNS(NS, "svg");
  calque.setAttribute("class", "montee-calque");
  calque.setAttribute("aria-hidden", "true");
  const chemin = document.createElementNS(NS, "path");
  chemin.setAttribute("class", "ciel-chemin");
  chemin.style.display = "none";
  calque.append(chemin);

  // Toi (en bas) puis les étages : l'ordre du DOM suit la montée, le CSS l'affiche de bas en haut
  const toi = el("div", { class: "montee-toi" }, el("span", { class: "toi-cercle", "aria-hidden": "true" }, "Toi"),
    el("span", { class: "toi-texte" }, "Toi, aujourd'hui. Monte pour voir tes métiers."));
  const pile = el("div", { class: "montee-pile" }, toi);
  const boutons = [];
  const items = [];
  for (const z of [1, 2, 3, 4, 5]) {
    const liste = titres.filter((t) => t.zone === z);
    const titreId = `etage-${z}`;
    const etage = el("section", { class: `etage etage-${z}`, "aria-labelledby": titreId },
      el("h3", { id: titreId, class: "etage-titre" }, ETAGES[z][0]),
      el("p", { class: "etage-sous" }, ETAGES[z][1]));
    const ul = el("ul", { class: "etage-lucioles" });
    if (!liste.length) ul.append(el("li", { class: "etage-vide" }, "Aucun métier à cet étage."));
    liste.forEach((t, i) => {
      const ok = fiable(t);
      const b = el("button", { type: "button", class: "luciole" + (ok ? "" : " incertaine"), "aria-label": libelle(t) },
        el("span", { class: "point", "aria-hidden": "true" }),
        el("span", { class: "luciole-nom", "aria-hidden": "true" }, t.titre),
        ok ? "" : el("span", { class: "luciole-jnsp", "aria-hidden": "true" }, "je ne sais pas"));
      b.style.setProperty("--decalage", `${((i * 37) % 5) * 3 - 6}px`); // léger désordre, sans chevauchement
      b.style.setProperty("--retard", `${(i * 0.7 + z * 0.4) % 3}s`);    // les lueurs ne respirent pas ensemble
      b.addEventListener("click", () => { allumer(b); onChoisir(t, b); });
      b.addEventListener("focus", () => onSurvol && onSurvol(t));
      b.addEventListener("mouseenter", () => onSurvol && onSurvol(t));
      b.addEventListener("keydown", (e) => { // flèches : luciole suivante / précédente
        const k = boutons.indexOf(b);
        if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); boutons[(k + 1) % boutons.length].focus(); }
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); boutons[(k - 1 + boutons.length) % boutons.length].focus(); }
      });
      boutons.push(b);
      items.push({ t, b });
      ul.append(el("li", {}, b));
    });
    etage.append(ul);
    pile.append(etage);
  }
  conteneur.append(pile, calque);

  // Chemin lumineux : de la luciole jusqu'à Toi, en courbe douce
  function allumer(b) {
    for (const x of boutons) x.classList.remove("allumee");
    b.classList.add("allumee");
    const base = conteneur.getBoundingClientRect();
    calque.setAttribute("width", base.width);
    calque.setAttribute("height", base.height);
    calque.setAttribute("viewBox", `0 0 ${base.width} ${base.height}`);
    const p = b.querySelector(".point").getBoundingClientRect();
    const c = toi.querySelector(".toi-cercle").getBoundingClientRect();
    const x1 = p.left + p.width / 2 - base.left, y1 = p.top + p.height / 2 - base.top;
    const x2 = c.left + c.width / 2 - base.left, y2 = c.top - base.top;
    const my = (y1 + y2) / 2;
    chemin.setAttribute("d", `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`);
    chemin.style.display = "";
    window.eclaireurAnim && window.eclaireurAnim.chemin(chemin);
  }

  return {
    boutons,
    toi,
    // filtre(item) -> true si la luciole correspond ; les autres s'éteignent mais restent accessibles
    filtrer(filtre) {
      let n = 0;
      for (const { t, b } of items) {
        const ok = !filtre || filtre(t);
        b.classList.toggle("hors-filtre", !ok);
        b.setAttribute("aria-label", libelle(t) + (ok ? "" : " Ne correspond pas au filtre."));
        if (ok) n++;
      }
      return n;
    },
  };
}
