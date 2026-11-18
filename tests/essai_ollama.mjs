// Essai de la reformulation par Ollama (qwen2.5:7b doit tourner) : node tests/essai_ollama.mjs "question"
import fs from "fs";
const vraiFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith("http")) return vraiFetch(url, opts);
  const texte = fs.readFileSync(new URL("../" + String(url).replace(/^\.\//, ""), import.meta.url), "utf8");
  return { json: async () => JSON.parse(texte), text: async () => texte };
};
const { chargerMetiers } = await import("../js/donnees.js");
const { repondre, chargerPrompt, detecterOllama, modele } = await import("../js/assistant.js");
await chargerMetiers("."); await chargerPrompt(".");
console.log("Ollama :", await detecterOllama(), modele.nom);
const ctx = { base: ".", titresRapport: [] };
for (const q of process.argv.slice(2)) {
  const t0 = Date.now();
  const r = await repondre(q, ctx);
  console.log(`\nQ: ${q}\nR (${((Date.now() - t0) / 1000).toFixed(1)} s, ${r.reformule ? "reformulé" : "direct"}): ${r.texte}${r.controle ? "\n" + r.controle : ""}`);
}
