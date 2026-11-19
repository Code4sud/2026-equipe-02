// Normalisation et similarité des noms de métiers, côté navigateur.
// C'est la traduction EXACTE de src/similarite.py : même règle, même score.
// tests/test_similarite.py vérifie que Python et JavaScript donnent les mêmes résultats.

const MOTS_VIDES = new Set([
  "de", "du", "des", "d", "la", "le", "les", "l", "en", "et", "a", "au", "aux",
  "un", "une", "pour", "par", "sur", "dans", "ou",
]);

export function normaliser(nom) {
  if (!nom) return "";
  // Caractères invisibles venus des PDF : trait d'union conditionnel, espaces de largeur nulle
  nom = nom.replace(/[\u00ad\u200b\u200c\u200d\u2060\ufeff]/g, "");
  // NFKD : décompose aussi les ligatures (« ﬁ » -> « fi ») et l'espace insécable ; puis sans accents
  let texte = nom.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  texte = texte.replace(/œ/g, "oe").replace(/æ/g, "ae");
  const sansParentheses = texte.replace(/\([^)]*\)?/g, " ");
  // Cas d'un sigle : « ASH (Agent de service hospitalier) » -> on garde le texte entre parenthèses
  if (sansParentheses.replace(/[^a-z]/g, "").length <= 5 && texte.includes("(")) {
    texte = texte.split("(").slice(1).join("(").replace(/\)+$/, "");
  } else {
    texte = sansParentheses;
  }
  texte = texte.replace(/(\w)\/\w{1,5}\b/g, "$1"); // serveur/euse -> serveur
  texte = texte.replace(/(\w)[·•]\w{1,6}\b/g, "$1"); // boulanger·ère -> boulanger (point médian)
  if (texte.includes(" / ")) {
    const i = texte.indexOf(" / ");
    const avant = texte.slice(0, i).split(/\s+/).filter(Boolean);
    const apres = texte.slice(i + 3).split(/\s+/).filter(Boolean);
    if (avant.length && apres.length && avant[0].slice(0, 3) === apres[0].slice(0, 3)) {
      texte = avant.concat(apres.slice(avant.length)).join(" "); // masculin / féminin
    } else {
      texte = avant.join(" ") + " " + apres.join(" "); // le « / » veut dire « ou »
    }
  }
  texte = texte.replace(/[^a-z0-9]+/g, " ");
  return texte.split(" ").filter((m) => m && !MOTS_VIDES.has(m)).join(" ");
}

function bigrammes(texte) {
  const t = texte.replace(/ /g, "");
  const s = new Set();
  for (let i = 0; i < t.length - 1; i++) s.add(t.slice(i, i + 2));
  return s;
}

// Score entre deux noms DÉJÀ normalisés, de 0 à 1 (voir src/similarite.py)
export function similarite(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ba = bigrammes(a), bb = bigrammes(b);
  let communs = 0;
  for (const x of ba) if (bb.has(x)) communs++;
  let dice = ba.size && bb.size ? (2 * communs) / (ba.size + bb.size) : 0;
  let [petit, grand] = [new Set(a.split(" ")), new Set(b.split(" "))];
  if (petit.size > grand.size) [petit, grand] = [grand, petit];
  const motsCommuns = [...petit].filter((m) => grand.has(m)).length;
  if (motsCommuns === 0) dice = Math.min(dice, 0.7); // aucun mot entier en commun
  if (petit.size === 1 && grand.size > 1) dice = Math.min(dice, 0.74); // un mot seul face à un nom plus long
  const inclus = motsCommuns === petit.size ? 0.6 + (0.35 * petit.size) / grand.size : 0;
  return Math.round(Math.max(dice, inclus) * 1000) / 1000;
}
