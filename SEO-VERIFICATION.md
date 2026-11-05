# Vérification SEO et domaine — Sportifano

## Important avant de fusionner cette branche

Ce changement propose de restaurer le CNAME `sportifano.com` conformément au domaine indiqué dans README.md. **Vérifier que ce domaine doit réellement pointer vers ce dépôt GitHub Pages et que les DNS Hostinger pointent sur GitHub Pages avant de fusionner.** Le domaine public et la version du dépôt semblent actuellement présenter un contenu différent dans certaines données des moteurs de recherche (potentiellement anciennes). Ne pas présumer que les deux correspondent sans tester.

1. GitHub → dépôt `-Sportifano` → Settings → Pages : source `main`, racine `/`, domaine personnalisé `sportifano.com`, Enforce HTTPS. Vérifier le statut de déploiement.
2. Hostinger → zone DNS : vérifier les enregistrements A pour le domaine racine et le CNAME `www` suivant les valeurs officielles GitHub Pages. Ne modifier aucun DNS tant que les paramètres actuels et les éventuels autres hébergements n'ont pas été contrôlés.
3. Après mise en ligne, contrôler `https://sportifano.com/`, `https://www.sportifano.com/`, le code source, `https://sportifano.com/robots.txt` et `https://sportifano.com/sitemap.xml`. Une seule variante canonique doit être retenue, avec redirection HTTPS cohérente.
4. Dans Google Search Console, vérifier la propriété du domaine, inspecter l'URL canonique, demander l'indexation de la page d'accueil et soumettre `https://sportifano.com/sitemap.xml`.
5. Examiner **Pages → Indexation** et **Performances → Résultats de recherche** pour distinguer absence d'indexation et manque de classement. Aucun résultat SEO immédiat ou première place n'est garanti.
6. Actuellement les produits sont rendus depuis Firebase côté navigateur, et seuls les titres généraux figurent dans le HTML initial. Pour cibler les recherches produits/catégories, envisager ensuite des pages HTML indexables par catégorie et produit, générées ou synchronisées côté build, avec URL stable et contenu original. Ce correctif ne rend pas les produits indexables individuellement.
7. Vérifier également que `/admin.html` n'est pas indexé et que l'interface d'administration exige toujours l'authentification ; `noindex` ne remplace pas la sécurité.

## Inclus dans la branche

- Amélioration du titre, de la meta description, des métadonnées sociales et de la canonical de la page d'accueil.
- Ajout de `robots.txt` et d'un `sitemap.xml` limité à la seule page d'accueil actuellement indexable.
- Proposition de restauration de `CNAME` pour `sportifano.com`.
- Balise `noindex` sur la page admin (sans modifier l'authentification ou Firebase).

**Aucun fichier Firebase, règle de base de données, script de commande, panier ou CSS n'est modifié.**
