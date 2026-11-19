// Test de la branche « ciel » : node test_ciel.mjs <url> <largeur> <hauteur> <light|dark> <prefixe captures>
import puppeteer from "puppeteer-core";
import os from "os";
// Navigateur : variable CHROME, sinon Chrome installé au chemin habituel de macOS
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const [SITE, L, H, THEME, NOM] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4]), process.argv[5], process.argv[6]];
const DOSSIER = process.env.SORTIE || os.tmpdir();
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true, args: ["--no-first-run"],
});
const lignes = [];
const ok = (nom, cond, detail = "") => lignes.push(`${cond ? "OK " : "ÉCHEC"} ${nom}${detail ? " — " + detail : ""}`);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(reduit = false) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: L, height: H, isMobile: L < 600, hasTouch: L < 600 });
  await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: THEME }, { name: "prefers-reduced-motion", value: reduit ? "reduce" : "no-preference" }]);
  p.erreurs = []; p.requetes = [];
  p.on("pageerror", (e) => p.erreurs.push(e.message));
  p.on("request", (r) => p.requetes.push(r.url()));
  await p.goto(SITE, { waitUntil: "networkidle0" });
  await p.waitForFunction(() => !document.querySelector("#etat-rapport").textContent.includes("prépare"));
  return { p, ctx };
}
const visibles = (p, sel) => p.$$eval(sel, (els) => els.filter((e) => e.offsetParent !== null || getComputedStyle(e).position === "fixed").length);

const { p, ctx } = await page();
// 1) Accueil : écran de nuit, un seul gros bouton + un lien, aperçu, lucioles qui flottent
await pause(800);
const accueil = await p.evaluate(() => {
  const r = (s) => document.querySelector(s).getBoundingClientRect();
  const cv = document.querySelector("#lucioles-fond");
  const px = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  let allumes = 0; for (let i = 3; i < px.length; i += 4 * 97) if (px[i] > 0) allumes++;
  return {
    caches: ["#vue-rapport", "#bloc-chat", "#bloc-recherche", "#bloc-recap"].every((s) => document.querySelector(s).hidden),
    titre: document.querySelector(".hero-titre").textContent,
    sous: document.querySelector(".hero-sous").textContent,
    principal: [...document.querySelectorAll("#accueil .principal")].map((b) => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)]),
    essai: Math.round(r("#essai").height),
    pastille: document.querySelector(".pastille").textContent.trim(),
    pleinEcran: r("#ecran").height >= innerHeight - 1,
    colonnes: getComputedStyle(document.querySelector("#accueil")).gridTemplateColumns.split(" ").length,
    apercu: document.querySelectorAll("#apercu .ap-metier").length,
    allume: document.querySelectorAll("#apercu .ap-metier.allume").length,
    canvas: allumes,
    debordement: document.documentElement.scrollWidth > innerWidth,
  };
});
ok("accueil : plein écran, grand titre, un seul gros bouton", accueil.caches && accueil.pleinEcran && accueil.titre === "Ton rapport, enfin clair." && !/\d/.test(accueil.titre + accueil.sous)
  && accueil.principal.length === 1 && accueil.principal[0][1] >= 48 && accueil.essai >= 48, `${accueil.principal[0][0]} ${accueil.principal[0][1]}px · lien ${accueil.essai}px`);
