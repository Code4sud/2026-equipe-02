// L'assistant : comprend la question, trouve la ou les fiches, construit une réponse
// UNIQUEMENT à partir des données, avec ses sources.
// Un modèle open weight (Ollama en local, ou WebLLM dans le navigateur) peut ensuite
// REFORMULER cette réponse, sous contrôle : s'il ajoute un chiffre absent des extraits,
// on garde la réponse d'origine. Les sources sont toujours ajoutées par le code, pas par le modèle.

import { normaliser } from "./similarite.js";
import { rechercher, relier, ficheOnisepLiee, chargerFormations } from "./donnees.js";
import { formationsProches, selectionParcoursup } from "./formations.js";

export const CONSEILLER = "Tu peux en parler avec un conseiller du Centre des Possibles.";
export const LIEN_CENTRE = { nom: "Centre des Possibles", url: "https://centredespossibles.org/" };
export const LIEN_REGION = { nom: "Orientation Région Sud", url: "https://www.orientation-regionsud.fr/" };
export const LIEN_CARIF = { nom: "Carif-Oref (recherche de formations)", url: "https://www.intercariforef.org/formations/recherche-formations.html" };

// ---------- 1. Comprendre la question ----------

const INTENTIONS = [
  // L'ordre compte : la première qui correspond gagne
  ["perso", /\b(suis[- ]je|je suis (fait|faite|bon|bonne|nul|nulle)|mon profil|ma personnalite|mes resultats|mes aptitudes|quel metier (choisir|pour moi|me correspond)|dois[- ]je|tu me conseilles|que me conseilles|fait pour moi)\b/],
  ["comparer", /\b(compar\w*|differences?|lequel|plutot)\b/],
  ["cout", /\b(cout|coute|prix|cher|payant|payante|frais|gratuit|gratuite)\b/],
  ["salaire", /\b(salaire|salaires|gagne|gagner|gagnent|paye|paie|payes|remuneration|euros|smic|combien.*gagn)\b/],
  ["sans_bac", /\bsans (le |mon |un )?bac\b|\bpas (le|de|mon) bac\b|\bsans diplome\b|\bsans le brevet\b/],
  ["selection", /\b(selecti\w*|selection|difficile d.?entrer|taux|places|admis|admission|concours)\b/],
  ["pres", /\b(pres de|proche|autour de|a cote|code postal|ou (me |se )?former|ou etudier|ou faire|ecoles? (a|pres)|\d{5})\b/],
  ["diplome", /\b(diplome|diplomes|etudes|formation|formations|ecole|cursus|niveau|faut[- ]il|acceder|devenir|bac ?\+|cap|bts|but|licence|master)\b/],
  ["journee", /\b(c.?est quoi|concretement|journee|quotidien|fait quoi|consiste|en quoi|ca fait quoi|role|missions?)\b/],
];

