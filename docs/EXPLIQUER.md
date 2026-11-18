# Expliquer le projet (pour toute l'équipe)

Ce document permet à n'importe quel membre de l'équipe d'expliquer le projet au jury.
Il est mis à jour à chaque phase.

## En une phrase

Un assistant sur téléphone qui explique les métiers du Rapport des Possibles avec des données publiques, cite toujours sa source, et dit « je ne sais pas » quand il ne sait pas.

## Schéma d'architecture

```
          DONNÉES OUVERTES (officielles)                      PRÉPARATION (Python, une fois)
 ┌──────────────────────────────────────────┐
 │ ONISEP : fiches métiers, formations,      │     download_data.py  télécharge
 │          lieux de formation Région Sud    │ ──> clean_data.py     nettoie, enlève le HTML
 │ France Travail : ROME 4.0                 │     link_jobs.py      relie les noms de métiers
 │ Parcoursup 2025 : sélection, taux d'accès │     build_index.py    fabrique 2 fichiers JSON
 └──────────────────────────────────────────┘                │
                                                            ▼
                                   data/index/metiers.json + formations.json
                                                            │
                         SITE STATIQUE (GitHub Pages, dans le navigateur du jeune)
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │ Rapport PDF du jeune ──> lu DANS le navigateur (rien n'est envoyé)           │
 │ Recherche dans l'index (js/similarite.js) ──> fiches trouvées + sources      │
 │ 1. La réponse est construite par le code, à partir des fiches + sources.     │
 │ 2. Facultatif : un modèle open weight (Ollama en local, WebLLM en ligne)     │
 │    la reformule. Contrôles : pas de chiffre inventé, pas d'info oubliée,     │
 │    sinon on garde la réponse du code. Sans modèle, tout marche quand même.   │
 └──────────────────────────────────────────────────────────────────────────────┘
```

## Les choix et pourquoi

| Choix | Pourquoi |
|---|---|
| Données ONISEP + ROME + Parcoursup | Ce sont les référentiels publics demandés par le sujet. L'ONISEP donne en plus le niveau d'accès, les formations et un salaire débutant. |
| Site 100 % statique | Gratuit (GitHub Pages), rien à héberger, et aucune donnée du jeune ne quitte son téléphone. |
| Index JSON préparé à l'avance | Le navigateur cherche dans un fichier, sans serveur. Environ 1,2 Mo une fois compressé (métiers), 0,3 Mo (formations, chargé seulement si besoin). |
| Liaison par le nom du métier | Les métiers du rapport viennent de la base américaine O*NET, sans code ROME. Il faut donc les rapprocher par leur nom. |
| Notre propre formule de similarité | Elle est écrite deux fois, en Python et en JavaScript, et un test vérifie qu'elles donnent le même score. Le taux mesuré est donc celui du site. |
| Formations limitées à la Région Sud | Le Centre est à Nice, et le fichier reste léger sur téléphone. |
| Un modèle open weight, mais pas indispensable | Bonus du sujet, rien n'est envoyé à une entreprise. Le code construit la réponse ; le modèle ne fait que la dire plus simplement, sous contrôle. Sans modèle, le site marche quand même. |
| Bibliothèques copiées dans le dépôt (`vendor/`) | pdf.js, GSAP et les polices marchent sans internet pendant la démo. |

## Comment on relie un métier du rapport à une fiche officielle

1. **Exact** : même nom, aux majuscules près.
2. **Normalisé** : même nom une fois enlevés les accents, le féminin (« Serveur / Serveuse »), les parenthèses et les petits mots (« de », « la »...).
3. **Similarité** : on compare les paires de lettres des deux noms (score de 0 à 1), avec un bonus si tous les mots du nom court se retrouvent dans le nom long. Si les deux noms n'ont aucun mot entier en commun, le score est plafonné à 0,7, ce qui évite « charcutier » = « chaudronnier ».
4. **Vérification croisée** : si la fiche ONISEP trouvée cite le même code ROME que la fiche ROME trouvée, les deux sources se confirment.

Confiance : **sûr** (score ≥ 0,9 ou exact ou confirmé), **à vérifier** (0,75 à 0,9 : l'assistant dit « le métier le plus proche que je connais est... »), **non relié** (< 0,75 : l'assistant dit « je ne sais pas » et renvoie vers un conseiller).

## Chiffres clés (détail : docs/qualite.md)

