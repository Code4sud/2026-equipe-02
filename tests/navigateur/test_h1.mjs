// Titre de niveau 1 : un seul h1 exposé aux lecteurs d'écran à l'accueil (« Luciole ») et sur la vue
// du rapport (« Luciole : tes métiers »), visuellement masqué. node test_h1.mjs <url> <capture.png>
import puppeteer from "puppeteer-core";
import os from "os";
// Navigateur : variable CHROME, sinon Chrome installé au chemin habituel de macOS
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const [SITE, CAPTURE] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true, args: ["--no-first-run"],
});
const lignes = [];
const ok = (nom, cond, detail = "") => lignes.push(`${cond ? "OK " : "ÉCHEC"} ${nom}${detail ? " — " + detail : ""}`);
const p = await browser.newPage();
await p.setViewport({ width: 390, height: 844, isMobile: true });
await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await p.goto(SITE, { waitUntil: "networkidle0" });
await p.waitForFunction(() => !document.querySelector("#etat-rapport").textContent.includes("prépare"));

// Les titres de niveau 1 tels que les voit un lecteur d'écran (arbre d'accessibilité de Chrome)
async function titres1() {
  const arbre = await p.accessibility.snapshot({ interestingOnly: true });
  const t = [];
  (function parcours(n) { if (!n) return; if (n.role === "heading" && n.level === 1) t.push(n.name); (n.children || []).forEach(parcours); })(arbre);
  return t;
}
ok("accueil : un seul titre de niveau 1 (« Luciole »)", JSON.stringify(await titres1()) === JSON.stringify(["Luciole"]), JSON.stringify(await titres1()));
await p.click("#essai");
await p.waitForFunction(() => document.querySelectorAll("#ciel .luciole").length === 25);
await new Promise((r) => setTimeout(r, 500));
const t = await titres1();
ok("rapport chargé : un seul titre de niveau 1 « Luciole : tes métiers »", JSON.stringify(t) === JSON.stringify(["Luciole : tes métiers"]), JSON.stringify(t));
const masque = await p.evaluate(() => {
  const h = [...document.querySelectorAll("h1")].find((x) => x.textContent === "Luciole : tes métiers");
  if (!h) return null;
  const r = h.getBoundingClientRect();
  return { w: r.width, h: r.height };
});
ok("le titre est visuellement masqué (1 px)", masque && masque.w <= 1 && masque.h <= 1, JSON.stringify(masque));
await p.mouse.move(0, 0);
if (CAPTURE) await p.screenshot({ path: CAPTURE });
console.log(lignes.join("\n"));
await browser.close();