export function intention(question) {
  const q = normaliser(question.replace(/'/g, " ")).replace(/\s+/g, " ");
  const brut = question.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [nom, re] of INTENTIONS) if (re.test(brut) || re.test(q)) return nom;
  return "general";
}

// Mots de la question qui ne désignent pas un métier
const MOTS_QUESTION = new Set(("c est quoi concretement comment combien gagne gagner salaire faut il faire " +
  "devenir etre je peux on peut sans bac diplome etudes formation formations metier metiers un une le la les " +
  "quel quelle quels quelles est ce que qu pour avec et ou pres proche debutant journee type compare comparer " +
  "entre difference selection selectif cout prix ecole niveau acceder fait quoi travail travailler me se mon ma " +
  "mes tu il elle dans du de des au aux a en par sur qui son sa ses fais bien bon beaucoup ca cela vraiment " +
  "aussi plus moins tres trop alors donc mais quand comment pourquoi peut veux voudrais aimerais apres avant " +
  "selectif selective couter coute cher paye paie payes gagnent dure combien temps annees ans region sud").split(" "));

// Trouve le métier dont parle la question (ou null). Essaie les titres du rapport en premier.
export function metierDansQuestion(question, titresRapport = []) {
  const q = normaliser(question.replace(/'/g, " "));
  // a) un titre du rapport cité dans la question
  let meilleur = null;
  for (const t of titresRapport) {
    const n = normaliser(t.titre);
    const mots = n.split(" ").filter((m) => m.length > 2);
    const presents = mots.filter((m) => q.includes(m)).length;
    if (mots.length && presents / mots.length >= 0.6 && (!meilleur || presents > meilleur.presents)) {
      meilleur = { presents, lien: t };
    }
  }
  if (meilleur && meilleur.lien.fiche) return meilleur.lien.fiche;
  // b) sinon, on enlève les mots de question et on cherche le reste dans les référentiels
  const mots = q.split(" ").filter((m) => m && !MOTS_QUESTION.has(m) && !/^\d+$/.test(m));
  if (!mots.length) return null;
  // On essaie tous les groupes de mots qui se suivent (« electricien », « electricien nice »...)
  // et on garde le meilleur score ; à score égal, le groupe le plus long.
  let r = null;
  for (let i = 0; i < mots.length; i++) {
    for (let j = i + 1; j <= Math.min(mots.length, i + 5); j++) {
      const c = rechercher(mots.slice(i, j).join(" "), 1)[0];
      if (c && (!r || c.s > r.s + 1e-9 || (Math.abs(c.s - r.s) < 1e-9 && j - i > r.n))) r = { ...c, n: j - i };
    }
  }
  return r && r.s >= 0.85 ? r.fiche : null;
}

// La question cite-t-elle un nom de métier que l'on ne connaît pas ?
// (mots restants qui ressemblent à un nom de métier : « toiletteur », « fauconnier »...)
const RE_NOM_METIER = /(eur|euse|ier|iere|iste|ien|ienne|aire|ogue|ant|ante|ste|cien|cienne|teur|trice)$/;
export function metierInconnuCite(question) {
  const mots = normaliser(question.replace(/'/g, " ")).split(" ")
    .filter((m) => m.length > 3 && !MOTS_QUESTION.has(m) && !/^\d+$/.test(m));
  return mots.find((m) => RE_NOM_METIER.test(m)) || null;
}

// Deux métiers pour une comparaison : « boulanger ou fleuriste », « entre X et Y »
export function deuxMetiers(question, titresRapport = []) {
  const q = question.replace(/^.*?(compar\w*|diff[ée]rences?|entre|plut[ôo]t)\s*/i, "");
  const morceaux = q.split(/\s+(?:et|ou|avec|vs|contre)\s+|,/i).filter((x) => x.trim());
  if (morceaux.length < 2) return null;
  const a = metierDansQuestion(morceaux[0], titresRapport);
  const b = metierDansQuestion(morceaux.slice(1).join(" "), titresRapport);
  return a && b && a.id !== b.id ? [a, b] : null;
}

// ---------- 2. Construire la réponse à partir des fiches ----------

const NIVEAUX_LISIBLES = { "3E": "fin de 3e", "sans diplôme": "sans diplôme", "diplôme national du brevet": "brevet" };
const lisible = (n) => NIVEAUX_LISIBLES[n] || n;

function couper(texte, max = 320) {
  if (!texte || texte.length <= max) return texte || "";
  const c = texte.slice(0, max);
  const fin = Math.max(c.lastIndexOf(". "), c.lastIndexOf(".\n"));
  return (fin > 80 ? c.slice(0, fin + 1) : c + "…").trim();
}

function premierParagraphe(texte, max = 320) {
  if (!texte) return "";
  // On saute les intertitres (lignes qui finissent par « : »)
  const p = texte.split("\n").find((l) => l.trim().length > 40 && !/:\s*$/.test(l)) || texte;
  return couper(p.replace(/^[^:]{0,60} : /, ""), max);
}

const src = (f) => [{ nom: f.source.nom + (f.ref === "onisep" ? ` : ${f.nom}` : ` : ${f.id} ${f.nom}`), url: f.source.url }];
// Quand on complète une fiche ROME avec la fiche ONISEP du même code, on le dit
const via = (f, g) => (g !== f ? ` (fiche ONISEP la plus proche : « ${g.nom} »)` : "");

// Fiche avec le plus d'informations : si c'est une fiche ROME liée à une seule fiche ONISEP, on prend l'ONISEP
const enrichie = (f) => ficheOnisepLiee(f) || f;

function jeNeSaisPas(raison, sources = []) {
  return { texte: `Je ne sais pas : ${raison} ${CONSEILLER}`, sources: [...sources, LIEN_CENTRE], inconnu: true, extraits: "" };
}

export function repondreDepuisDonnees(type, f, ctx = {}) {
  const nom = f && f.nom;
  switch (type) {
    case "journee": {
      const resume = f.resume ? couper(f.resume, 360) : "";
      const jour = f.journee ? premierParagraphe(f.journee, 300) : "";
      if (!resume && !jour) return jeNeSaisPas(`je n'ai pas de description pour « ${nom} ».`, src(f));
      return { texte: [resume, jour && `Au quotidien : ${jour}`].filter(Boolean).join("\n\n"), sources: src(f), extraits: [resume, jour].join("\n") };
    }
    case "salaire": {
      const g = enrichie(f);
      if (!g.salaire_debutant) {
        return jeNeSaisPas(`mes sources ne donnent pas de salaire pour « ${nom} ».`, src(f));
      }
      const t = `D'après l'ONISEP${via(f, g)}, pour un débutant ou une débutante : ${g.salaire_debutant.replace(/^A partir/, "à partir").replace(/^./, (c) => c.toLowerCase())}.`
        .replace(/\.\.$/, ".");
      return { texte: t + "\nC'est un ordre de grandeur national : le salaire varie selon l'employeur et la région.", sources: src(g), extraits: g.salaire_debutant };
    }
    case "sans_bac": {
      const g = enrichie(f);
      const acces = couper(g.acces, 300);
      const niv = g.niveau_min && lisible(g.niveau_min);
      let t;
      if (g.sans_bac === "oui") t = `Oui. D'après l'ONISEP${via(f, g)}, le niveau minimum pour être ${g.nom} est « ${niv} », c'est-à-dire avant le bac.`;
      else if (g.sans_bac === "comment") t = `Pas sans aucun diplôme : d'après l'ONISEP${via(f, g)}, le niveau minimum est « ${niv} ». Voici comment on y accède :`;
      else if (g.sans_bac === "non") t = `Non, pas directement : d'après l'ONISEP${via(f, g)}, le niveau minimum est « ${niv} », donc après le bac.`;
      else if (acces) t = `Mes sources ne donnent pas un niveau précis. Voici ce qu'elles disent de l'accès au métier :`;
      else return jeNeSaisPas(`mes sources ne disent pas quel niveau il faut pour « ${nom} ».`, src(g));
      return { texte: [t, acces].filter(Boolean).join("\n\n"), sources: src(g), extraits: [niv && `Niveau minimum : ${niv}`, acces].filter(Boolean).join("\n") };
    }
    case "diplome": {
      const g = enrichie(f);
      const niv = g.niveau_min && `Niveau minimum (ONISEP${via(f, g)}) : ${lisible(g.niveau_min)}.`;
      const liste = (g.formations || []).slice(0, 4)
        .map((x) => `• ${x.libelle}${x.duree ? ` (${x.duree})` : ""}`).join("\n");
      const acces = couper(g.acces, 280);
      if (!niv && !liste && !acces) return jeNeSaisPas(`je n'ai pas d'information sur les études pour « ${nom} ».`, src(g));
      const t = [niv, liste && `Formations possibles :\n${liste}`, acces].filter(Boolean).join("\n\n");
      return { texte: t, sources: src(g), extraits: t };
    }
    case "selection": {
      if (!ctx.formations) return null;
      const s = selectionParcoursup(enrichie(f), ctx.formations);
      if (!s) {
        return jeNeSaisPas(`je n'ai pas de chiffre de sélection pour « ${nom} » en Région Sud. ` +
          "Parcoursup ne couvre que les formations après le bac (pas les CAP ni les bacs pro).", src(f));
      }
      const t = s.min === s.max
        ? `En Région Sud, ${s.nb} formation(s) après le bac liée(s) à ce métier sont sur Parcoursup. Taux d'accès 2025 : ${s.min} %.`
        : `En Région Sud, ${s.nb} formations après le bac liées à ce métier sont sur Parcoursup. Taux d'accès 2025 : de ${s.min} % à ${s.max} % selon l'établissement.`;
      return { texte: t + "\nLe taux d'accès est la part des candidats qui ont reçu une proposition.", sources: [...src(f), { nom: s.exemple.parcoursup.source.nom, url: s.exemple.parcoursup.source.url }], extraits: t, sansModele: true };
    }
    case "cout":
      return jeNeSaisPas("aucune source ouverte ne publie le coût des formations. " +
        "Je peux seulement te dire si un établissement est public ou privé (dans « Formations près de chez moi »).", [LIEN_CARIF]);
    case "pres": {
      if (!ctx.formations) return null;
      if (!ctx.lieu) return { texte: "Dis-moi ta ville ou ton code postal (Région Sud), par exemple « près de Nice » ou « 06000 ».", sources: [], extraits: "", sansModele: true, demandeLieu: true };
      const r = formationsProches(enrichie(f), ctx.formations, ctx.lieu);
      if (!r.centre) return jeNeSaisPas(`je ne trouve pas « ${ctx.lieu} » dans mes données. Je ne connais que les formations de la Région Sud.`, [LIEN_CARIF, LIEN_REGION]);
      if (!r.liste.length) return jeNeSaisPas(`je n'ai pas trouvé de formation liée à « ${nom} » en Région Sud dans les données de l'ONISEP.`, [LIEN_CARIF, LIEN_REGION]);
      const lignes = r.liste.map((x) => {
        const sel = x.parcoursup ? ` · Parcoursup : taux d'accès ${x.parcoursup.taux_acces} %` : "";
        return `• ${x.intitule} — ${x.etablissement}, ${x.ville} (${x.km} km) · ${x.statut || "statut inconnu"}${sel} · coût : inconnu`;
      });
      return {
        texte: `Les ${r.liste.length} formations les plus proches de ${ctx.lieu} (sur ${r.total} en Région Sud) :\n${lignes.join("\n")}` +
          "\nAttention : les formations en apprentissage (CFA) ne sont pas dans ces données. Regarde aussi le Carif-Oref.",
        sources: [...new Map(r.liste.map((x) => [x.source.url, { nom: `ONISEP : ${x.intitule}`, url: x.source.url }])).values()].slice(0, 3).concat([LIEN_CARIF]),
        extraits: "", sansModele: true, formations: r.liste,
      };
    }
    default: {
      const a = repondreDepuisDonnees("journee", f);
      const b = repondreDepuisDonnees("sans_bac", f);
      return { texte: [a.inconnu ? "" : couper(f.resume, 300), b.texte].filter(Boolean).join("\n\n"), sources: src(f), extraits: [a.extraits, b.extraits].join("\n") };
    }
  }
}

export function comparer(f1, f2, formations) {
  const ligne = (f) => {
    const g = enrichie(f);
    const sel = formations && selectionParcoursup(g, formations);
    // Diplôme d'entrée : le niveau de sortie le plus bas, sans les formations complémentaires
    // (CS, MC : elles se font APRÈS un premier diplôme), puis la plus courte
    const rangNiveau = (n) => (!n ? 99 : /CAP|BEP/i.test(n) ? 0 : /^bac( ou|$)/.test(n) ? 1 : parseInt((n.match(/\+ ?(\d+)/) || [0, 9])[1]) + 1);
    const courte = (g.formations || []).filter((x) => x.duree && !/^(CS|MC|FCIL)\b/.test(x.libelle))
      .sort((a, b) => rangNiveau(a.niveau_sortie) - rangNiveau(b.niveau_sortie) || parseInt(a.duree) - parseInt(b.duree))[0];
    return {
      nom: f.nom,
      niveau: g.niveau_min ? lisible(g.niveau_min) : "inconnu",
      sansBac: { oui: "oui", non: "non", comment: "non, bac requis", inconnu: "inconnu" }[g.sans_bac || "inconnu"],
      duree: courte ? `${courte.duree} (${courte.libelle})` : "inconnu",
      salaire: g.salaire_debutant ? g.salaire_debutant.replace(/^A partir/, "À partir") : "inconnu",
      selection: sel ? (sel.min === sel.max ? `${sel.min} %` : `${sel.min} à ${sel.max} %`) + " (Parcoursup, Région Sud)" : "inconnu",
      cout: "inconnu (aucune source ouverte)",
      source: g.source,
    };
  };
  return [ligne(f1), ligne(f2)];
}

// ---------- 3. Le modèle open weight (facultatif) ----------

export const modele = { mode: "aucun", nom: null, moteur: null };
let promptSysteme = null;

export async function chargerPrompt(base = ".") {
  if (promptSysteme) return;
  promptSysteme = await (await fetch(`${base}/prompts/systeme.txt`)).text();
}

export async function detecterOllama() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    const r = await fetch("http://localhost:11434/api/tags", { signal: ctrl.signal });
    clearTimeout(t);
    const noms = (await r.json()).models.map((m) => m.name);
    const choix = ["qwen2.5:7b", "mistral:7b", "llama3.2:latest"].find((n) => noms.includes(n)) || noms[0];
    if (choix) Object.assign(modele, { mode: "ollama", nom: choix });
  } catch { /* Ollama absent : on reste sans modèle */ }
  return modele.mode === "ollama";
}

export async function activerWebLLM(progression) {
  const webllm = await import("https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm");
  const id = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
  modele.moteur = await webllm.CreateMLCEngine(id, { initProgressCallback: (p) => progression && progression(p) });
  Object.assign(modele, { mode: "webllm", nom: "Qwen 2.5 1.5B (dans le navigateur)" });
}

async function appelerModele(messages) {
  if (modele.mode === "ollama") {
    const r = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      body: JSON.stringify({ model: modele.nom, messages, stream: false, options: { temperature: 0.2 } }),
    });
    return (await r.json()).message.content;
  }
  if (modele.mode === "webllm") {
    const r = await modele.moteur.chat.completions.create({ messages, temperature: 0.2 });
    return r.choices[0].message.content;
  }
  return null;
}

// Contrôle : tous les nombres de la réponse du modèle doivent exister dans les extraits
export function nombresInventes(reponse, extraits) {
  const nombres = (s) => (s.match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(",", "."));
  const connus = new Set(nombres(extraits));
  return nombres(reponse).filter((n) => !connus.has(n));
}

export async function reformuler(question, reponse, metier) {
  if (modele.mode === "aucun" || reponse.inconnu || reponse.sansModele || !reponse.extraits) return reponse;
  // Le modèle reçoit la réponse complète déjà tirée des fiches, avec le nom du métier :
  // il ne fait que la dire plus simplement.
  const extraits = `Métier : ${metier ? metier.nom : "?"}\n${reponse.texte}`;
  try {
    const sortie = await appelerModele([
      { role: "system", content: promptSysteme },
      { role: "user", content: `EXTRAITS :\n${extraits}\n\nQUESTION DU JEUNE : ${question}` },
    ]);
    if (!sortie) return reponse;
    const inventes = nombresInventes(sortie, extraits);
    if (inventes.length) return { ...reponse, controle: `Reformulation refusée (chiffre absent des sources : ${inventes.join(", ")}).` };
    // Un « je ne sais pas » du modèle ne doit jamais effacer une réponse trouvée dans les sources
    if (/je ne sais pas/i.test(sortie)) return { ...reponse, controle: "Reformulation ignorée (le modèle n'a pas su répondre)." };
    return { ...reponse, texte: sortie.trim(), reformule: modele.nom };
  } catch {
    return reponse; // modèle indisponible : on garde la réponse directe des sources
  }
}

// ---------- 4. Point d'entrée : une question -> une réponse ----------

export async function repondre(question, ctx) {
  const type = intention(question);
  const titres = ctx.titresRapport || [];
  // Les formations (3 Mo) ne sont chargées qu'au premier besoin
  if (["pres", "selection", "comparer"].includes(type) && !ctx.formations) ctx.formations = await chargerFormations(ctx.base);

  if (type === "perso") {
    return {
      texte: "Je ne peux pas te dire quel métier est fait pour toi, ni interpréter tes résultats : tu restes l'expert de ta propre vie. " +
        "Je peux t'expliquer concrètement un métier, les études pour y arriver, ou comparer deux métiers. " + CONSEILLER,
      sources: [LIEN_CENTRE], inconnu: true,
    };
  }
  if (type === "comparer") {
    const deux = deuxMetiers(question, titres);
    if (deux) return { comparaison: comparer(deux[0], deux[1], ctx.formations), texte: `Comparaison : ${deux[0].nom} / ${deux[1].nom}`, sources: [deux[0].source, deux[1].source] };
    return { texte: "Dis-moi les deux métiers à comparer, par exemple « compare boulanger et fleuriste ».", sources: [] };
  }

  // Sans métier dans la question, on reprend le métier dont on parlait, SAUF si la question
  // ne parle ni de métier ni d'études (sinon une question hors sujet recevrait une fiche).
  const trouve = metierDansQuestion(question, titres);
  const inconnu = !trouve && metierInconnuCite(question);
  if (inconnu) {
    return jeNeSaisPas(`je ne trouve pas ce métier (« ${inconnu} ») dans les référentiels publics (ONISEP, ROME). ` +
      "Il vient peut-être d'une base étrangère et n'a pas d'équivalent exact en France.", [LIEN_REGION]);
  }
  const f = trouve || (type !== "general" ? ctx.metierCourant : null);
  if (!f) {
    if (type === "general") {
      return { texte: "Je ne peux t'aider que sur les métiers, les études et les formations. Écris le nom d'un métier, ou choisis-en un dans ton rapport.", sources: [], inconnu: true };
    }
    if (type === "cout") return repondreDepuisDonnees("cout", null);
    return jeNeSaisPas("je ne vois pas de quel métier tu parles, ou il n'est pas dans mes sources. Essaie la barre de recherche avec le nom du métier.", [LIEN_REGION]);
  }
  ctx.metierCourant = f;
  const lieu = (question.match(/\b\d{5}\b/) || [])[0] ||
    (question.match(/(?:pr[èe]s de|autour de|vers|sur|à)\s+([A-ZÀ-Ý][\w\-' ]+?)(?:\s*\?|$)/) || [])[1] || ctx.lieu;
  if (lieu && type === "pres") ctx.lieu = lieu.trim();
  const r = repondreDepuisDonnees(type, f, { ...ctx, lieu: type === "pres" ? lieu && lieu.trim() : ctx.lieu });
  return { ...(await reformuler(question, r, f)), metier: f };
}

export { relier };
