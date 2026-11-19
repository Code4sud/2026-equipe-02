// Audit du thème clair / sombre, écran par écran, avec bascule EN COURS DE ROUTE.
// node audit_theme.mjs <url> <dossier captures>
// Pour chaque texte visible : contraste mesuré contre le fond calculé par Chrome (CSS.getBackgroundColors,
// la même méthode que l'outil de contraste des DevTools, dégradés compris).
import puppeteer from "puppeteer-core";
import os from "os";
// Navigateur : variable CHROME, sinon Chrome installé au chemin habituel de macOS
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
import fs from "fs";

const SITE = process.argv[2] || "http://localhost:8000/";
const SORTIE = process.argv[3];
fs.mkdirSync(SORTIE, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true, args: ["--no-first-run"],
});
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const lignes = [];
const ok = (nom, cond, detail = "") => { const l = `${cond ? "OK " : "ÉCHEC"} ${nom}${detail ? " — " + detail : ""}`; lignes.push(l); console.error(l); };

// ---- Mesure des contrastes de tous les textes visibles ----
function rgba(s) {
  const m = (s || "").match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
  return { r, g, b, a };
}
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const melange = (h, f) => ({ r: h.r * h.a + f.r * (1 - h.a), g: h.g * h.a + f.g * (1 - h.a), b: h.b * h.a + f.b * (1 - h.a), a: 1 });
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

async function contrastes(page) {
  const n = await page.evaluate(() => {
    document.querySelectorAll("[data-audit]").forEach((e) => e.removeAttribute("data-audit"));
    let i = 0;
    const visible = (e) => {
      if (e.closest(".lecteur-seul, [hidden], [aria-hidden='true'] svg")) return false;
      const cs = getComputedStyle(e);
      if (cs.visibility !== "visible" || cs.display === "none") return false;
      let x = e; while (x) { if (getComputedStyle(x).opacity === "0") return false; x = x.parentElement; }
      const r = e.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    };
    for (const e of document.querySelectorAll("body *:not(script):not(style):not(svg *)")) {
      const texte = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim().length > 1);
      if (texte && visible(e)) e.setAttribute("data-audit", String(i++));
    }
    return i;
  });
  const cdp = await page.target().createCDPSession();
  await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
  const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "[data-audit]" });
  const echecs = [];
  for (const id of nodeIds) {
    const bg = await cdp.send("CSS.getBackgroundColors", { nodeId: id }).catch(() => ({}));
    const { computedStyle } = await cdp.send("CSS.getComputedStyleForNode", { nodeId: id });
    const st = Object.fromEntries(computedStyle.map((p) => [p.name, p.value]));
    if (!bg.backgroundColors || !bg.backgroundColors.length) continue; // fond = image : non mesurable ici
    const taille = parseFloat(st["font-size"]), gras = parseInt(st["font-weight"]) >= 700;
    const mini = taille >= 24 || (gras && taille >= 18.66) ? 3 : 4.5;
    // Fond semi-transparent : on le compose sur le vrai fond de l'ancêtre (mesuré lui aussi par Chrome)
    let dessous = [{ r: 255, g: 255, b: 255, a: 1 }];
    if (bg.backgroundColors.some((b) => (rgba(b) || { a: 1 }).a < 1)) {
      const { node } = await cdp.send("DOM.describeNode", { nodeId: id });
      const idx = node.attributes[node.attributes.indexOf("data-audit") + 1];
      // On remonte jusqu'au premier ancêtre au fond opaque ou en dégradé, et on lit ses couleurs
      const fondsAncetre = await page.evaluate((i) => {
        let x = document.querySelector(`[data-audit="${i}"]`).parentElement;
        while (x && x !== document.documentElement) {
          const cs = getComputedStyle(x);
          if (cs.backgroundImage !== "none") return cs.backgroundImage.match(/rgba?\([^)]+\)/g) || [];
          if (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && !/rgba\(.*,\s*0?\.\d+\)/.test(cs.backgroundColor)) return [cs.backgroundColor];
          x = x.parentElement;
        }
        return [getComputedStyle(document.body).backgroundColor];
      }, idx);
      if (fondsAncetre.length) dessous = fondsAncetre.map(rgba).filter(Boolean);
    }
    let pire = Infinity, fondPire = "";
    for (const b of bg.backgroundColors) {
      const f = rgba(b); if (!f) continue;
      for (const d of dessous) {
      const fond = f.a < 1 ? melange(f, d.a < 1 ? melange(d, { r: 255, g: 255, b: 255, a: 1 }) : d) : f;
      const c = rgba(st.color); if (!c) continue;
      const texte = c.a < 1 ? melange(c, fond) : c;
      const k = contraste(texte, fond);
      if (k < pire) { pire = k; fondPire = b; }
      }
    }
    if (pire < mini) {
      const { node } = await cdp.send("DOM.describeNode", { nodeId: id });
      const txt = await page.evaluate((i) => { const e = document.querySelector(`[data-audit="${i}"]`); return `${e.tagName.toLowerCase()}.${(e.className || "").toString().split(" ")[0]} « ${e.textContent.trim().slice(0, 30)} »`; },
        node.attributes[node.attributes.indexOf("data-audit") + 1]);
      echecs.push(`${txt} ${pire.toFixed(2)}:1 (min ${mini}) texte ${st.color} sur ${fondPire}`);
    }
  }
  await cdp.detach();
  return { n, echecs };
}

