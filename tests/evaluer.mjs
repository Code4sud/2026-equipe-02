// Évaluation de l'assistant sur tests/questions.json (20 questions).
//
// Lancer :  node tests/evaluer.mjs                 (mode sans modèle)
//           node tests/evaluer.mjs --ollama        (avec qwen2.5:7b via Ollama, s'il tourne)
//           node tests/evaluer.mjs --ollama autre_fichier.json
//
// Quatre critères par question :
//   1. bon type de réponse (réponse, « je ne sais pas », comparaison, formations, refus de conseil, liste)
//   2. source citée (au moins un lien cliquable)
//   3. rien d'inventé : chaque nombre de la réponse finale existe dans la réponse tirée des fiches
//   4. mots attendus présents (ex. « bac + 5 » pour orthophoniste), et aucun mot interdit (réponse hors sujet)
// Champ facultatif « contexte » : la fiche déjà ouverte au moment de la question.
// Le contexte est celui de la démo : le rapport FICTIF est chargé (data/sample/rapport_fictif.json).

import fs from "fs";

const vraiFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith("http")) return vraiFetch(url, opts);
  const texte = fs.readFileSync(new URL("../" + String(url).replace(/^\.\//, ""), import.meta.url), "utf8");
  return { json: async () => JSON.parse(texte), text: async () => texte };
};

const args = process.argv.slice(2);
const avecOllama = args.includes("--ollama");
const fichier = args.find((a) => a.endsWith(".json")) || new URL("./questions.json", import.meta.url).pathname;

const { chargerMetiers, relier } = await import("../js/donnees.js");
const A = await import("../js/assistant.js");
await chargerMetiers(".");
await A.chargerPrompt(".");
if (avecOllama && !(await A.detecterOllama())) {
  console.log("Ollama ne répond pas : évaluation en mode sans modèle.");
}

// Contexte : le rapport fictif, relié aux référentiels comme dans le site
const fictif = JSON.parse(fs.readFileSync(new URL("../data/sample/rapport_fictif.json", import.meta.url), "utf8"));
const titresRapport = [];
for (const [z, liste] of Object.entries(fictif.zones)) for (const m of liste) titresRapport.push({ ...relier(m.titre), zone: Number(z) });

const nombres = (s) => (s.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(",", "."));

function typeObtenu(r) {
  if (r.comparaison || r.memeMetier) return "comparaison"; // « même métier » est une comparaison réussie
  if (r.formations) return "formations";
  if (r.liste) return "liste";
  if (/^Je ne peux pas te dire/.test(r.texte)) return "refus_conseil";
  if (/je ne sais pas/i.test(r.texte.slice(0, 40)) || r.inconnu) return "je_ne_sais_pas";
  return "reponse";
}

const { questions } = JSON.parse(fs.readFileSync(fichier, "utf8"));
const lignes = [];
let total = { type: 0, source: 0, invente: 0, mots: 0 };
for (const q of questions) {
  // Chaque question est posée dans une conversation neuve (pas de métier « en cours »)
  // « contexte » : la fiche déjà ouverte quand la question est posée (ex. « la formation prend combien de temps »)
  const metierOuvert = q.contexte ? relier(q.contexte).fiche : null;
  const ctx = { base: ".", titresRapport, metierCourant: metierOuvert, formations: null };
  const r = await A.repondre(q.question, ctx);
  // Référence pour « rien d'inventé » : la même réponse SANS modèle (tirée des fiches)
  const mode = A.modele.mode;
  A.modele.mode = "aucun";
  const ref = await A.repondre(q.question, { base: ".", titresRapport, metierCourant: metierOuvert, formations: ctx.formations });
  A.modele.mode = mode;
  const texteComplet = r.texte + (r.comparaison ? JSON.stringify(r.comparaison) : "");
  const refComplet = ref.texte + (ref.comparaison ? JSON.stringify(ref.comparaison) : "");

  const ok = {
    type: typeObtenu(r) === q.attendu,
    source: (r.sources || []).some((s) => s && /^https?:\/\//.test(s.url)),
    invente: nombres(texteComplet).every((n) => nombres(refComplet).includes(n)),
    // mots attendus présents, et aucun mot « hors sujet » (ex. « certificat de capacité » pour une question de durée)
    mots: (q.mots || []).every((m) => texteComplet.toLowerCase().includes(m.toLowerCase()))
      && !(q.interdits || []).some((m) => texteComplet.toLowerCase().includes(m.toLowerCase())),
  };
  for (const k of Object.keys(total)) total[k] += ok[k] ? 1 : 0;
  lignes.push({ id: q.id, attendu: q.attendu, obtenu: typeObtenu(r), ...ok, reformule: !!r.reformule, extrait: r.texte.slice(0, 90).replace(/\n/g, " ") });
}

const n = questions.length;
console.table(lignes.map((l) => ({ id: l.id, attendu: l.attendu, obtenu: l.obtenu, type: l.type ? "ok" : "X", source: l.source ? "ok" : "X", "rien inventé": l.invente ? "ok" : "X", mots: l.mots ? "ok" : "X", modèle: l.reformule ? "oui" : "" })));
for (const l of lignes.filter((x) => !(x.type && x.source && x.invente && x.mots))) console.log(`#${l.id} :`, l.extrait);
const parfait = lignes.filter((l) => l.type && l.source && l.invente && l.mots).length;
console.log(`\nMode : ${A.modele.mode === "aucun" ? "sans modèle" : A.modele.nom}`);
console.log(`Bon type de réponse : ${total.type}/${n} · Source citée : ${total.source}/${n} · Rien d'inventé : ${total.invente}/${n} · Mots attendus : ${total.mots}/${n}`);
console.log(`Questions parfaites (4 critères) : ${parfait}/${n}`);
