"""
Fabrique la page 404.html (servie automatiquement par GitHub Pages pour toute adresse inconnue).

Lancer :  python src/make_404.py

Pourquoi un générateur ? GitHub Pages sert 404.html à N'IMPORTE QUELLE adresse
(par exemple /2026-equipe-02/a/b/c). Un lien relatif comme « css/style.css » y serait cassé.
On met donc TOUT dans la page : le CSS, les polices (encodées en base64) et le logo.
Aucune ressource externe. Les deux boutons calculent l'adresse du site en JavaScript,
avec un lien par défaut qui marche sur GitHub Pages si JavaScript est coupé.
"""

import base64
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
POLICES = RACINE / "vendor" / "fonts"


def police_base64(nom):
    return base64.b64encode((POLICES / nom).read_bytes()).decode("ascii")


def main():
    logo = (RACINE / "assets" / "luciole.svg").read_text(encoding="utf-8")
    logo = logo.replace('role="img" aria-label="Luciole"', 'class="logo-clair" aria-hidden="true" width="88" height="88"')
    logo_sombre = (RACINE / "assets" / "luciole-sombre.svg").read_text(encoding="utf-8")
    logo_sombre = logo_sombre.replace('role="img" aria-label="Luciole"', 'class="logo-sombre" aria-hidden="true" width="88" height="88"')
    logo_favicon = base64.b64encode((RACINE / "assets" / "luciole.svg").read_bytes()).decode("ascii")

    page = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Page introuvable — Luciole</title>
<meta name="robots" content="noindex">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,{logo_favicon}">
<!-- Page générée par src/make_404.py : tout est intégré, aucune ressource externe -->
<script>
  // Même choix de thème que sur le site (bouton soleil/lune), appliqué avant l'affichage
  try {{
    var t = localStorage.getItem("luciole-theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  }} catch (e) {{}}
</script>
<style>
@font-face {{ font-family: "Young Serif"; font-weight: 400; font-display: swap;
  src: url(data:font/woff2;base64,{police_base64("young-serif-latin-400-normal.woff2")}) format("woff2"); }}
@font-face {{ font-family: "Atkinson Hyperlegible"; font-weight: 400; font-display: swap;
  src: url(data:font/woff2;base64,{police_base64("atkinson-hyperlegible-latin-400-normal.woff2")}) format("woff2"); }}
@font-face {{ font-family: "Atkinson Hyperlegible"; font-weight: 700; font-display: swap;
  src: url(data:font/woff2;base64,{police_base64("atkinson-hyperlegible-latin-700-normal.woff2")}) format("woff2"); }}
:root {{
  --fond: #ffffff; --fond-halo: #fbf1de; --surface: #f7f5ee; --texte: #232714; --doux: #4f5f26;
  --trait: #e0dccb; --action: #a9441b; --action-texte: #fbf8f0; --action-survol: #7e3012;
  --accent: #d29a3c; --focus: #4f5f26; color-scheme: light;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{ --fond: #1d230d; --fond-halo: #3b3b12; --surface: #2f3a15; --texte: #f7f0df;
    --doux: #e0d4b4; --trait: #4c5a27; --action-texte: #f7f0df; --focus: #d29a3c; color-scheme: dark; }}
}}
:root[data-theme="dark"] {{ --fond: #1d230d; --fond-halo: #3b3b12; --surface: #2f3a15; --texte: #f7f0df;
  --doux: #e0d4b4; --trait: #4c5a27; --action-texte: #f7f0df; --focus: #d29a3c; color-scheme: dark; }}
* {{ box-sizing: border-box; }}
body {{
  margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px;
  font: 700 17px/1.55 "Atkinson Hyperlegible", system-ui, sans-serif; color: var(--texte);
  background: var(--fond) radial-gradient(90% 60% at 50% 0%, var(--fond-halo) 0%, transparent 65%) no-repeat;
}}
main {{ max-width: 520px; width: 100%; text-align: center; }}
.code {{ font: 400 clamp(5rem, 28vw, 9rem)/1 "Young Serif", Georgia, serif; letter-spacing: -0.03em; margin: 8px 0 4px; }}
h1 {{ font: 400 1.6rem/1.25 "Young Serif", Georgia, serif; margin: 0 0 12px; text-wrap: balance; }}
p {{ color: var(--doux); font-weight: 400; margin: 0 auto 28px; max-width: 38ch; }}
.boutons {{ display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }}
a.bouton {{
  display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 12px 20px;
  border-radius: 999px; text-decoration: none; font-weight: 700; color: var(--texte);
  background: var(--surface); border: 1.5px solid var(--trait); transition: background-color .2s ease;
}}
a.bouton:hover {{ border-color: var(--accent); }}
a.principal {{ background: var(--action); border-color: var(--action); color: var(--action-texte); }}
a.principal:hover {{ background: var(--action-survol); border-color: var(--action-survol); }}
a:focus-visible {{ outline: 3px solid var(--focus); outline-offset: 3px; }}
.logo-sombre {{ display: none; }}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) .logo-clair {{ display: none; }}
  :root:not([data-theme="light"]) .logo-sombre {{ display: inline; }}
}}
:root[data-theme="dark"] .logo-clair {{ display: none; }}
:root[data-theme="dark"] .logo-sombre {{ display: inline; }}
.lueur {{ animation: lueur 2.4s ease-in-out infinite alternate; transform-origin: 50% 60%; }}
@keyframes lueur {{ from {{ opacity: .75; }} to {{ opacity: 1; }} }}
@media (prefers-reduced-motion: reduce) {{ .logo-sombre {{ display: none; }}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) .logo-clair {{ display: none; }}
  :root:not([data-theme="light"]) .logo-sombre {{ display: inline; }}
}}
:root[data-theme="dark"] .logo-clair {{ display: none; }}
:root[data-theme="dark"] .logo-sombre {{ display: inline; }}
.lueur {{ animation: none; }} }}
</style>
</head>
<body>
<main>
  <div class="lueur">{logo}{logo_sombre}</div>
  <div class="code" aria-hidden="true">404</div>
  <h1>Cette page est introuvable</h1>
  <p>Comme un métier dont on n'a jamais entendu parler&nbsp;: elle n'existe pas encore, ou elle a changé d'adresse. Pas de souci, on repart ensemble.</p>
  <div class="boutons">
    <a class="bouton principal" id="retour" href="/2026-equipe-02/">Retour à Luciole</a>
    <a class="bouton" id="question" href="/2026-equipe-02/#t-chat">Poser une question</a>
  </div>
</main>
<script>
  // Adresse du site : /2026-equipe-02/ sur GitHub Pages, / en local
  function baseDuSite(chemin) {{
    var m = chemin.match(/^\\/2026-equipe-02(\\/|$)/);
    return m ? "/2026-equipe-02/" : "/";
  }}
  var base = baseDuSite(window.location.pathname);
  document.getElementById("retour").href = base;
  document.getElementById("question").href = base + "#t-chat";
</script>
</body>
</html>
"""
    (RACINE / "404.html").write_text(page, encoding="utf-8")
    print(f"404.html : {len(page) / 1024:.0f} Ko")


if __name__ == "__main__":
    main()