ok("accueil : pastille de confidentialité", accueil.pastille === "Ton PDF reste sur ton appareil");
ok("accueil : mini ciel animé", accueil.apercu === 4 && accueil.allume === 1);
ok(`accueil : ${L >= 900 ? "deux colonnes sur ordinateur" : "une colonne sur téléphone"}`, accueil.colonnes === (L >= 900 ? 2 : 1), `${accueil.colonnes} colonne(s)`);
ok("accueil : lucioles qui flottent (canvas)", accueil.canvas > 0 && !accueil.debordement, `${accueil.canvas} points allumés`);
// 2) Exemple chargé : le ciel par défaut
await p.click("#essai");
await p.waitForFunction(() => document.querySelectorAll(".luciole").length === 25);
await pause(900);
const c = await p.evaluate(() => {
  const bs = [...document.querySelectorAll(".luciole")];
  const pos = bs.map((b) => { const r = b.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; });
  let chevauchements = 0; window.__chev = [];
  pos.forEach((a, i) => pos.forEach((b, j) => { if (i < j && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) { chevauchements++; window.__chev.push([bs[i].getAttribute("aria-label").slice(0, 25), bs[j].getAttribute("aria-label").slice(0, 25), Math.round(a.l), Math.round(a.r), Math.round(b.l), Math.round(b.r), Math.round(a.t), Math.round(b.t)]); } }));
  const min = chevauchements; // nombre de paires qui se chevauchent (0 attendu)
  const ciel = document.querySelector("#ciel").getBoundingClientRect();
  const toi = document.querySelector(".montee-toi").getBoundingClientRect();
  return {
    vue: !document.querySelector("#bloc-ciel").hidden && document.querySelector("#zones").hidden,
    labels: bs.every((b) => (b.getAttribute("aria-label") || "").length > 10),
    taille: Math.min(...pos.map((x) => Math.min(x.w, x.h))), min,
    dedans: pos.every((x) => x.x - 24 >= ciel.left - 1 && x.x + 24 <= ciel.right + 1 && x.y - 24 >= ciel.top - 1 && x.y + 24 <= ciel.bottom + 1),
    grises: bs.filter((b) => b.classList.contains("incertaine")).map((b) => b.getAttribute("aria-label")),
    chatVisible: !document.querySelector("#bloc-chat").hidden,
    noms: bs.every((b) => { const n = b.querySelector(".luciole-nom"); return n && n.offsetWidth > 0 && n.textContent.length > 2; }),
    toiVisible: toi.bottom <= innerHeight + 2 && toi.top >= 0,
    etages: [...document.querySelectorAll(".etage-titre")].map((h) => h.textContent),
    sansZoneN: ![...document.querySelectorAll(".etage")].some((e) => /Zone \d/.test(e.innerText)),
    nomsDessous: bs.every((b) => { const pt = b.querySelector(".point").getBoundingClientRect(), n = b.querySelector(".luciole-nom").getBoundingClientRect(); return n.top >= pt.bottom - 1; }),
    debordement: document.documentElement.scrollWidth > window.innerWidth,
  };
});
ok("ciel par défaut, 25 lucioles avec libellé", c.vue && c.labels);
ok("zones tactiles ≥ 48 px, aucun chevauchement", c.taille >= 48 && c.min === 0, `${Math.round(c.taille)} px de haut minimum, ${c.min} chevauchement(s) ${c.min ? JSON.stringify(await p.evaluate(() => window.__chev)) : ""}`);
const premierEcran = await p.evaluate(() => { window.scrollTo(0, 0); const r = document.querySelector("#ciel").getBoundingClientRect(); return { haut: Math.round(r.top), h: innerHeight }; });
ok("le ciel commence dans le premier écran (sans défiler)", premierEcran.haut < premierEcran.h, `haut du ciel à ${premierEcran.haut}px (écran ${premierEcran.h}px)`);
await p.evaluate(() => window.scrollTo(0, document.querySelector(".montee-toi").getBoundingClientRect().bottom + scrollY - innerHeight + 12));
ok("toutes les lucioles dans la montée, nom toujours visible", c.dedans && c.noms);
ok("5 étages titrés en clair (pas « Zone 1 »), Toi visible en bas au chargement", c.etages.length === 5 && c.sansZoneN && c.toiVisible, c.etages.join(" / "));
ok("le nom est sous chaque luciole", c.nomsDessous);
const forme = await p.evaluate(() => {
  const b = document.querySelector("#ciel .luciole"); const cs = getComputedStyle(b);
  const etage = document.querySelector(".etage").getBoundingClientRect();
  const barre = document.querySelector("#barre-rapport").getBoundingClientRect();
  return { fond: cs.backgroundColor, bord: cs.borderTopWidth, etage: Math.round(etage.width), ecran: innerWidth, barre: Math.round(barre.height),
    pastille: !!document.querySelector(".montee-toi .pastille-toi"), toiTexte: document.querySelector(".toi-texte").textContent };
});
ok("lucioles libres (pas de carte autour)", forme.fond === "rgba(0, 0, 0, 0)" && forme.bord === "0px", `${forme.fond} · bord ${forme.bord}`);
ok("étages en bandes pleine largeur", forme.etage >= forme.ecran - 2, `${forme.etage}px pour ${forme.ecran}px`);
ok("barre fine (une seule barre collée)", forme.barre <= (L >= 900 ? 72 : 124), `${forme.barre}px de haut`);
ok("cadenas en pastille au pied de la montée, nombre de métiers calculé", forme.pastille && /^25 métiers/.test(forme.toiTexte), forme.toiTexte);
ok("luciole grise = je ne sais pas", c.grises.length === 1 && /Je ne sais pas/.test(c.grises[0]), c.grises[0]);
ok("chat et recherche apparaissent après le chargement", c.chatVisible);
ok("pas de défilement horizontal", !c.debordement);
ok("après chargement : accueil de nuit arrêté", await p.evaluate(() => !document.body.classList.contains("etat-accueil")
  && getComputedStyle(document.querySelector("#lucioles-fond")).display === "none"));
