// Interface de Luciole : accueil, ciel de lucioles (ou liste), fiche en panneau, duel, chat, récap.
// Aucune donnée n'est stockée ni envoyée : tout vit dans la mémoire de la page.
// Seule exception : le choix clair / sombre, mémorisé dans CE navigateur.

import { chargerMetiers, relier, rechercher, chargerFormations, ficheOnisepLiee } from "./donnees.js";
import { lirePDF } from "./rapport.js";
import { dessinerCiel } from "./ciel.js";
import { formationsProches } from "./formations.js";
import {
  repondre, comparer, chargerPrompt, detecterOllama, activerWebLLM, modele, CONSEILLER,
} from "./assistant.js";

// pdf.js 4.0.379 copié dans le dépôt (licence Apache 2.0) : la lecture du rapport marche sans internet
const PDFJS = new URL("../vendor/pdfjs/pdf.min.mjs", import.meta.url).href;
const PDFJS_WORKER = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
const anim = (nom, ...args) => window.eclaireurAnim && window.eclaireurAnim[nom](...args);
const calme = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const KM_PROCHE = 30;          // filtre « formation à moins de 30 km de Nice »
const VILLE_REFERENCE = "Nice"; // le Centre des Possibles est à Nice

// Les 5 zones, d'après le guide du Centre des Possibles (mots simples)
const ZONES = {
  1: ["Zone 1", "de quelques jours à 6 mois"],
  2: ["Zone 2", "de 3 mois à 2 ans, souvent avec un CAP"],
  3: ["Zone 3", "1 à 3 ans après le bac"],
  4: ["Zone 4", "5 ans après le bac, ou un concours"],
  5: ["Zone 5", "études très longues, après 5 ans"],
};
const BADGE = {
  oui: ["oui", "Sans bac : oui"],
  comment: ["comment", "Bac requis"],
  non: ["non", "Sans bac : non"],
  inconnu: ["inconnu", "Sans bac : ?"],
};

const ctx = { base: ".", titresRapport: [], metierCourant: null, lieu: null, formations: null };
const garde = new Map(); // métiers gardés pour le récap : id -> { titre, fiche }
const $ = (s) => document.querySelector(s);
let ciel = null;           // le ciel dessiné (voir js/ciel.js)
let filtreActuel = "tous";

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

function icone(d, plein = false) {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", d);
  if (plein) s.classList.add("plein");
  s.append(p);
  return s;
}
const ETOILE = "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z";
const DUEL = "M7 4v16M17 4v16M3 8h8M13 16h8";

const enrichie = (f) => (f && (ficheOnisepLiee(f) || f)) || null;
const sansBac = (f) => (enrichie(f) || {}).sans_bac || "inconnu";
const badgeSansBac = (f) => {
  const [cls, txt] = BADGE[sansBac(f)];
  return el("span", { class: `badge ${cls}` }, txt);
};
// Nom de source simple (les termes techniques restent dans la section « Sources » du pied de page)
const nomSource = (f) => (f.ref === "onisep" ? "Fiche ONISEP" : "Fiche France Travail");
const fiable = (t) => Boolean(t.fiche);

// ---------- Rapport ----------

async function chargerRapport(donnees) {
  $("#etat-rapport").textContent = "Je lis ton rapport…";
  try {
    const pdfjs = await import(PDFJS);
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    const r = await lirePDF(donnees, pdfjs);
    if (!r.total) {
      $("#etat-rapport").textContent = "Je ne trouve pas de métiers dans ce PDF. Est-ce bien un Rapport des Possibles ?";
      return;
    }
    ctx.titresRapport = [];
    for (const [z, liste] of Object.entries(r.zones)) {
      for (const m of liste) ctx.titresRapport.push({ ...relier(m.titre), zone: Number(z) });
    }
    $("#etat-rapport").textContent = "";
    afficherVueRapport(r);
  } catch (e) {
    console.error(e);
    $("#etat-rapport").textContent = "Je n'arrive pas à lire ce PDF. Essaie un autre fichier.";
  }
}

