# Rapport qualité des données

Généré automatiquement par `src/link_jobs.py`. Aucun chiffre n'est saisi à la main.

## Volumes

* Fiches métiers ONISEP : 1138
* Fiches métiers ROME 4.0 : 1923

## Liaison ROME ↔ ONISEP (par code ROME, ou code parent ROME v3 publié par France Travail)

* Fiches ONISEP qui citent un code ROME : 931 (82 %)
* … dont le code existe dans le ROME 4.0 actuel : 928 (82 %)
* Codes ROME qui ont au moins une fiche ONISEP : 1622 (84 %)

## Doublons (même nom après normalisation)

* ONISEP : 4
* ROME : 0

## Valeurs manquantes (fiches ONISEP)

* Sans niveau d'accès minimum : 0 (0 %)
* Sans salaire débutant publié : 249 (22 %) → l'assistant répond « je ne sais pas » pour le salaire
* Sans description courte : 0 (0 %)
* Sans formation minimale listée : 147 (13 %)

Valeurs manquantes (fiches ROME) :

* Sans texte d'accès au métier : 0 (0 %)
* Sans définition : 0 (0 %)

Coût des formations : **aucune source ouverte ne le publie**. Le site affiche « inconnu » et le statut
public / privé de l'établissement (qui n'est pas un coût).

## Liaison des métiers des Rapports des Possibles

Mesurée en local sur les titres extraits des rapports réels. Seuls les chiffres agrégés
sont publiés ici : aucun titre, aucun texte de rapport n'est dans le dépôt.

* Titres distincts : 171
* Reliés à une fiche ONISEP « sûr » : 71 (42 %)
* Reliés à une fiche ROME « sûr » : 86 (50 %)
* Reliés à au moins un référentiel « sûr » : 99 (58 %)
* Seulement « à vérifier » : 53 (31 %)
* Non reliés : 19 (11 %) → « je ne sais pas »
* Méthodes (meilleur des deux référentiels) : {'exact': 62, 'similarité': 81, 'normalisé': 28}

Vérification manuelle du 18/11/2026 : les 21 liaisons « sûr » obtenues par similarité
(ni exactes, ni normalisées) ont été relues une par une. 19 sont correctes, 2 pointent
vers une spécialité voisine du bon métier. Quelques titres sont coupés en fin de ligne
par l'extraction du PDF, ce qui fait baisser le taux de liaison.
