# Équipe 02 — Hackathon Azuréen #3

Projet réalisé à Nice les 18, 19 et 20 novembre 2026, sur le thème **« L'orientation et l'employabilité grâce à l'IA »**, organisé par [Code4Sud](https://code4sud.fr). Sujet 2 : assistant IA d'exploration des métiers.

**Luciole** — *Éclaire tes possibles*. Luciole, avec Éclaireur, ton assistant. (Luciole est le nom du projet, pas une entreprise.)

## Le projet

Après le Centre des Possibles, un jeune repart avec une liste de métiers dont il n'a jamais entendu parler, et personne n'est là à 23 h pour lui dire ce que c'est, quel diplôme il faut, ou s'il peut le faire sans le bac. Luciole et son assistant Éclaireur répondent à ces questions en phrases courtes, **uniquement à partir des données publiques** (ONISEP, ROME 4.0 de France Travail, Parcoursup), citent la source sous chaque réponse et disent « je ne sais pas » quand la donnée n'existe pas. Le site fonctionne sur téléphone, sans compte, et le rapport du jeune est lu dans son navigateur : rien n'est envoyé nulle part.

## Lancer le projet

```bash
pip install -r requirements.txt                 # Python 3.10+
python src/download_data.py && cd src && python clean_data.py && python link_jobs.py && python build_index.py && cd ..
python -m http.server 8000                       # puis ouvrir http://localhost:8000
```

**IA locale facultative.** Le site marche sans IA : les réponses viennent directement des fiches officielles, et c'est ainsi que fonctionne le site en ligne.
Pour que les réponses soient reformulées plus simplement, installe [Ollama](https://ollama.com) puis lance `ollama pull qwen2.5:7b`.
Le site détecte alors le modèle tout seul sur `localhost:11434`, seulement quand tu l'ouvres en local (`http://localhost:8000`).

## Architecture

```
Données ouvertes ──> src/download_data.py ──> data/raw/        (non versionné)
                     src/clean_data.py    ──> data/processed/  (non versionné)
                     src/link_jobs.py     ──> liaison des noms de métiers + docs/qualite.md
                     src/build_index.py   ──> data/index/*.json (chargé par le site)
Site statique (index.html + js/) : recherche dans l'index, fiches, chat sourcé
404.html (générée par src/make_404.py) : page autonome, tout est intégré
```

Explications détaillées pour le jury : [docs/EXPLIQUER.md](docs/EXPLIQUER.md). Avancement : [TASKS.md](TASKS.md).

## Sources et licences

Détail, URL et dates : [docs/sources.md](docs/sources.md). Qualité des données : [docs/qualite.md](docs/qualite.md).

* ONISEP (Idéo-Fiches métiers, Idéo-Formations, Idéo-Actions de formation Région Sud) : ODbL
* France Travail, ROME 4.0 : Licence Ouverte 2.0
* Parcoursup 2025 (ministère de l'Enseignement supérieur) : Licence Ouverte 2.0

Bibliothèques copiées dans `vendor/` pour une démo sans internet : pdf.js 4.0.379 (Apache 2.0), GSAP 3.13.0 (licence standard gratuite), polices Young Serif et Atkinson Hyperlegible (OFL). Détail et copyrights : [vendor/README.md](vendor/README.md).

Les fichiers de `data/index/` dérivés de l'ONISEP restent sous ODbL. Aucun Rapport des Possibles réel n'est dans ce dépôt : les tests et la démo utilisent un rapport fictif.

## Équipe

Équipe 02, étudiants d'Aivancity et de Centrale Méditerranée.

## Licence

Code sous MIT, voir `LICENSE`.