function afficherVueRapport(r) {
  $("#accueil").hidden = true;
  for (const id of ["#vue-rapport", "#bloc-chat", "#bloc-recherche", "#bloc-recap"]) $(id).hidden = false;
  const nbZones = Object.values(r.zones).filter((z) => z.length).length;
  $("#resume-rapport").textContent = `${r.total} métiers dans ${nbZones} zones${r.date ? `, rapport du ${r.date}` : ""}.`;
  dessiner();
  afficherZones();
  appliquerFiltre(filtreActuel);
  // Très petit écran (moins de 360 px) : les lucioles seraient trop serrées pour le doigt,
  // on commence par la liste (le ciel reste accessible avec le bouton « Ciel »)
  if ($("#ciel").clientWidth < 328) choisirVue("liste");
  suggestions();
  $("#t-vue").focus({ preventScroll: true });
  $("#vue-rapport").scrollIntoView({ block: "start" });
}

// ---------- Le ciel ----------

function libelleLuciole(t) {
  const base = `${t.titre}, zone ${t.zone}.`;
  if (!fiable(t)) return `${base} Je ne sais pas : pas de fiche fiable.`;
  return `${base} ${BADGE[sansBac(t.fiche)][1]}.${t.confiance === "à vérifier" ? " Fiche proche." : ""} Ouvrir la fiche.`;
}

function dessiner() {
  ciel = dessinerCiel($("#ciel"), ctx.titresRapport, {
    libelle: libelleLuciole,
    fiable,
    onSurvol: (t) => ($("#ciel-legende").textContent = fiable(t)
      ? `${t.titre} · zone ${t.zone} · ${BADGE[sansBac(t.fiche)][1]}`
      : `${t.titre} · zone ${t.zone} · je ne sais pas`),
    // Le chemin lumineux se trace, puis la fiche s'ouvre (tout de suite si animations réduites)
    onChoisir: (t, bouton) => setTimeout(() => ouvrirFiche(t, { declencheur: bouton }), calme() ? 0 : 420),
  });
  anim("cielAffiche", $("#ciel"));
}

let largeurCiel = 0;
window.addEventListener("resize", () => {
  const w = $("#ciel").clientWidth;
  if (ciel && w && w !== largeurCiel) { largeurCiel = w; dessiner(); appliquerFiltre(filtreActuel); }
});

function choisirVue(vue) {
  const estCiel = vue === "ciel";
  $("#bloc-ciel").hidden = !estCiel;
  $("#zones").hidden = estCiel;
  $("#vue-ciel").setAttribute("aria-pressed", String(estCiel));
  $("#vue-liste").setAttribute("aria-pressed", String(!estCiel));
  $("#t-vue").textContent = estCiel ? "Ton ciel de métiers" : "Tes métiers en liste";
  if (estCiel && $("#ciel").clientWidth !== largeurCiel) { dessiner(); appliquerFiltre(filtreActuel); }
}
$("#vue-ciel").addEventListener("click", () => choisirVue("ciel"));
$("#vue-liste").addEventListener("click", () => choisirVue("liste"));

// ---------- Filtres ----------

async function filtreProche() {
  if (!ctx.formations) {
    $("#filtre-info").textContent = "Je cherche les formations…";
    ctx.formations = await chargerFormations(ctx.base);
  }
  const ids = new Set();
  for (const t of ctx.titresRapport) {
    if (!t.fiche) continue;
    const r = formationsProches(enrichie(t.fiche), ctx.formations, VILLE_REFERENCE, 1);
    if (r.liste.length && r.liste[0].km <= KM_PROCHE) ids.add(t.titre);
  }
  return (t) => ids.has(t.titre);
}

