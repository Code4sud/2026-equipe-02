// Interface : relie le lecteur de rapport, la recherche, la fiche, le chat et le récap.
// Aucune donnée n'est stockée : tout vit dans la mémoire de la page et disparaît quand on la ferme.

import { chargerMetiers, relier, rechercher, chargerFormations, ficheOnisepLiee } from "./donnees.js";
import { lirePDF } from "./rapport.js";
import {
  repondre, chargerPrompt, detecterOllama, activerWebLLM, modele, CONSEILLER,
} from "./assistant.js";

// pdf.js 4.0.379 copié dans le dépôt (licence Apache 2.0) : la lecture du rapport marche sans internet
const PDFJS = new URL("../vendor/pdfjs/pdf.min.mjs", import.meta.url).href;
const PDFJS_WORKER = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
const anim = (nom, ...args) => window.eclaireurAnim && window.eclaireurAnim[nom](...args);

// Icône étoile dessinée (SVG), pour « Garder »
function etoile() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z");
  svg.append(p);
  return svg;
}

// Les 5 zones, d'après le guide du Centre des Possibles
const ZONES = {
  1: ["Zone 1", "0 à 6 mois, bac optionnel"],
  2: ["Zone 2", "3 mois à 2 ans, CAP ou BEP"],
  3: ["Zone 3", "1 à 3 ans après le bac (BTS, licence pro)"],
  4: ["Zone 4", "master, ou licence + concours"],
  5: ["Zone 5", "doctorat ou spécialisation après le master"],
};
const BADGE = {
  oui: ["oui", "Sans bac : oui"],
  comment: ["comment", "Sans bac : non, bac requis"],
  non: ["non", "Sans bac : non"],
  inconnu: ["inconnu", "Sans bac : ?"],
};

const ctx = { base: ".", titresRapport: [], metierCourant: null, lieu: null, formations: null };
const garde = new Map(); // métiers gardés pour le récap : id -> { titre, fiche }
const $ = (s) => document.querySelector(s);

// Création d'éléments sans jamais injecter de HTML (protège contre tout texte piégé dans un PDF)
function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of enfants.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : String(c));
  return e;
}

const badgeSansBac = (f) => {
  const g = (f && (ficheOnisepLiee(f) || f)) || {};
  const [cls, txt] = BADGE[g.sans_bac || "inconnu"];
  return el("span", { class: `badge ${cls}` }, txt);
};

// ---------- Rapport ----------

async function chargerRapport(donnees) {
  $("#etat-rapport").textContent = "Lecture du rapport…";
  try {
    const pdfjs = await import(PDFJS);
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const r = await lirePDF(donnees, pdfjs);
    if (!r.total) {
      $("#etat-rapport").textContent = "Je n'ai pas trouvé de métiers dans ce PDF. Est-ce bien un Rapport des Possibles ?";
      return;
    }
    ctx.titresRapport = [];
    for (const [z, liste] of Object.entries(r.zones)) {
      for (const m of liste) ctx.titresRapport.push({ ...relier(m.titre), zone: Number(z) });
    }
    $("#etat-rapport").textContent =
      `Rapport${r.date ? ` du ${r.date}` : ""} : ${r.total} métiers dans ${Object.values(r.zones).filter((z) => z.length).length} zones. Touche un métier pour le découvrir.`;
    afficherZones();
    anim("zonesAffichees", $("#zones"));
    suggestions();
  } catch (e) {
    console.error(e);
    $("#etat-rapport").textContent = "Impossible de lire ce PDF. Essaie un autre fichier.";
  }
}

function afficherZones() {
  const bloc = $("#zones");
  bloc.replaceChildren();
  for (const z of [1, 2, 3, 4, 5]) {
    const liste = ctx.titresRapport.filter((t) => t.zone === z);
    const det = el("details", { class: "zone" },
      el("summary", {}, el("span", {}, `${ZONES[z][0]} · ${ZONES[z][1]}`), el("span", { class: "doux" }, `${liste.length}`)));
    if (z <= 3 && liste.length) det.open = true;
    if (!liste.length) det.append(el("p", { class: "doux" }, "Aucun métier dans cette zone."));
    const ul = el("ul", { class: "metiers" });
    for (const t of liste) {
      const conf = t.confiance === "sûr" ? "fiche trouvée" : t.confiance === "à vérifier" ? "fiche proche" : "pas de fiche";
      ul.append(el("li", {}, el("button", { type: "button", onclick: () => ouvrirFiche(t) },
        el("span", {}, t.titre, el("br"), el("span", { class: "confiance" }, conf)),
        t.fiche ? badgeSansBac(t.fiche) : el("span", { class: "badge inconnu" }, "?"))));
    }
    det.append(ul);
    bloc.append(det);
  }
}

