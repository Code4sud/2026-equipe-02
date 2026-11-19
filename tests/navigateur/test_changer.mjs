// Test « Changer de rapport » : node test_changer.mjs <url> <largeur> <hauteur> <light|dark>
import puppeteer from "puppeteer-core";
import os from "os";
// Navigateur : variable CHROME, sinon Chrome installé au chemin habituel de macOS
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const [SITE, L, H, THEME] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4]), process.argv[5]];
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true, args: ["--no-first-run"],
});
const lignes = [];
const ok = (nom, cond, detail = "") => { const l = `${cond ? "OK " : "ÉCHEC"} ${nom}${detail ? " — " + detail : ""}`; lignes.push(l); console.error(l); };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const p = await (await browser.createBrowserContext()).newPage();
await p.setViewport({ width: L, height: H, isMobile: L < 600 });
await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: THEME }, { name: "prefers-reduced-motion", value: "reduce" }]);
await p.setRequestInterception(true);
p.on("request", (r) => (r.url().includes("11434") ? r.abort() : r.continue()));
const erreurs = [];
p.on("pageerror", (e) => erreurs.push(e.message));
let navigations = 0;
p.on("framenavigated", (f) => { if (f === p.mainFrame()) navigations++; });
await p.goto(SITE, { waitUntil: "networkidle0" });
await p.waitForFunction(() => !document.querySelector("#etat-rapport").textContent.includes("prépare"));
await p.evaluate(() => (window.__marqueur = "même page"));
const navDebut = navigations;

const charger = async () => {
  await p.click("#essai");
  await p.waitForFunction(() => document.querySelectorAll("#ciel .luciole").length === 25);
};
const etatAccueil = () => p.evaluate(() => ({
  accueil: document.body.classList.contains("etat-accueil") && !document.querySelector("#accueil").hidden,
  caches: ["#vue-rapport", "#bloc-chat", "#bloc-recherche", "#bloc-recap"].every((s) => document.querySelector(s).hidden),
  vide: !document.querySelector("#ciel").children.length && !document.querySelector("#zones").children.length
    && !document.querySelector("#fil").children.length && document.querySelector("#recherche").value === "",
  filtre: document.querySelector('.filtres [aria-pressed="true"]')?.dataset.filtre,
  panneau: document.querySelector("#fiche").hidden,
  focus: document.activeElement?.id,
  memePage: window.__marqueur === "même page",
}));
const verifierAccueil = async (nom) => {
  const e = await etatAccueil();
  ok(nom, e.accueil && e.caches && e.vide && e.filtre === "tous" && e.panneau && e.focus === "t-accueil" && e.memePage,
    JSON.stringify(e));
};

// 1) Depuis la liste, avec un filtre actif et sans conversation : pas de confirmation
await charger();
const bouton = await p.evaluate(() => {
  const b = document.querySelector("#changer-rapport"); const r = b.getBoundingClientRect();
  return { label: b.getAttribute("aria-label"), h: Math.round(r.height), visible: r.top >= 0 && r.bottom <= innerHeight };
});
ok("bouton visible en haut, libellé, ≥ 48 px", bouton.visible && /Changer de rapport/.test(bouton.label) && bouton.h >= 48, `${bouton.h}px · « ${bouton.label} »`);
await p.click("#vue-liste");
await p.evaluate(() => document.querySelector('[data-filtre="sansbac"]').click());
await pause(200);
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); // tout en bas de la page
await pause(200);
const enBas = await p.evaluate(() => { const r = document.querySelector("#changer-rapport").getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
ok("toujours visible même en bas de la page (barre collée)", enBas);
await p.focus("#changer-rapport");
await p.keyboard.press("Enter");                 // au clavier
await pause(300);
ok("pas de confirmation sans conversation", await p.evaluate(() => !document.querySelector("#confirmer").open));
await verifierAccueil("depuis la liste (clavier) : retour à l'accueil, état vidé");

// 2) Depuis une fiche ouverte, avec une conversation : confirmation, « Non » puis « Oui »
await charger();
await p.$eval("#question", (e) => (e.value = "Je peux être boulanger sans le bac ?"));
await p.click("#form-question button");
await p.waitForFunction(() => [...document.querySelectorAll(".message.assistant")].some((m) => !m.textContent.includes("Je cherche")));
await p.evaluate(() => [...document.querySelectorAll("#ciel .luciole")].find((b) => b.getAttribute("aria-label").startsWith("Boulanger")).click());
await p.waitForFunction(() => !document.querySelector("#fiche").hidden);
await p.click("#changer-rapport-fiche");
await pause(200);
const dlg = await p.evaluate(() => ({ ouvert: document.querySelector("#confirmer").open, texte: document.querySelector("#confirmer").innerText, focus: document.activeElement?.id }));
ok("conversation en cours : confirmation légère", dlg.ouvert && /Tu veux vraiment changer de rapport \?/.test(dlg.texte) && /Ta conversation sera effacée\./.test(dlg.texte) && dlg.focus === "confirmer-non");
await p.click("#confirmer-non");
await pause(200);
ok("« Non, rester » : rien n'est perdu", await p.evaluate(() => !document.querySelector("#confirmer").open && !document.body.classList.contains("etat-accueil")
  && document.querySelectorAll("#fil .message").length >= 2 && !document.querySelector("#fiche").hidden));
await p.click("#changer-rapport-fiche");
await pause(150);
await p.keyboard.press("Escape");               // Échap = non
await pause(150);
ok("Échap ferme la confirmation sans rien effacer", await p.evaluate(() => !document.querySelector("#confirmer").open && document.querySelectorAll("#fil .message").length >= 2));
await p.click("#changer-rapport-fiche");
await pause(150);
await p.click("#confirmer-oui");
await pause(300);
await verifierAccueil("depuis la fiche, après « Oui, changer »");

// 3) Depuis le duel
await charger();
await p.evaluate(() => [...document.querySelectorAll("#ciel .luciole")].find((b) => b.getAttribute("aria-label").startsWith("Boulanger")).click());
await p.waitForFunction(() => !document.querySelector("#fiche").hidden);
await p.evaluate(() => [...document.querySelectorAll("#fiche button")].find((b) => b.textContent.includes("Comparer")).click());
await p.waitForSelector(".choix-duel button");
await p.evaluate(() => [...document.querySelectorAll(".choix-duel button")].find((b) => b.textContent.startsWith("Fleuriste")).click());
await p.waitForSelector("table.duel");
await p.click("#changer-rapport-fiche");
await pause(300);
await verifierAccueil("depuis le duel (sans conversation)");

// 4) Par le logo
await charger();
const logo = await p.$eval("#logo-accueil", (b) => b.getAttribute("aria-label"));
await p.click("#logo-accueil");
await pause(300);
ok("logo : libellé pour lecteur d'écran", /revenir à l'accueil/.test(logo), logo);
await verifierAccueil("par le logo");

// 5) On peut recharger un rapport ensuite, sans rechargement de page
await charger();
ok("nouveau rapport chargé après retour (25 métiers, même page)", await p.evaluate(() => document.querySelectorAll("#ciel .luciole").length === 25 && window.__marqueur === "même page"));
ok("aucun rechargement de page", navigations === navDebut, `${navigations - navDebut} navigation(s)`);
ok("aucune erreur JavaScript", erreurs.length === 0, erreurs.join(" | "));
console.log(lignes.join("\n"));
await browser.close();