async function appliquerFiltre(nom) {
  filtreActuel = nom;
  for (const b of document.querySelectorAll(".filtres button")) b.setAttribute("aria-pressed", String(b.dataset.filtre === nom));
  let filtre = null;
  if (nom === "sansbac") filtre = (t) => fiable(t) && sansBac(t.fiche) === "oui";
  if (nom === "proche") filtre = await filtreProche();
  const n = ciel ? ciel.filtrer(filtre) : ctx.titresRapport.length;
  for (const b of document.querySelectorAll("#zones .metiers button")) {
    const t = ctx.titresRapport[Number(b.dataset.index)];
    b.classList.toggle("hors-filtre", Boolean(filtre) && !filtre(t));
  }
  const total = ctx.titresRapport.length;
  $("#filtre-info").textContent = nom === "tous" ? "" : nom === "sansbac"
    ? `${n} métiers sur ${total} accessibles sans le bac, d'après l'ONISEP.`
    : `${n} métiers sur ${total} ont une formation à moins de ${KM_PROCHE} km de Nice (formations au lycée ou à l'école, hors apprentissage).`;
}
for (const b of document.querySelectorAll(".filtres button")) b.addEventListener("click", () => appliquerFiltre(b.dataset.filtre));

// ---------- La liste (garde l'affichage d'origine) ----------

function afficherZones() {
  const bloc = $("#zones");
  bloc.replaceChildren();
  for (const z of [1, 2, 3, 4, 5]) {
    const liste = ctx.titresRapport.map((t, i) => ({ t, i })).filter(({ t }) => t.zone === z);
    const det = el("details", { class: "zone", open: "" },
      el("summary", {}, el("span", {}, `${ZONES[z][0]} · ${ZONES[z][1]}`), el("span", { class: "doux" }, `${liste.length}`)));
    if (!liste.length) det.append(el("p", { class: "doux" }, "Aucun métier dans cette zone."));
    const ul = el("ul", { class: "metiers" });
    for (const { t, i } of liste) {
      const conf = t.confiance === "sûr" ? "fiche trouvée" : t.confiance === "à vérifier" ? "fiche proche" : "je ne sais pas";
      const b = el("button", { type: "button", "data-index": String(i) },
        el("span", {}, t.titre, el("br"), el("span", { class: "confiance" }, conf)),
        t.fiche ? badgeSansBac(t.fiche) : el("span", { class: "badge inconnu" }, "?"));
      b.addEventListener("click", () => ouvrirFiche(t, { declencheur: b }));
      ul.append(el("li", {}, b));
    }
    det.append(ul);
    bloc.append(det);
  }
}

// ---------- Panneau de la fiche (monte du bas) ----------

let retourFocus = null;

function ouvrirPanneau(declencheur) {
  const p = $("#fiche");
  if (p.hidden) {
    retourFocus = declencheur || document.activeElement;
    p.hidden = false;
    $("#voile").hidden = false;
    document.body.classList.add("panneau-ouvert");
    anim("feuilleOuverte", p);
  }
  p.scrollTop = 0;
  const titre = $("#fiche-titre");
  if (titre) titre.focus({ preventScroll: true });
}