// ---------- Fiche métier ----------

function ouvrirFiche(lien, options = {}) {
  const zone = $("#fiche");
  zone.hidden = false;
  zone.replaceChildren();
  const f = lien.fiche;
  if (!f) {
    zone.append(
      el("h2", {}, lien.titre),
      el("p", {}, "Je ne sais pas : je ne trouve pas ce métier dans les référentiels publics (ONISEP, ROME 4.0). " +
        "Il vient peut-être d'une base étrangère et n'a pas d'équivalent exact en France. " + CONSEILLER),
      el("a", { href: "https://www.orientation-regionsud.fr/", target: "_blank", rel: "noopener" }, "Chercher sur orientation-regionsud.fr"),
    );
    zone.scrollIntoView({ block: "start" });
    ctx.metierCourant = null;
    return;
  }
  ctx.metierCourant = f;
  const g = ficheOnisepLiee(f) || f;
  const resume = (f.resume || "").split(/(?<=\.)\s/).slice(0, 3).join(" ");
  const jour = (g.journee || "").split("\n").find((l) => l.length > 40 && !/:\s*$/.test(l));
  zone.append(...[
    el("div", { class: "fiche-entete" }, el("h2", {}, lien.titre || f.nom), badgeSansBac(f)),
    lien.titre && lien.confiance === "à vérifier"
      ? el("p", { class: "doux" }, `Fiche la plus proche trouvée : « ${f.nom} ». Vérifie que c'est bien le même métier.`)
      : null,
    el("p", {}, resume || "Je n'ai pas de description pour ce métier."),
    jour ? el("details", {}, el("summary", {}, "Une journée type"), el("p", {}, jour.replace(/^[^:]{0,60} : /, ""))) : null,
    el("dl", { class: "infos" },
      el("dt", {}, "Niveau minimum"), el("dd", {}, g.niveau_min || "inconnu"),
      el("dt", {}, "Salaire débutant"), el("dd", {}, g.salaire_debutant || "inconnu (pas dans mes sources)"),
      el("dt", {}, "Coût des études"), el("dd", {}, "inconnu (aucune source ouverte)")),
    el("div", { class: "rangee" },
      el("button", { type: "button", onclick: () => demander(`Où me former pour être ${f.nom} ?`) }, "Formations près de chez moi"),
      el("button", { type: "button", onclick: () => demander(`Il faut quel diplôme pour être ${f.nom} ?`) }, "Les études"),
      el("button", { type: "button", class: garde.has(f.id) ? "garde" : "", "aria-pressed": String(garde.has(f.id)), onclick: () => basculerGarde(lien, f) },
        etoile(), garde.has(f.id) ? "Gardé" : "Garder")),
    el("p", { class: "doux" }, "Source : ",
      el("a", { href: g.source.url, target: "_blank", rel: "noopener" }, `${g.source.nom} (${g.source.licence})`),
      g !== f ? [" · ", el("a", { href: f.source.url, target: "_blank", rel: "noopener" }, f.source.nom)] : null),
  ].filter(Boolean)); // on ne garde que les blocs présents (sinon « null » s'afficherait)
  suggestions();
  zone.scrollIntoView({ block: "start" });
  if (!options.sansAnimation) anim("ficheOuverte", zone);
}

function basculerGarde(lien, f) {
  if (garde.has(f.id)) garde.delete(f.id);
  else garde.set(f.id, { titre: lien.titre || f.nom, fiche: f });
  majRecap();
  ouvrirFiche(lien, { sansAnimation: true });
}

// ---------- Recherche ----------

