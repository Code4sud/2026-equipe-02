# Tests de l'interface dans le navigateur

Ces tests pilotent Chrome (sans fenêtre) sur le site lancé en local. Ils n'utilisent que le rapport FICTIF.

```bash
python -m http.server 8000                # à la racine du dépôt, dans un autre terminal
cd tests/navigateur && npm install        # une fois (puppeteer-core, sans télécharger de navigateur)
export CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"   # si Chrome est ailleurs
node test_ciel.mjs http://localhost:8000/ 390 844 light tel     # accueil + montée + fiche + duel + chat (39 vérifications)
node test_changer.mjs http://localhost:8000/ 390 844 light      # « Changer de rapport » (14)
node audit_theme.mjs http://localhost:8000/ /tmp/audit-theme    # thème clair / sombre, bascule sur chaque écran (160)
node test_theme.mjs http://localhost:8000/                      # bouton soleil / lune (11)
node test404.mjs                                                # page 404 (4 configurations)
node test_h1.mjs http://localhost:8000/                         # titre de niveau 1 pour les lecteurs d'écran (3)
```

Remplacer `390 844 light` par `1440 900 dark` (etc.) pour les autres tailles et modes.
`audit_theme.mjs` mesure le contraste de chaque texte visible contre le fond calculé par Chrome
(même méthode que l'outil de contraste des DevTools) et enregistre une capture de chaque écran.
Les captures des autres tests vont dans le dossier `SORTIE` (par défaut, le dossier temporaire).