await p.screenshot({ path: `${DOSSIER}/${NOM}-b-ciel.png` });
// Au milieu de la montée (étage 2), la barre doit être collée sous les barres du haut
await p.evaluate(() => document.querySelector(".etage-2").scrollIntoView({ block: "start" }));
await pause(200);
const barre = await p.evaluate(() => {
  const r = document.querySelector("#barre-rapport").getBoundingClientRect();
  const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--haut-bandeau")) || 0;
  return { haut: Math.round(r.top), attendu: Math.round(h), visible: r.bottom > 0 };
});
ok("barre fine (Changer, Ciel/Liste, filtres) collée en haut en montant", barre.visible && Math.abs(barre.haut - barre.attendu) <= 2, `haut ${barre.haut}px (bandeau ${barre.attendu}px)`);

// 3) Clavier : focus sur une luciole, flèche, Entrée -> panneau ; Échap -> retour du focus
await p.focus(".luciole");
await p.keyboard.press("ArrowRight");
const cible = await p.evaluate(() => document.activeElement.getAttribute("aria-label"));
await p.keyboard.press("Enter");
await p.waitForFunction(() => !document.querySelector("#fiche").hidden, { timeout: 5000 });
await pause(600);
const f = await p.evaluate(() => ({
  titre: document.querySelector("#fiche-titre")?.textContent,
  focus: document.activeElement?.id,
  chemin: document.querySelectorAll(".ciel-chemin").length,
  source: document.querySelector(".source-fiche a")?.href,
  badge: document.querySelector("#fiche .badge")?.textContent,
  fermer: Math.round(document.querySelector("#fermer-fiche").getBoundingClientRect().height),
}));
ok("flèche puis Entrée ouvre la fiche (panneau)", !!f.titre && cible.startsWith(f.titre), `${f.titre} · ${f.badge}`);
ok("chemin lumineux tracé vers le centre", f.chemin === 1);
ok("focus dans le panneau, bouton Fermer ≥ 48 px", f.focus === "fiche-titre" && f.fermer >= 48, `${f.fermer} px`);
ok("source cliquable (ONISEP ou France Travail)", /onisep\.fr|francetravail\.fr/.test(f.source || ""));
// Le focus reste dans le panneau (Tab plusieurs fois)
for (let i = 0; i < 12; i++) await p.keyboard.press("Tab");
ok("Tab reste dans le panneau", await p.evaluate(() => document.querySelector("#fiche").contains(document.activeElement)));
await p.screenshot({ path: `${DOSSIER}/${NOM}-c-fiche.png` });
await p.keyboard.press("Escape");
const apres = await p.evaluate(() => ({ cache: document.querySelector("#fiche").hidden, focus: document.activeElement?.getAttribute("aria-label") }));
ok("Échap ferme et rend le focus à la luciole", apres.cache && apres.focus === cible);

// 4) Duel depuis la fiche de Boulanger
await p.evaluate(() => [...document.querySelectorAll(".luciole")].find((b) => b.getAttribute("aria-label").startsWith("Boulanger")).click());
await p.waitForFunction(() => !document.querySelector("#fiche").hidden && document.querySelector("#fiche-titre")?.textContent === "Boulanger", { timeout: 5000 });
await p.evaluate(() => [...document.querySelectorAll("#fiche button")].find((b) => b.textContent.includes("Comparer")).click());
await p.waitForSelector(".choix-duel button");
await p.evaluate(() => [...document.querySelectorAll(".choix-duel button")].find((b) => b.textContent.startsWith("Fleuriste")).click());
await p.waitForSelector("table.duel");
const d = await p.evaluate(() => ({
  cols: [...document.querySelectorAll("table.duel thead th")].map((t) => t.textContent),
  criteres: [...document.querySelectorAll(".duel-critere")].map((t) => t.textContent),
  valeurs: [...document.querySelectorAll("table.duel td")].map((t) => t.textContent),
  sources: document.querySelectorAll("#fiche .source-fiche a").length,
}));
ok("duel côte à côte : niveau, durée, sans bac, formations proches",
  d.cols.join("|") === "Boulanger|Fleuriste" && d.criteres.length === 4 && d.sources === 2, d.valeurs.join(" | ").slice(0, 160));
await p.screenshot({ path: `${DOSSIER}/${NOM}-d-duel.png` });
await p.click("#fermer-fiche");

