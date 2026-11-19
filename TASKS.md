# Tâches

## Mercredi 18/11 : phases 0 à 3

- [x] Phase 0 : diagnostic du repo, de la doc Code4Sud et de l'environnement
- [x] Phase 1 : structure des dossiers, `.gitignore` renforcé (PDF, data_local/, .env, données brutes)
- [x] Phase 2 : requirements.txt, README.md, TASKS.md
- [x] Phase 3.1 : sources officielles trouvées, URL vérifiées, `docs/sources.md`
- [x] Phase 3.2 : nettoyage (ONISEP, ROME 4.0, formations Région Sud, Parcoursup)
- [x] Phase 3.3 : liaison des noms de métiers (exact, normalisé, similarité + vérification croisée)
- [x] Phase 3.4 : index JSON pour le navigateur (`data/index/`)
- [x] Phase 3.5 : rapport qualité chiffré (`docs/qualite.md`)
- [x] Accord de Samy pour passer à la phase 4

## Jeudi 19/11 : assistant, interface, tests

- [x] Rapport fictif (`data/sample/`) : faux profil, 25 métiers en 5 zones, faux PDF (reportlab)
- [x] Lecteur de rapport dans le navigateur (pdf.js), testé sur le faux PDF
- [x] `prompts/systeme.txt`
- [x] Chat sourcé + mode de secours sans modèle
- [x] Ollama (qwen2.5:7b) en démo locale, testé depuis Node
- [ ] WebLLM en ligne : codé (bouton), pas encore testé dans un vrai navigateur avec WebGPU
- [x] Test complet de l'interface (Chrome headless, téléphone et ordinateur, clair et sombre)
- [x] Nouveau style « lanterne du soir » + animations (GSAP dans vendor/)
- [x] Version GitHub Pages testée (navigateur propre, téléphone, mode sans IA) : 11/11, `demo` rempli
- [x] Fiche métier simple + badge sans bac
- [x] Formations proches (ville / code postal)
- [x] Comparaison de deux métiers
- [x] Récap à copier
- [x] `tests/questions.json` (20 questions) + score dans EXPLIQUER.md
- [ ] Gel de la version stable jeudi soir

- [x] Palette olive et terracotta, contrastes mesurés par tests/contrastes.py (40/40 conformes)
- [x] Page 404 autonome (src/make_404.py)
- [x] Nom de projet « Luciole » (signature « Éclaire tes possibles »), assistant « Éclaireur », logo SVG, pied de page
- [x] Mode clair sur fond blanc, bouton soleil/lune (clavier, 48 px, choix mémorisé, sans flash), 6 captures dont une en sombre
- [x] Branche « ciel » : ciel de lucioles (clavier, lecteur d'écran, 48 px, filtres), duel, fiche en panneau, interface simplifiée

## Vendredi 20/11

- [x] projet.json complet, au moins 2 captures
- [x] docs/PITCH.md
- [ ] Vidéo equipe-02.mp4 sur la clé USB avant 12h30
- [ ] Tout sur main avant 11h30, fiche vérifiée avec le lien d'aperçu

## Plus tard (si le temps le permet)

- [x] Améliorer l'extraction des titres coupés sur deux lignes dans les PDF
- [ ] Salaires : chercher une source ouverte par famille de métiers (DARES) pour compléter l'ONISEP