$("#recherche").addEventListener("input", (e) => {
  const ul = $("#resultats");
  ul.replaceChildren();
  const q = e.target.value.trim();
  if (q.length < 3) return;
  const res = rechercher(q, 6);
  if (!res.length) {
    ul.append(el("li", { class: "doux" }, "Je ne trouve pas ce métier dans les référentiels publics."));
    return;
  }
  for (const r of res) {
    ul.append(el("li", {}, el("button", { type: "button", class: "", style: "width:100%;text-align:left;border-radius:10px",
      onclick: () => ouvrirFiche({ titre: null, fiche: r.fiche, confiance: "sûr" }) },
    r.fiche.nom, " ", el("span", { class: "doux" }, r.fiche.ref === "onisep" ? "· ONISEP" : `· ROME ${r.fiche.id}`))));
  }
});

// ---------- Chat ----------

function afficherMessage(qui, contenu) {
  const m = el("div", { class: `message ${qui}` });
  if (typeof contenu === "string") m.textContent = contenu;
  else m.append(contenu);
  $("#fil").append(m);
  m.scrollIntoView({ block: "nearest" });
  anim("message", m);
  return m;
}

function rendreReponse(r) {
  const bloc = el("div", {}, r.texte);
  if (r.comparaison) {
    const [a, b] = r.comparaison;
    const lignes = [["Niveau minimum", "niveau"], ["Sans bac", "sansBac"], ["Diplôme d'entrée (ONISEP)", "duree"],
      ["Salaire débutant", "salaire"], ["Sélection", "selection"], ["Coût", "cout"]];
    bloc.append(el("table", { class: "comparaison" },
      el("tr", {}, el("th", {}, ""), el("th", {}, a.nom), el("th", {}, b.nom)),
      lignes.map(([lib, k]) => el("tr", {}, el("th", {}, lib), el("td", {}, a[k]), el("td", {}, b[k])))));
  }
  if (r.sources && r.sources.length) {
    bloc.append(el("div", { class: "sources" }, "Sources :",
      r.sources.map((s) => el("a", { href: s.url, target: "_blank", rel: "noopener" }, s.nom))));
  }
  // Le détail technique du contrôle reste disponible au survol (attribut title), pas dans le texte
  const mode = el("div", { class: "mode" },
    r.reformule ? `Reformulé par ${r.reformule} (modèle open weight) à partir des sources.` : "Réponse tirée directement des sources.",
    r.controle ? " La version reformulée par l'IA a été écartée par un contrôle de fiabilité." : "");
  if (r.controle) mode.title = r.controle;
  bloc.append(mode);
  return bloc;
}

async function demander(question) {
  if (!question.trim()) return;
  afficherMessage("jeune", question);
  const attente = afficherMessage("assistant", "Je cherche dans les sources…");
  try {
    const r = await repondre(question, ctx);
    attente.replaceChildren(rendreReponse(r));
  } catch (e) {
    console.error(e);
    attente.textContent = "Désolé, une erreur s'est produite. Réessaie.";
  }
  suggestions();
}

$("#form-question").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("#question").value;
  $("#question").value = "";
  demander(q);
});

function suggestions() {
  const bloc = $("#suggestions");
  bloc.replaceChildren();
  const f = ctx.metierCourant;
  let liste;
  if (f) {
    const nom = f.nom.replace(/\s*\/.*$/, "").replace(/\(.*\)/, "").trim();
    liste = [`C'est quoi concrètement, ${nom} ?`, "Je peux le faire sans le bac ?", "Combien gagne un débutant ?",
      "Où me former près de Nice ?", "Est-ce que c'est sélectif ?"];
    const autre = ctx.titresRapport.find((t) => t.fiche && t.fiche.id !== f.id);
    if (autre) liste.push(`Compare ${nom} et ${autre.titre}`);
  } else if (ctx.titresRapport.length) {
    const t = ctx.titresRapport.find((x) => x.fiche);
    liste = t ? [`C'est quoi concrètement, ${t.titre} ?`, `Je peux être ${t.titre} sans le bac ?`] : [];
  } else {
    liste = ["C'est quoi concrètement, un urbaniste ?", "Je peux être boulanger sans le bac ?", "Combien gagne un fleuriste débutant ?"];
  }
  for (const q of liste) bloc.append(el("button", { type: "button", onclick: () => demander(q) }, q));
}

