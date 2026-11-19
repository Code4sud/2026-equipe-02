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

## Contrôle du chargement d'un rapport

Le lecteur de PDF ne garde que les titres de métiers et leur zone : ni prénom, ni nom, ni numéro de
rendez-vous, ni date, ni adresse, ni e-mail, ni scores (intérêts, aptitudes, personnalité). Le modèle
ne reçoit jamais le texte du PDF : seulement la consigne fixe, la fiche officielle et la question.
Les titres ambigus ou non reconnus restent affichés tels quels avec « je ne sais pas ».
Ces points sont vérifiés par tests/test_chargement.mjs et tests/navigateur/test_chargement.mjs,
avec des PDF fictifs piégés (données personnelles, injection, mises en page invalides).

Coût des formations : **aucune source ouverte ne le publie**. Le site affiche « inconnu » et le statut
public / privé de l'établissement (qui n'est pas un coût).

## Liaison des métiers des Rapports des Possibles

Mesurée en local sur les titres extraits des rapports réels. Seuls les chiffres agrégés
sont publiés ici : aucun titre, aucun texte de rapport n'est dans le dépôt.

* Titres distincts : 171
* Reliés à une fiche ONISEP « sûr » : 69 (40 %)
* Reliés à une fiche ROME « sûr » : 86 (50 %)
* Reliés à au moins un référentiel « sûr » : 98 (57 %)
* Seulement « à vérifier » : 32 (19 %)
* Non reliés : 41 (24 %) → « je ne sais pas », dont 22 ambigus (plusieurs fiches de familles différentes presque à égalité : on ne choisit pas)
* Méthodes (meilleur des deux référentiels) : {'exact': 62, 'similarité': 82, 'normalisé': 27}

Vérification manuelle du 18/11/2026 : les 21 liaisons « sûr » obtenues par similarité
(ni exactes, ni normalisées) ont été relues une par une. 19 sont correctes, 2 pointent
vers une spécialité voisine du bon métier. Quelques titres sont coupés en fin de ligne
par l'extraction du PDF, ce qui fait baisser le taux de liaison.
