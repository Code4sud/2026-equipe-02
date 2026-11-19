# Pitch — Luciole (équipe 02)

*Éclaire tes possibles.* Luciole est le nom du projet ; Éclaireur est le nom de l'assistant (« Luciole, avec Éclaireur, ton assistant »).

## Le pitch en 2 minutes : « Lina, 23 h »

> **(0:00 – 0:20) Le problème.**
> Il est 23 h. Lina a 17 ans. Cet après-midi, elle était au Centre des Possibles. Elle est repartie avec son rapport : une liste de métiers, rangés en 5 zones. « Psychomotricien », « fauconnier de spectacle »… elle n'en connaît pas la moitié. Ses questions sont simples : c'est quoi concrètement ? Il faut quel diplôme ? Je peux le faire sans le bac ? Le rapport ne le dit pas. Et à 23 h, personne n'est là pour lui répondre.

> **(0:20 – 0:50) La solution.**
> Luciole, c'est un site sur son téléphone, avec Éclaireur, son assistant. Lina charge son rapport. Il est lu **sur son téléphone** : il n'est envoyé nulle part, il n'y a pas de compte. Ses métiers apparaissent par zone, avec un badge « sans bac : oui ou non ». Elle touche un métier : 4 lignes pour comprendre, le niveau minimum, le salaire d'un débutant, et la source officielle juste en dessous.

> **(0:50 – 1:20) Ce qui nous rend fiables.**
> Chaque réponse vient des données publiques : ONISEP, le ROME 4.0 de France Travail, Parcoursup. Chaque réponse cite sa source, cliquable. Et quand on ne sait pas, on le dit. Le coût d'une formation ? Aucune donnée ouverte : « je ne sais pas, parles-en à un conseiller du Centre ». C'est le code qui construit la réponse. Le modèle d'IA, open weight, ne fait que la reformuler, et s'il invente un chiffre, sa version est rejetée.

> **(1:20 – 1:45) Le plus difficile, et ce qu'on a mesuré.**
> Les métiers du rapport viennent d'une base américaine, sans code français. Nous les relions aux référentiels français par leur nom, avec un score de confiance. Sur les 20 questions types du Centre : bon type de réponse, source citée, rien d'inventé, 20 sur 20.

> **(1:45 – 2:00) La fin.**
> Éclaireur, l'assistant de Luciole, ne dit jamais à Lina ce qu'elle doit faire, et n'interprète jamais sa personnalité. Il éclaire les métiers. Le choix reste le sien, et le lendemain, elle pousse la porte du Centre avec son récap.

## Plan de la démo live (3 minutes maximum)

Avant de monter sur scène : `python3 -m http.server 8000` et `ollama serve` lancés, page ouverte sur http://localhost:8000, mode téléphone (outils de développement, 390 × 844). Le site marche sans internet (pdf.js, GSAP et les polices sont dans le dépôt).

1. **Charger le rapport** : « Essayer avec un exemple ». Montrer la phrase « Ton PDF reste sur ton appareil ». La montée apparaît : Toi en bas, 5 étages de ciel au-dessus, chaque métier est une luciole avec son nom.
2. **Ouvrir un métier** : toucher la luciole « Boulanger » (étage « En 1 à 2 ans »). Le chemin lumineux se trace jusqu'à Toi, la fiche monte du bas : badge « Sans bac : oui », salaire au début, source ONISEP cliquable.
2 bis. **Le duel** : « Comparer » avec Fleuriste : niveau, durée, sans bac, formations proches, côte à côte.
2 ter. **Les filtres** : « Sans bac », puis « Formation à moins de 30 km de Nice ». La luciole grise (toiletteur de chevaux) : « je ne sais pas ».
3. **Question sourcée** : cliquer sur « Je peux le faire sans le bac ? ». Montrer la réponse et la source en dessous.
4. **Formations proches** : « Où me former près de Nice ? ». Montrer la distance, public / privé, « coût : inconnu ».
5. **Le « je ne sais pas »** : taper « Combien gagne un toiletteur de chevaux de course ? ». Réponse : « Je ne sais pas… », avec un renvoi vers le Centre.
6. **La limite éthique** : taper « Je suis fait pour quel métier ? ». L'assistant refuse poliment de choisir à la place du jeune.
7. **Le récap** : « Garder » sur deux métiers, puis « Copier mon récap ».

Plan B si Ollama ne répond pas : rien à faire, le site passe en « mode sans IA » et les réponses restent les mêmes, tirées des fiches.

## Trame de la vidéo sans voix (1 min 30, sous-titres incrustés)

Fichier `equipe-02.mp4`, enregistrement d'écran au format téléphone, **rapport fictif uniquement**.