function fermerPanneau() {
  const p = $("#fiche");
  if (p.hidden) return;
  p.hidden = true;
  $("#voile").hidden = true;
  document.body.classList.remove("panneau-ouvert");
  for (const b of document.querySelectorAll(".luciole.allumee")) b.classList.remove("allumee");
  if (retourFocus && document.contains(retourFocus)) retourFocus.focus();
}
$("#fermer-fiche").addEventListener("click", fermerPanneau);
$("#voile").addEventListener("click", fermerPanneau);
document.addEventListener("keydown", (e) => {
  const p = $("#fiche");
  if (p.hidden) return;
  if (e.key === "Escape") { e.preventDefault(); fermerPanneau(); return; }
  if (e.key === "Tab") { // le focus reste dans le panneau tant qu'il est ouvert
    const f = [...p.querySelectorAll("button, a[href], input, summary, [tabindex='0']")].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});

const titreFiche = (texte) => el("h2", { id: "fiche-titre", tabindex: "-1" }, texte);

function ouvrirFiche(lien, options = {}) {
  const zone = $("#fiche-contenu");
  zone.replaceChildren();
  const f = lien.fiche;
  if (!f) {
    zone.append(
      titreFiche(lien.titre),
      el("p", { class: "je-ne-sais-pas" }, "Je ne sais pas. Je ne trouve pas ce métier dans les fiches officielles."),
      el("p", {}, "Il vient peut-être d'une liste étrangère, sans équivalent exact en France. " + CONSEILLER),
      el("a", { class: "bouton", href: "https://www.orientation-regionsud.fr/", target: "_blank", rel: "noopener" }, "Chercher sur orientation-regionsud.fr"),
    );
    ctx.metierCourant = null;
    ouvrirPanneau(options.declencheur);
    return;
  }
  ctx.metierCourant = f;
  const g = enrichie(f);
  const resume = (f.resume || "").split(/(?<=\.)\s/).slice(0, 2).join(" ");
  const jour = (g.journee || "").split("\n").find((l) => l.length > 40 && !/:\s*$/.test(l));
  zone.append(...[
    el("div", { class: "fiche-entete" }, titreFiche(lien.titre || f.nom), badgeSansBac(f)),
    lien.titre && lien.confiance === "à vérifier"
      ? el("p", { class: "doux" }, `Fiche la plus proche : « ${f.nom} ». Vérifie que c'est bien le même métier.`)
      : null,
    el("p", { class: "resume" }, resume || "Je n'ai pas de description pour ce métier."),
    jour ? el("details", {}, el("summary", {}, "Une journée type"), el("p", {}, jour.replace(/^[^:]{0,60} : /, ""))) : null,
    el("dl", { class: "infos" },
      el("dt", {}, "Niveau minimum"), el("dd", {}, g.niveau_min || "Je ne sais pas"),
      el("dt", {}, "Salaire au début"), el("dd", {}, g.salaire_debutant || "Je ne sais pas"),
      el("dt", {}, "Coût des études"), el("dd", {}, "Je ne sais pas")),
    el("div", { class: "actions-fiche" },
      el("button", { type: "button", class: "principal", onclick: () => choisirDuel(lien) }, icone(DUEL), "Comparer"),
      el("button", { type: "button", onclick: () => { fermerPanneau(); demander(`Où me former pour être ${f.nom} ?`); } }, "Formations près de chez moi"),
      el("button", { type: "button", onclick: () => { fermerPanneau(); demander(`Il faut quel diplôme pour être ${f.nom} ?`); } }, "Les études"),
      el("button", { type: "button", class: garde.has(f.id) ? "garde" : "", "aria-pressed": String(garde.has(f.id)), onclick: () => basculerGarde(lien, f) },
        icone(ETOILE, garde.has(f.id)), garde.has(f.id) ? "Gardé" : "Garder")),
    el("p", { class: "doux source-fiche" }, "Source : ",
      el("a", { href: g.source.url, target: "_blank", rel: "noopener" }, nomSource(g)),
      g !== f ? [" · ", el("a", { href: f.source.url, target: "_blank", rel: "noopener" }, nomSource(f))] : null),
  ].filter(Boolean));
  suggestions();
  ouvrirPanneau(options.declencheur);
}

function basculerGarde(lien, f) {
  if (garde.has(f.id)) garde.delete(f.id);
  else garde.set(f.id, { titre: lien.titre || f.nom, fiche: f });
  majRecap();
  ouvrirFiche(lien);
  const b = $("#fiche-contenu .actions-fiche button:last-child");
  if (b) b.focus();
}

// ---------- Le duel : deux métiers côte à côte ----------

function choisirDuel(lienA) {
  const zone = $("#fiche-contenu");
  const autres = ctx.titresRapport.filter((t) => t.fiche && t.fiche.id !== lienA.fiche.id);
  zone.replaceChildren(
    titreFiche(`Comparer « ${lienA.titre || lienA.fiche.nom} » avec…`),
    autres.length
      ? el("ul", { class: "choix-duel" }, autres.map((t) => el("li", {},
        el("button", { type: "button", onclick: () => afficherDuel(lienA, t) }, t.titre, " ", badgeSansBac(t.fiche)))))
      : el("p", {}, "Je n'ai pas d'autre métier avec une fiche dans ton rapport."),
    el("button", { type: "button", onclick: () => ouvrirFiche(lienA) }, "Retour à la fiche"),
  );
  $("#fiche-titre").focus({ preventScroll: true });
  $("#fiche").scrollTop = 0;
}

function formationsPresDe(f) {
  if (!ctx.formations) return null;
  const lieu = ctx.lieu || VILLE_REFERENCE;
  const r = formationsProches(enrichie(f), ctx.formations, lieu, 50);
  const proches = r.liste.filter((x) => x.km <= KM_PROCHE);
  if (!r.liste.length) return "Je ne sais pas";
  if (!proches.length) return `Aucune à moins de ${KM_PROCHE} km de ${lieu}`;
  const p = proches[0];
  const n = proches.length;
  return `${n} formation${n > 1 ? "s" : ""} à moins de ${KM_PROCHE} km de ${lieu}. La plus proche : ${p.ville}, ${p.km} km`;
}

async function afficherDuel(lienA, lienB) {
  if (!ctx.formations) ctx.formations = await chargerFormations(ctx.base);
  const [a, b] = comparer(lienA.fiche, lienB.fiche, ctx.formations);
  const jnsp = (v) => (!v || /^inconnu/.test(v) ? "Je ne sais pas" : v);
  const sansBacLisible = (v) => ({ oui: "Oui", non: "Non", "non, bac requis": "Non, bac requis" }[v] || "Je ne sais pas");
  const lignes = [
    ["Niveau minimum", jnsp(a.niveau), jnsp(b.niveau)],
    ["Durée du premier diplôme", jnsp(a.duree), jnsp(b.duree)],
    ["Sans bac", sansBacLisible(a.sansBac), sansBacLisible(b.sansBac)],
    ["Formations proches", formationsPresDe(lienA.fiche) || "Je ne sais pas", formationsPresDe(lienB.fiche) || "Je ne sais pas"],
  ];
  const nomA = lienA.titre || lienA.fiche.nom, nomB = lienB.titre || lienB.fiche.nom;
  const zone = $("#fiche-contenu");
  zone.replaceChildren(
    titreFiche("Le duel"),
    el("table", { class: "duel" },
      el("thead", {}, el("tr", {}, el("th", { scope: "col" }, nomA), el("th", { scope: "col" }, nomB))),
      lignes.map(([lib, va, vb]) => el("tbody", {},
        el("tr", {}, el("th", { scope: "colgroup", colspan: "2", class: "duel-critere" }, lib)),
        el("tr", {}, el("td", { class: /^Je ne sais pas/.test(va) ? "jnsp" : "" }, va), el("td", { class: /^Je ne sais pas/.test(vb) ? "jnsp" : "" }, vb))))),
    el("p", { class: "doux petite" }, "Formations : lycées et écoles de la Région Sud (hors apprentissage)."),
    el("p", { class: "doux source-fiche" }, "Sources : ",
      el("a", { href: enrichie(lienA.fiche).source.url, target: "_blank", rel: "noopener" }, `${nomSource(enrichie(lienA.fiche))} : ${nomA}`), " · ",
      el("a", { href: enrichie(lienB.fiche).source.url, target: "_blank", rel: "noopener" }, `${nomSource(enrichie(lienB.fiche))} : ${nomB}`)),
    el("div", { class: "actions-fiche" },
      el("button", { type: "button", onclick: () => choisirDuel(lienA) }, "Changer de métier"),
      el("button", { type: "button", onclick: () => ouvrirFiche(lienA) }, "Retour à la fiche")),
  );
  $("#fiche-titre").focus({ preventScroll: true });
  $("#fiche").scrollTop = 0;
}

// ---------- Recherche ----------

$("#recherche").addEventListener("input", (e) => {
  const ul = $("#resultats");
  ul.replaceChildren();
  const q = e.target.value.trim();
  if (q.length < 3) return;
  const res = rechercher(q, 5);
  if (!res.length) {
    ul.append(el("li", { class: "doux" }, "Je ne trouve pas ce métier dans les fiches officielles."));
    return;
  }
  for (const r of res) {
    const b = el("button", { type: "button" }, r.fiche.nom);
    b.addEventListener("click", () => ouvrirFiche({ titre: null, fiche: r.fiche, confiance: "sûr" }, { declencheur: b }));
    ul.append(el("li", {}, b));
  }
});

// ---------- Chat : réponse courte, puis « En savoir plus » ----------

function afficherMessage(qui, contenu) {
  const m = el("div", { class: `message ${qui}` });
  if (typeof contenu === "string") m.textContent = contenu;
  else m.append(contenu);
  $("#fil").append(m);
  m.scrollIntoView({ block: "nearest" });
  anim("message", m);
  return m;
}

// Coupe une réponse : les premières lignes (environ 220 caractères), le reste derrière un bouton
export function couperReponse(texte) {
  const lignes = texte.split("\n").filter((l, i, t) => l.trim() || (i > 0 && t[i - 1].trim()));
  const court = [];
  let n = 0;
  for (const l of lignes) {
    if (court.length && (n + l.length > 220 || court.length >= 3)) break;
    court.push(l);
    n += l.length;
  }
  if (court.length === 1 && court[0].length > 260) { // une seule longue phrase : on coupe à la fin d'une phrase
    const p = court[0], fin = p.slice(0, 220).lastIndexOf(". ");
    if (fin > 80) return [p.slice(0, fin + 1), [p.slice(fin + 2), ...lignes.slice(1)].join("\n").trim()];
  }
  return [court.join("\n").trim(), lignes.slice(court.length).join("\n").trim()];
}

function rendreReponse(r) {
  // Version courte d'abord. Si l'IA a reformulé, « En savoir plus » montre la réponse complète des fiches.
  let [court, reste] = couperReponse(r.texte);
  if (r.texteSource) reste = [reste, "Ce que disent les fiches :", r.texteSource].filter(Boolean).join("\n\n");
  const bloc = el("div", {}, el("p", { class: "reponse-courte" }, court));
  if (r.comparaison) {
    const [a, b] = r.comparaison;
    const lignes = [["Niveau minimum", "niveau"], ["Sans bac", "sansBac"], ["Premier diplôme", "duree"],
      ["Salaire au début", "salaire"], ["Sélection", "selection"], ["Coût", "cout"]];
    const jnsp = (v) => (/^inconnu/.test(v) ? "Je ne sais pas" : v);
    bloc.append(el("table", { class: "comparaison" },
      el("tr", {}, el("th", {}, ""), el("th", {}, a.nom), el("th", {}, b.nom)),
      lignes.map(([lib, k]) => el("tr", {}, el("th", {}, lib), el("td", {}, jnsp(a[k])), el("td", {}, jnsp(b[k]))))));
  }
  if (reste) {
    const plus = el("div", { class: "reponse-plus", hidden: "" }, reste);
    const bouton = el("button", { type: "button", class: "en-savoir-plus", "aria-expanded": "false" }, "En savoir plus");
    bouton.addEventListener("click", () => {
      const ouvert = plus.hidden;
      plus.hidden = !ouvert;
      bouton.setAttribute("aria-expanded", String(ouvert));
      bouton.textContent = ouvert ? "Moins" : "En savoir plus";
    });
    bloc.append(plus, bouton);
  }
  if (r.sources && r.sources.length) {
    bloc.append(el("div", { class: "sources" }, "Sources :",
      r.sources.map((s) => el("a", { href: s.url, target: "_blank", rel: "noopener" }, s.nom))));
  }
  const mode = el("div", { class: "mode" },
    r.reformule ? "Reformulé par l'IA, à partir des sources." : "Réponse tirée des fiches officielles.",
    r.controle ? " La version de l'IA a été écartée par un contrôle." : "");
  if (r.controle) mode.title = r.controle;
  bloc.append(mode);
  return bloc;
}

async function demander(question) {
  if (!question.trim()) return;
  $("#bloc-chat").hidden = false;
  afficherMessage("jeune", question);
  const attente = afficherMessage("assistant", "Je cherche dans les fiches…");
  try {
    const r = await repondre(question, ctx);
    attente.replaceChildren(rendreReponse(r));
  } catch (e) {
    console.error(e);
    attente.textContent = "Désolé, ça n'a pas marché. Réessaie.";
  }
  suggestions();
}

$("#form-question").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = $("#question").value;
  $("#question").value = "";
  demander(q);
});

