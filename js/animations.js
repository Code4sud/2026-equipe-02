// Animations légères de Luciole, avec GSAP (vendor/gsap, copié dans le dépôt).
// Règles : le contenu est visible même sans animation (on anime DEPUIS un état proche),
// et rien ne bouge si la personne a demandé « réduire les animations » (prefers-reduced-motion).
// app.js appelle ces fonctions via window.eclaireurAnim ; si GSAP manque, rien ne casse.

(function () {
  const gsap = window.gsap;
  const calme = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const actif = () => gsap && !calme();

  window.eclaireurAnim = {
    // Le moment principal : la fiche « s'allume » comme une luciole
    ficheOuverte(el) {
      if (!actif()) return;
      gsap.fromTo(el,
        { clipPath: "inset(0 0 92% 0 round 18px)", y: 12, filter: "blur(6px)", autoAlpha: 0.4 },
        { clipPath: "inset(0 0 0% 0 round 18px)", y: 0, filter: "blur(0px)", autoAlpha: 1,
          duration: 0.7, ease: "expo.out", clearProps: "clipPath,filter,transform" });
      gsap.from(el.children, { y: 8, autoAlpha: 0, duration: 0.5, ease: "power3.out", stagger: 0.04, delay: 0.12, clearProps: "all" });
    },
    // Les métiers du rapport apparaissent zone par zone
    zonesAffichees(el) {
      if (!actif()) return;
      gsap.from(el.querySelectorAll("details.zone"), {
        y: 14, autoAlpha: 0, duration: 0.55, ease: "power3.out", stagger: 0.07, clearProps: "all",
      });
    },
    // Une bulle de chat glisse doucement
    message(el) {
      if (!actif()) return;
      gsap.from(el, { y: 8, autoAlpha: 0, duration: 0.35, ease: "power2.out", clearProps: "all" });
    },
  };

  // Apparition des blocs au chargement de la page
  document.addEventListener("DOMContentLoaded", () => {
    if (!actif()) return;
    gsap.from("header, main > .carte:not([hidden])", {
      y: 16, autoAlpha: 0, duration: 0.6, ease: "expo.out", stagger: 0.08, clearProps: "all",
    });
  });
})();