| Temps | À l'écran | Sous-titre |
|---|---|---|
| 0:00 – 0:06 | Page d'accueil, logo luciole | Lina, 17 ans, 23 h. Son rapport du Centre des Possibles liste des métiers inconnus. |
| 0:06 – 0:12 | Zoom sur le message de confidentialité | Son PDF est lu sur son téléphone. Rien n'est envoyé. |
| 0:12 – 0:20 | Clic « Essayer avec un rapport fictif », zones qui apparaissent | Ses métiers, rangés en 5 zones, avec un badge « sans bac ». |
| 0:20 – 0:32 | Ouverture de la fiche Boulanger | C'est quoi ? Quel niveau ? Quel salaire au début ? Avec la source officielle. |
| 0:32 – 0:45 | Question « Je peux le faire sans le bac ? », réponse | Chaque réponse vient des données publiques : ONISEP, ROME, Parcoursup. |
| 0:45 – 0:55 | « Où me former près de Nice ? » | Les formations les plus proches. Coût : inconnu, on ne l'invente pas. |
| 0:55 – 1:08 | Question sur le toiletteur de chevaux, « Je ne sais pas » | Quand il ne sait pas, il le dit, et renvoie vers un conseiller. |
| 1:08 – 1:18 | « Je suis fait pour quel métier ? », refus poli | Il n'interprète jamais la personnalité du jeune. Le choix reste le sien. |
| 1:18 – 1:30 | Récap copié, logo luciole | Luciole : éclaire tes possibles. Des sources vérifiables. Équipe 02. |

## 10 questions probables du jury

1. **D'où viennent vos informations ?**
   Uniquement des données ouvertes officielles : les fiches métiers et formations de l'ONISEP, le ROME 4.0 de France Travail et Parcoursup 2025. Les URL, licences et dates sont dans `docs/sources.md`. Chaque réponse affiche sa source.

2. **Comment évitez-vous que l'IA invente ?**
   C'est le code qui construit la réponse à partir des fiches. Le modèle ne fait que la reformuler. Deux contrôles automatiques s'appliquent : si le modèle ajoute un chiffre absent des sources, ou oublie un niveau, une durée ou un montant, on garde la réponse d'origine. Les sources sont ajoutées par le code, jamais par le modèle.

3. **Et quand l'information n'existe pas ?**
   L'assistant dit « je ne sais pas » et renvoie vers un conseiller du Centre. C'est le cas pour le coût des formations (aucune source ouverte), pour un salaire non publié par l'ONISEP (environ 22 % des fiches) et pour un métier absent des référentiels français.

4. **Comment reliez-vous les métiers du rapport aux référentiels ?**
   Ils viennent de la base américaine O*NET, sans code ROME. Nous les relions par le nom, en trois étapes : exact, normalisé, puis similarité. Chaque lien a un score de confiance, et une vérification croisée confirme le lien quand la fiche ONISEP et la fiche ROME pointent vers le même code. Sur les métiers des rapports : 57 % de liens sûrs, 19 % proches (présentés comme tels), 24 % sans lien (« je ne sais pas »), dont les titres ambigus : on ne choisit jamais une fiche au hasard.

5. **Les données personnelles du jeune ?**
   Le PDF est lu par le navigateur, sur le téléphone : rien n'est envoyé ni stocké, il n'y a pas de compte. Aucun vrai rapport n'est dans notre dépôt, notre démo ou notre vidéo : nous avons fabriqué un rapport fictif.

6. **Pourquoi un modèle open weight, et lequel ?**
   Qwen 2.5 : 7B en local via Ollama, 1,5B dans le navigateur via WebLLM. C'est un bonus du sujet, et rien n'est envoyé à une entreprise. Le site fonctionne aussi sans modèle : les réponses sont alors tirées directement des fiches.

7. **Comment avez-vous mesuré la qualité ?**
   Avec un script d'évaluation (`tests/evaluer.mjs`) sur les 20 questions types proposées par le Centre, et quatre critères : bon type de réponse, source citée, rien d'inventé, information attendue présente. Résultat : 17/20 au premier essai, puis 20/20 avec et sans modèle, après correction des défauts trouvés.

8. **Quelles sont les limites ?**
   Pas de coût des formations, et pas de formations en apprentissage dans les données ONISEP de la Région Sud. La sélection n'est connue que pour les formations après le bac (Parcoursup). Le salaire est un seul chiffre national, celui du débutant. Environ 4 métiers des rapports sur 10 ne sont pas reliés avec certitude. Nous le disons dans l'appli comme ici.

9. **L'assistant peut-il conseiller un métier au jeune ?**
   Non, volontairement. Le Centre le rappelle : les résultats sont des pistes, pas un verdict, et le jeune reste l'expert de sa propre vie. L'assistant refuse d'interpréter la personnalité ou les aptitudes. Il aide à comprendre et à comparer des métiers, et renvoie vers un conseiller.

10. **Et après le hackathon ?**
    Ajouter l'offre de formation en apprentissage (Carif-Oref) dès qu'un export ouvert existe, compléter les salaires avec une source publique par famille de métiers, et faire tester l'appli par des jeunes du Centre. Le code est sous licence MIT et tourne gratuitement sur GitHub Pages.
