// Test du bouton soleil/lune : clavier, libellé, taille, mémorisation, pas de flash, stockage bloqué.
// node test_theme.mjs <url du site>
import puppeteer from "puppeteer-core";
import os from "os";
// Navigateur : variable CHROME, sinon Chrome installé au chemin habituel de macOS
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const SITE = process.argv[2] || "http://localhost:8000/";
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true, args: ["--no-first-run"],
});
const lignes = [];
const ok = (nom, cond, detail = "") => lignes.push(`${cond ? "OK " : "ÉCHEC"} ${nom}${detail ? " — " + detail : ""}`);
const etat = (page) => page.evaluate(() => ({
  attr: document.documentElement.getAttribute("data-theme"),
  fond: getComputedStyle(document.body).backgroundColor,
  label: document.getElementById("theme").getAttribute("aria-label"),
  logo: [...document.querySelectorAll("header img.logo")].find((i) => getComputedStyle(i).display !== "none")?.getAttribute("src"),
  accueil: document.body.classList.contains("etat-accueil"),
}));
// Sur l'accueil de nuit, le logo est toujours la variante sombre ; ailleurs, celle du thème
const logoAttendu = (e, theme) => (e.accueil || theme === "dark" ? "assets/luciole-sombre.svg" : "assets/luciole.svg");
const BLANC = "rgb(255, 255, 255)", ENCRE = "rgb(29, 35, 13)";

// 1) Système clair, pas de choix : clair ; bouton au clavier -> sombre, mémorisé après rechargement
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.goto(SITE, { waitUntil: "networkidle0" });
  let e = await etat(page);
  ok("système clair, sans choix → clair", e.fond === BLANC && e.attr === null && e.logo === logoAttendu(e, "light"), `${e.fond}, logo ${e.logo}`);
  ok("libellé lecteur d'écran", e.label === "Passer en mode sombre", e.label);
  const taille = await page.$eval("#theme", (b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), r.right, r.top]; });
  ok("bouton ≥ 48 px, en haut à droite", taille[0] >= 48 && taille[1] >= 48 && taille[2] > 300, `${taille[0]}×${taille[1]} px`);
  // Atteindre le bouton au clavier (Tab) puis Entrée
  let atteint = false;
  for (let i = 0; i < 6 && !atteint; i++) { await page.keyboard.press("Tab"); atteint = await page.evaluate(() => document.activeElement?.id === "theme"); }
  ok("atteignable au clavier (Tab)", atteint);
  await page.keyboard.press("Enter");
  e = await etat(page);
  ok("Entrée → mode sombre", e.attr === "dark" && e.fond === ENCRE && e.label === "Passer en mode clair" && e.logo === logoAttendu(e, "dark"), `${e.fond}, logo ${e.logo}`);
  await page.reload({ waitUntil: "networkidle0" });
  e = await etat(page);
  ok("choix mémorisé après rechargement", e.attr === "dark" && e.fond === ENCRE);
  // 2) Pas de flash : au tout premier rendu, la couleur est déjà la bonne
  await page.evaluateOnNewDocument(() => {
    document.addEventListener("DOMContentLoaded", () => { window.__fondInitial = getComputedStyle(document.body).backgroundColor; });
  });
  await page.reload({ waitUntil: "networkidle0" });
  const initial = await page.evaluate(() => window.__fondInitial);
  ok("pas de flash (fond dès le premier rendu)", initial === ENCRE, initial);
  await page.click("#theme");
  e = await etat(page);
  ok("rebascule en clair", e.attr === "light" && e.fond === BLANC);
  await ctx.close();
}

// 3) Système sombre, sans choix : sombre ; le bouton force le clair malgré le système
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await page.goto(SITE, { waitUntil: "networkidle0" });
  let e = await etat(page);
  ok("système sombre, sans choix → sombre", e.fond === ENCRE && e.label === "Passer en mode clair");
  await page.click("#theme");
  e = await etat(page);
  ok("bouton → clair malgré le système sombre", e.fond === BLANC && e.logo === logoAttendu(e, "light"));
  await ctx.close();
}

// 4) Stockage bloqué (localStorage qui lève une erreur) : rien ne casse, la bascule marche quand même
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const erreurs = [];
  page.on("pageerror", (err) => erreurs.push(err.message));
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("stockage bloqué"); } });
  });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.goto(SITE, { waitUntil: "networkidle0" });
  await page.click("#theme");
  const e = await etat(page);
  ok("stockage bloqué : pas d'erreur, bascule OK", erreurs.length === 0 && e.fond === ENCRE, erreurs.join(" | "));
  await ctx.close();
}
console.log(lignes.join("\n"));
await browser.close();