// ---- État du thème affiché ----
const etatTheme = (page) => page.evaluate(() => {
  const attr = document.documentElement.getAttribute("data-theme");
  const sys = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const theme = attr || sys;
  const logos = [...document.querySelectorAll("img.logo-clair, img.logo-sombre")].filter((i) => i.getBoundingClientRect().width > 0 && getComputedStyle(i).display !== "none")
    .map((i) => ({ src: i.getAttribute("src"), nuit: !!i.closest("body.etat-accueil .ecran") }));
  return { theme, fond: getComputedStyle(document.body).backgroundColor, logos };
});
const FOND = { light: "rgb(255, 255, 255)", dark: "rgb(29, 35, 13)" };
function verifierTheme(nom, e, attendu) {
  const logoOk = e.logos.every((l) => l.nuit ? l.src.includes("sombre") : l.src.includes(attendu === "dark" ? "sombre" : "luciole.svg"));
  ok(`${nom} : thème ${attendu} appliqué (fond, logo)`, e.theme === attendu && e.fond === FOND[attendu] && logoOk,
    `fond ${e.fond}, logos ${e.logos.map((l) => l.src.split("/").pop()).join(",") || "aucun"}`);
}

async function auditer(page, nom, attendu, fichier) {
  await page.mouse.move(0, 0); // aucune luciole survolée pendant la mesure
  const e = await etatTheme(page);
  verifierTheme(nom, e, attendu);
  const c = await contrastes(page);
  ok(`${nom} : contrastes ≥ 4,5:1 (${c.n} textes mesurés)`, c.echecs.length === 0, c.echecs.slice(0, 4).join(" | "));
  if (fichier) await page.screenshot({ path: `${SORTIE}/${fichier}.png` });
}

// Bascule avec le bouton (ou par le système) ; vérifie que le fond change tout de suite (pas de flash / délai)
async function basculer(page, par = "bouton") {
  const avant = await etatTheme(page);
  const cible = avant.theme === "dark" ? "light" : "dark";
  if (par === "bouton") {
    await page.evaluate(() => document.getElementById("theme").click());
  } else {
    await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: cible }]);
  }
  const tout = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  return { cible, immediat: tout === FOND[cible] };
}

