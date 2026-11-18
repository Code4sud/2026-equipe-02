# Sources de données

Toutes les sources sont ouvertes et officielles. Chaque URL a été vérifiée le **18/11/2026** (réponse HTTP 200).
Le téléchargement se refait avec `python src/download_data.py`.

| Donnée | Producteur | Ce qu'on en garde | Licence | Version / mise à jour |
|---|---|---|---|---|
| [ROME 4.0, toutes les données (CSV)](https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/csv), page : [data.gouv.fr](https://www.data.gouv.fr/datasets/repertoire-operationnel-des-metiers-et-des-emplois-rome) | France Travail | 1 923 fiches métiers, 14 330 appellations, définition, accès au métier | Licence Ouverte 2.0 (Etalab) | v62, publiée le 19/10/2026 |
| [Idéo-Fiches métiers (XML)](https://data.onisep.fr/api/v1/downloads/5fe0808a2da6f/5fe0808a2da6f.zip), page : [data.gouv.fr](https://www.data.gouv.fr/datasets/ideo-fiches-metiers) | ONISEP | 1 138 fiches : description, journée type, accès, niveau minimum, formations, **salaire débutant** (quand l'ONISEP le publie), codes ROME | ODbL | 21/10/2026 |
| [Idéo-Formations initiales en France (CSV)](https://data.onisep.fr/api/v1/downloads/5fa591127f501/5fa591127f501.csv), page : [data.gouv.fr](https://www.data.gouv.fr/datasets/ideo-formations-initiales-en-france) | ONISEP | durée et niveau de sortie des formations citées dans les fiches métiers | ODbL | 20/10/2026 |
| [Idéo-Actions de formation Provence-Alpes-Côte d'Azur (XML Lhéo)](https://data.onisep.fr/api/v1/downloads/5fa4389e34b6a/5fa4389e34b6a.zip), page : [data.gouv.fr](https://www.data.gouv.fr/datasets/ideo-actions-de-formation-provence-alpes-cote-dazur) | ONISEP | 5 845 lieux de formation en Région Sud : établissement, ville, code postal, GPS, public / privé, durée | ODbL | 23/10/2026 |
| [Parcoursup 2025 (CSV)](https://data.enseignementsup-recherche.gouv.fr/explore/dataset/fr-esr-parcoursup/) | Ministère de l'Enseignement supérieur | sélective ou non, **taux d'accès**, nombre de places, lien vers la fiche Parcoursup | Licence Ouverte 2.0 (Etalab) | 09/03/2026 |

## Ce qui n'existe pas en données ouvertes (et ce que fait l'assistant)

* **Coût des formations** : aucune source ouverte. Le site affiche « inconnu » et le statut public / privé de l'établissement, qui n'est pas un coût.
* **Salaire** : seulement le « salaire du débutant » publié par l'ONISEP, pour 78 % des fiches. Sinon, l'assistant répond « je ne sais pas ».
* **Sélection** : seulement pour les formations post-bac présentes sur Parcoursup (672 lieux de formation en Région Sud). Les CAP et bacs pro n'y sont pas.
* **Les Carif-Oref** : le réseau publie sur data.gouv.fr le Référentiel national des certifications, mais nous n'avons pas trouvé d'export ouvert de l'offre de formation de la Région Sud (Carif-Oref PACA). Les lieux de formation viennent donc de l'ONISEP. Le site renvoie vers [intercariforef.org](https://www.intercariforef.org/formations/recherche-formations.html) par un lien, sans en extraire le contenu.
* **orientation-regionsud.fr** : consulté et cité par des liens uniquement, jamais extrait.

## Licences et obligations

* Les données dérivées de l'ONISEP (fichiers de `data/index/`) restent sous **ODbL** : on cite la source et on partage dans les mêmes conditions.
* Les données France Travail et Parcoursup sont sous **Licence Ouverte 2.0** : on cite la source et la date.
* Le code du projet est sous **MIT**.
* Chaque fiche affichée sur le site porte le nom de sa source et un lien vers la page d'origine.
