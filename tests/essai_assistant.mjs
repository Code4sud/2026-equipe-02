// Essai rapide de l'assistant dans Node (sans navigateur) : node tests/essai_assistant.mjs "question"
import fs from "fs";
globalThis.fetch = async (url) => {
  if (String(url).startsWith("http")) throw new Error("pas de réseau dans l'essai");
  const texte = fs.readFileSync(new URL("../" + String(url).replace(/^\.\//, ""), import.meta.url), "utf8");
  return { json: async () => JSON.parse(texte), text: async () => texte };
};
const { chargerMetiers, relier } = await import("../js/donnees.js");
const { repondre, chargerPrompt } = await import("../js/assistant.js");
await chargerMetiers(".");
await chargerPrompt(".");
const ctx = { base: ".", titresRapport: [] };
for (const q of process.argv.slice(2)) {
  const r = await repondre(q, ctx);
  console.log("\nQ:", q, "\nR:", r.texte, r.comparaison ? JSON.stringify(r.comparaison, null, 1) : "", "\nSources:", (r.sources || []).map((s) => s.url).join(" "));
}