for (const [L, H] of [[390, 844], [1440, 900]]) {
  for (const depart of ["light", "dark"]) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: L, height: H, isMobile: L < 600 });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: depart }, { name: "prefers-reduced-motion", value: "no-preference" }]);
    await page.setRequestInterception(true);
    page.on("request", (r) => (r.url().includes("11434") ? r.abort() : r.continue()));
    const erreurs = [];
    page.on("pageerror", (e) => erreurs.push(e.message));
    const tag = `${L}x${H}-depart-${depart === "light" ? "clair" : "sombre"}`;
    const nomT = (t) => (t === "light" ? "clair" : "sombre");
    let theme = depart;
    const ecran = async (nom, slug) => {
      await pause(700); // fin des animations d'apparition (la bascule, elle, est mesurée tout de suite)
      await auditer(page, `[${tag}] ${nom} (${nomT(theme)})`, theme, `${slug}-${L}-${nomT(theme)}`);
      const b = await basculer(page, "bouton");
      ok(`[${tag}] ${nom} : bascule au bouton immédiate`, b.immediat);
      theme = b.cible;
      await auditer(page, `[${tag}] ${nom} après bascule (${nomT(theme)})`, theme, `${slug}-${L}-${nomT(theme)}`);
    };

    await page.goto(SITE, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => !document.querySelector("#etat-rapport").textContent.includes("prépare"));
    await ecran("accueil", "1-accueil");

    await page.click("#essai");
    await page.waitForFunction(() => document.querySelectorAll("#ciel .luciole").length === 25);
    await pause(300);
    await ecran("montée", "2-montee");
    // Lucioles et halos toujours visibles
    const halos = await page.evaluate(() => [...document.querySelectorAll("#ciel .luciole .point")].every((p) => { const cs = getComputedStyle(p); return cs.opacity !== "0" && cs.visibility === "visible" && p.getBoundingClientRect().width > 10; }));
    ok(`[${tag}] montée : lucioles et halos visibles (${nomT(theme)})`, halos);

    await page.click("#vue-liste");
    await ecran("liste", "3-liste");
    await page.click("#vue-ciel");

    await page.evaluate(() => [...document.querySelectorAll("#ciel .luciole")].find((b) => b.getAttribute("aria-label").startsWith("Boulanger")).click());
    await page.waitForFunction(() => !document.querySelector("#fiche").hidden);
    await ecran("fiche", "4-fiche");

    await page.evaluate(() => [...document.querySelectorAll("#fiche button")].find((b) => b.textContent.includes("Comparer")).click());
    await page.waitForSelector(".choix-duel button");
    await page.evaluate(() => [...document.querySelectorAll(".choix-duel button")].find((b) => b.textContent.startsWith("Fleuriste")).click());
    await page.waitForSelector("table.duel");
    await ecran("duel", "5-duel");
    await page.click("#fermer-fiche");

    await page.$eval("#question", (e) => (e.value = "Je peux être fleuriste sans le bac ?"));
    await page.click("#form-question button");
    await page.waitForFunction(() => [...document.querySelectorAll(".message.assistant")].some((m) => !m.textContent.includes("Je cherche")));
    await page.evaluate(() => { const m = document.querySelector(".message.assistant .en-savoir-plus"); if (m) m.click(); document.querySelector("#t-chat").scrollIntoView({ block: "start" }); });
    await ecran("chat", "6-chat");

    await page.click("#changer-rapport");
    await page.waitForFunction(() => document.querySelector("#confirmer").open);
    await auditer(page, `[${tag}] confirmation « Changer de rapport » (${nomT(theme)})`, theme, `7-confirmation-${L}-${nomT(theme)}`);
    await page.click("#confirmer-oui");
    await pause(200);

    // Bascule par le réglage du SYSTÈME, sur l'accueil retrouvé
    const s = await basculer(page, "systeme");
    theme = s.cible;
    ok(`[${tag}] réglage du système suivi immédiatement`, s.immediat);
    await auditer(page, `[${tag}] accueil après changement du système (${nomT(theme)})`, theme);
    ok(`[${tag}] aucune erreur JavaScript`, erreurs.length === 0, erreurs.join(" | "));
    await ctx.close();
  }
  // Page 404 : clair, sombre, et choix mémorisé du bouton
  for (const t of ["light", "dark"]) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: L, height: H, isMobile: L < 600 });
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: t }]);
    await page.goto(SITE + "404.html", { waitUntil: "networkidle0" });
    const fond = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    ok(`[404 ${L}] thème ${t} (système)`, fond === FOND[t], fond);
    const c = await contrastes(page);
    ok(`[404 ${L}] contrastes (${t})`, c.echecs.length === 0, c.echecs.slice(0, 3).join(" | "));
    await page.screenshot({ path: `${SORTIE}/8-404-${L}-${t === "light" ? "clair" : "sombre"}.png` });
    // Choix mémorisé contraire au système
    await page.evaluate((x) => localStorage.setItem("luciole-theme", x), t === "light" ? "dark" : "light");
    await page.reload({ waitUntil: "networkidle0" });
    const fond2 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    ok(`[404 ${L}] respecte le choix du bouton (${t === "light" ? "sombre" : "clair"})`, fond2 === FOND[t === "light" ? "dark" : "light"], fond2);
    await ctx.close();
  }
}
console.log(lignes.join("\n"));
await browser.close();