// ---------- Récap ----------

function majRecap() {
  const lignes = ["MA PROCHAINE ÉTAPE", ""];
  if (!garde.size) lignes.push("(Garde des métiers avec le bouton « Garder » pour les voir ici.)");
  for (const { titre, fiche } of garde.values()) {
    const g = ficheOnisepLiee(fiche) || fiche;
    lignes.push(`• ${titre}`,
      `  Niveau minimum : ${g.niveau_min || "inconnu"} · Sans bac : ${g.sans_bac || "inconnu"}`,
      `  Salaire débutant : ${g.salaire_debutant || "inconnu"}`,
      `  Source : ${g.source.url}`);
  }
  lignes.push("", "Questions à poser au Centre des Possibles :",
    "• Quelle formation près de chez moi pour commencer ?",
    "• Est-ce que je peux faire un stage ou une journée d'observation ?",
    "• Quelles aides existent pour financer mes études ?",
    "", "Centre des Possibles : https://centredespossibles.org/");
  $("#recap-texte").value = lignes.join("\n");
}

$("#copier").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("#recap-texte").value);
    $("#copier").textContent = "Copié !";
  } catch {
    $("#recap-texte").select();
    $("#copier").textContent = "Sélectionné : copie-le";
  }
  setTimeout(() => ($("#copier").textContent = "Copier mon récap"), 2000);
});

// ---------- Modèle open weight ----------

function majModeIA() {
  $("#mode-ia").textContent = modele.mode === "ollama"
    ? `IA : ${modele.nom} via Ollama, sur cet ordinateur (modèle open weight). Les réponses restent tirées des sources.`
    : modele.mode === "webllm"
      ? `IA : ${modele.nom} (modèle open weight), dans ton navigateur.`
      : "Mode sans IA : les réponses sont tirées directement des fiches officielles.";
  $("#activer-webllm").classList.toggle("cache", modele.mode !== "aucun" || !("gpu" in navigator));
}

$("#activer-webllm").addEventListener("click", async () => {
  const b = $("#activer-webllm");
  b.disabled = true;
  try {
    await activerWebLLM((p) => (b.textContent = `Téléchargement du modèle : ${Math.round((p.progress || 0) * 100)} %`));
  } catch (e) {
    console.error(e);
    b.textContent = "Impossible d'activer l'IA ici. Le mode sans IA reste disponible.";
  }
  majModeIA();
});

// ---------- Thème clair / sombre (bouton soleil / lune) ----------
// Sans choix enregistré, on suit le système. Le choix est mémorisé dans ce navigateur seulement.

function themeActuel() {
  const force = document.documentElement.getAttribute("data-theme");
  if (force === "light" || force === "dark") return force;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function majBoutonTheme() {
  const sombre = themeActuel() === "dark";
  const b = $("#theme");
  b.setAttribute("aria-label", sombre ? "Passer en mode clair" : "Passer en mode sombre");
  b.title = sombre ? "Mode clair" : "Mode sombre";
}

$("#theme").addEventListener("click", () => {
  const nouveau = themeActuel() === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nouveau);
  try { localStorage.setItem("luciole-theme", nouveau); } catch { /* stockage indisponible : le choix vaut pour cette visite */ }
  majBoutonTheme();
});
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", majBoutonTheme);
majBoutonTheme();

// ---------- Démarrage ----------

$("#fichier").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (f) await chargerRapport(new Uint8Array(await f.arrayBuffer()));
});
$("#essai").addEventListener("click", async () => {
  const r = await fetch("data/sample/rapport_fictif.pdf");
  await chargerRapport(new Uint8Array(await r.arrayBuffer()));
});

(async () => {
  $("#etat-rapport").textContent = "Chargement des fiches métiers…";
  await Promise.all([chargerMetiers(ctx.base), chargerPrompt(ctx.base)]);
  $("#etat-rapport").textContent = "";
  majRecap();
  suggestions();
  majModeIA();
  if (await detecterOllama()) majModeIA();
  chargerFormations(ctx.base).then((f) => (ctx.formations = f)); // en arrière-plan
})();
