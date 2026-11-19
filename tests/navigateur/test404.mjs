// Test de la page 404 : téléphone/ordinateur, clair/sombre, aucune requête externe, liens selon le chemin.
import puppeteer from "puppeteer-core";
import os from "os";
// Navigateur : variable CHROME, sinon Chrome installé au chemin habituel de macOS
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const DOSSIER = process.env.SORTIE || os.tmpdir();
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true, args: ["--no-first-run"],
});
for (const [l, h, theme, nom] of [[390, 844, "light", "tel-clair"], [390, 844, "dark", "tel-sombre"], [1440, 900, "light", "pc-clair"], [1440, 900, "dark", "pc-sombre"]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: l, height: h, isMobile: l < 600 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: theme }]);
  const requetes = [];
  page.on("request", (r) => requetes.push(r.url()));
  await page.goto("http://localhost:8000/404.html", { waitUntil: "networkidle0" });
  const info = await page.evaluate(() => ({
    titre: document.querySelector("h1").textContent,
    retour: document.getElementById("retour").getAttribute("href"),
    police: getComputedStyle(document.querySelector(".code")).fontFamily,
    policeChargee: document.fonts.check('400 40px "Young Serif"'),
    debordement: document.documentElement.scrollWidth > window.innerWidth,
    bases: ["/2026-equipe-02/a/b/c", "/2026-equipe-02", "/n/importe/quoi", "/404.html"].map((p) => baseDuSite(p)),
  }));
  const externes = requetes.filter((u) => !u.startsWith("http://localhost:8000/404.html") && !u.startsWith("data:"));
  console.log(nom, "|", info.titre, "| retour", info.retour, "| police OK", info.policeChargee, "| débordement", info.debordement,
    "| requêtes externes", externes.length ? externes : "aucune", "| bases", info.bases.join(" "));
  await page.screenshot({ path: `${DOSSIER}/404-${nom}.png` });
  await page.close();
}
await browser.close();