* 1 138 fiches ONISEP, 1 923 fiches ROME 4.0, 5 845 lieux de formation en Région Sud, dont 672 avec un taux d'accès Parcoursup.
* Métiers des rapports : 58 % reliés « sûr », 31 % « à vérifier », 11 % non reliés.
* Sur 21 liaisons « sûr » par similarité relues à la main, 19 sont justes et 2 pointent vers une spécialité voisine.
* Salaire débutant publié par l'ONISEP pour 78 % des fiches. Pour les autres, l'assistant répond « je ne sais pas ».
* 84 % des codes ROME 4.0 sont reliés à au moins une fiche ONISEP, grâce au « code parent » publié par France Travail (l'ONISEP utilise encore les anciens codes).

## Score de l'assistant (phase 5, 18/11/2026)

Script : `node tests/evaluer.mjs` (ajouter `--ollama` pour tester avec le modèle). Quatre critères par question : bon type de réponse (réponse, « je ne sais pas », comparaison, formations, refus de conseil), source cliquable, rien d'inventé (chaque nombre de la réponse finale existe dans les données), mots attendus présents.

| Jeu de questions | Sans modèle | Avec qwen2.5:7b (Ollama) |
|---|---|---|
| `tests/questions.json` : 20 questions sur les métiers du rapport fictif | 20/20 | 20/20 |
| Les 20 questions proposées par le Centre (testées en local, car elles citent des métiers des vrais rapports) | 20/20 | 20/20 |

À dire honnêtement :
* Les 20 questions du rapport fictif ont été écrites après le code : ce score est optimiste. Le score qui compte est celui des 20 questions du Centre, écrites avant le code.
* Pour atteindre 20/20 sur ces questions, nous avons corrigé de vrais défauts : un mot générique seul (« directeur ») qui désignait le mauvais métier, les comparaisons « entre X et Y » et « départager », la recherche de formations pour les nouveaux codes ROME 4.0.
* Premier passage sur les questions du Centre : 17/20. Dernier : 20/20.
* Avec le modèle, une reformulation oubliait le niveau « bac + 5 ». Un contrôle dans le code refuse maintenant toute reformulation qui oublie un niveau, une durée ou un montant.
* « Je ne sais pas » bien déclenché sur : salaire non publié, coût des formations, métier absent des référentiels, question hors sujet.

## Limites (à dire honnêtement au jury)

* **Coût des formations** : aucune donnée ouverte. On affiche « inconnu » et seulement « établissement public / privé ».
* **Apprentissage** : les formations en CFA ne sont pas dans le fichier ONISEP Région Sud (depuis 2022). L'assistant le dit et renvoie vers le Carif-Oref.
* **Sélection** : connue uniquement pour les formations post-bac présentes sur Parcoursup, pas pour les CAP ni les bacs pro.
* **Salaires** : un seul chiffre (débutant), publié par l'ONISEP, sans détail par région.
* **Liaison des noms** : environ 4 métiers des rapports sur 10 ne sont pas reliés avec certitude. Certains métiers américains (O*NET) n'ont pas d'équivalent exact en France.
* **Carif-Oref** : nous n'avons pas trouvé d'export ouvert de l'offre de formation Région Sud. Les lieux viennent de l'ONISEP, et le site donne un lien vers intercariforef.org.

## Confidentialité

* Aucun Rapport des Possibles réel dans le dépôt, la démo ou la vidéo. Le `.gitignore` bloque tous les PDF et le dossier `data_local/`.
* Pour mesurer la liaison, les titres des 18 rapports ont été extraits **en local seulement** (`data_local/`, jamais commité). Seuls des chiffres agrégés sont publiés.
* Dans l'appli, le rapport du jeune est lu par son navigateur. Rien n'est envoyé ni stocké.
* L'assistant n'interprète jamais la personnalité ou les aptitudes du jeune. Il explique des métiers et des formations, c'est tout.

## Questions probables du jury (les 10 avec réponses : docs/PITCH.md)

* **D'où viennent vos chiffres ?** De sources publiques officielles, toutes listées dans docs/sources.md avec leur URL et leur date. Chaque réponse du site affiche sa source.
* **Que se passe-t-il si la donnée n'existe pas ?** L'assistant dit « je ne sais pas » et propose d'en parler à un conseiller du Centre des Possibles.
* **Comment reliez-vous les métiers du rapport ?** Par le nom, en trois étapes (exact, normalisé, similarité), avec un score de confiance et une vérification croisée ONISEP/ROME.