// 5) Filtres
await p.evaluate(() => document.querySelector('[data-filtre="sansbac"]').click());
await pause(300);
const sb = await p.evaluate(() => ({ info: document.querySelector("#filtre-info").textContent, hors: document.querySelectorAll(".luciole.hors-filtre").length }));
ok("filtre « Sans bac »", /sur 25/.test(sb.info) && sb.hors > 0, `${sb.info} (${sb.hors} estompées)`);
await p.evaluate(() => document.querySelector('[data-filtre="proche"]').click());
await p.waitForFunction(() => /km de Nice/.test(document.querySelector("#filtre-info").textContent), { timeout: 30000 });
ok("filtre « à moins de 30 km de Nice »", true, await p.$eval("#filtre-info", (e) => e.textContent));
await p.evaluate(() => document.querySelector('[data-filtre="tous"]').click());

// 6) Voir en liste
await p.click("#vue-liste");
ok("le clic reste sur Luciole (pas sous le bandeau)", p.url().startsWith(SITE), p.url());
const li = await p.evaluate(() => ({ liste: !document.querySelector("#zones").hidden, ciel: document.querySelector("#bloc-ciel").hidden, n: document.querySelectorAll("#zones .metiers button").length }));
ok("« Voir en liste » garde la liste", li.liste && li.ciel && li.n === 25);
await p.click("#vue-ciel");

// 7) Chat : 3 suggestions visibles, réponse courte + En savoir plus
const s = await p.evaluate(() => {
  const b = document.querySelector("#suggestions");
  return { n: b.children.length, defile: b.scrollWidth > b.clientWidth + 1, toutes: [...b.children].every((x) => x.getBoundingClientRect().height >= 48) };
});
ok("3 questions suggérées, sans défilement", s.n === 3 && !s.defile && s.toutes);
await p.$eval("#question", (e) => (e.value = "C'est quoi concrètement un urbaniste ?"));
await p.click("#form-question button");
await p.waitForFunction(() => { const m = [...document.querySelectorAll(".message.assistant")].pop(); return m && !m.textContent.includes("Je cherche"); }, { timeout: 90000 });
await pause(600);
const r = await p.evaluate(() => {
  const m = [...document.querySelectorAll(".message.assistant")].pop();
  const plus = m.querySelector(".en-savoir-plus");
  const court = m.querySelector(".reponse-courte").textContent.length;
  if (plus) plus.click();
  return { court, plus: !!plus, ouvert: plus && !m.querySelector(".reponse-plus").hidden, sources: m.querySelectorAll(".sources a").length };
});
ok("réponse courte + « En savoir plus »", r.court <= 260 && r.plus && r.ouvert && r.sources > 0, `${r.court} caractères visibles`);

// 8) Pas de jargon hors de la section Sources
const jargon = await p.evaluate(() => {
  const textes = [...document.querySelectorAll("main > :not(footer), #fiche")].map((e) => e.innerText).join(" ");
  return (textes.match(/\b(ROME|RIASEC|ODbL|open weight|Ollama)\b/gi) || []);
});
ok("pas de jargon (ROME, RIASEC, ODbL…) hors Sources", jargon.length === 0, jargon.join(", "));

// 9) Rien n'est envoyé ailleurs
const origines = new Set(p.requetes.map((u) => new URL(u).origin));
const permises = [new URL(SITE).origin, "https://orientation.code4sud.fr", "http://localhost:11434"];
const autres = [...origines].filter((o) => !permises.includes(o) && !o.startsWith("data:"));
ok("aucune requête vers un autre site", autres.length === 0, [...origines].join(" "));
ok("aucune erreur JavaScript", p.erreurs.length === 0, p.erreurs.join(" | "));
await ctx.close();

// 10) Animations réduites : la fiche s'ouvre tout de suite
{
  const { p: q, ctx: c2 } = await page(true);
  await pause(800);
  const vide = await q.evaluate(() => {
    const cv = document.querySelector("#lucioles-fond");
    return cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data.every((v, i) => i % 4 !== 3 || v === 0);
  });
  ok("prefers-reduced-motion : aucune luciole qui bouge à l'accueil", vide);
  await q.click("#essai");
  await q.waitForFunction(() => document.querySelectorAll(".luciole").length === 25);
  ok("prefers-reduced-motion : la lueur ne respire pas", await q.evaluate(() =>
    [...document.querySelectorAll(".luciole .point")].every((x) => getComputedStyle(x).animationName === "none")));
  const t0 = Date.now();
  await q.evaluate(() => document.querySelector(".luciole:not(.incertaine)").click());
  await q.waitForFunction(() => !document.querySelector("#fiche").hidden, { timeout: 3000 });
  ok("prefers-reduced-motion : ouverture immédiate", Date.now() - t0 < 250, `${Date.now() - t0} ms`);
  await c2.close();
}
console.log(lignes.join("\n"));
await browser.close();