// Toujours 3 questions, toujours visibles
function suggestions() {
  const bloc = $("#suggestions");
  bloc.replaceChildren();
  const f = ctx.metierCourant;
  let liste;
  if (f) {
    const nom = f.nom.replace(/\s*\/.*$/, "").replace(/\(.*\)/, "").trim();
    liste = [`C'est quoi concrètement, ${nom} ?`, "Je peux le faire sans le bac ?", "Combien on gagne au début ?"];
  } else {
    const t = ctx.titresRapport.find((x) => x.fiche);
    const nom = t ? t.titre : "boulanger";
    liste = [`C'est quoi concrètement, ${nom} ?`, `Je peux être ${nom} sans le bac ?`, "Quels métiers de ma liste sont possibles sans le bac ?"];
  }
  for (const q of liste.slice(0, 3)) bloc.append(el("button", { type: "button", onclick: () => demander(q) }, q));
}

// ---------- Récap ----------

function majRecap() {
  const lignes = ["MA PROCHAINE ÉTAPE", ""];
  if (!garde.size) lignes.push("(Garde des métiers avec le bouton « Garder » pour les voir ici.)");
  for (const { titre, fiche } of garde.values()) {
    const g = enrichie(fiche);
    lignes.push(`• ${titre}`,
      `  Niveau minimum : ${g.niveau_min || "je ne sais pas"} · Sans bac : ${g.sans_bac || "je ne sais pas"}`,
      `  Salaire au début : ${g.salaire_debutant || "je ne sais pas"}`,
      `  Source : ${g.source.url}`);
  }
  lignes.push("", "Questions à poser au Centre des Possibles :",
    "• Quelle formation près de chez moi pour commencer ?",
    "• Est-ce que je peux faire un stage ou une journée d'observation ?",
    "• Quelles aides existent pour payer mes études ?",
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

// ---------- IA facultative (modèle libre, sur l'ordinateur ou dans le navigateur) ----------

function majModeIA() {
  const t = $("#mode-ia");
  t.textContent = modele.mode === "aucun"
    ? "Les réponses viennent des fiches officielles."
    : "Une IA reformule les réponses des fiches, sans rien inventer.";
  t.title = modele.mode === "aucun" ? "" : `Modèle : ${modele.nom}`;
  $("#activer-webllm").classList.toggle("cache", modele.mode !== "aucun" || !("gpu" in navigator));
}

$("#activer-webllm").addEventListener("click", async () => {
  const b = $("#activer-webllm");
  b.disabled = true;
  try {
    await activerWebLLM((p) => (b.textContent = `Téléchargement : ${Math.round((p.progress || 0) * 100)} %`));
  } catch (e) {
    console.error(e);
    b.textContent = "Impossible d'activer l'IA ici. Les réponses des fiches restent disponibles.";
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
  $("#etat-rapport").textContent = "Je prépare les fiches métiers…";
  await Promise.all([chargerMetiers(ctx.base), chargerPrompt(ctx.base)]);
  $("#etat-rapport").textContent = "";
  majRecap();
  suggestions();
  majModeIA();
  if (await detecterOllama()) majModeIA();
  chargerFormations(ctx.base).then((f) => (ctx.formations = f)); // en arrière-plan
})();
