# Sportifano — boutique e-commerce (GitHub Pages + Firebase Spark)

Projet configuré pour **boutique-ecommerce-2026**. Boutique `index.html`, administration `admin.html`.

## 1. Firebase Authentication

Dans Firebase → Authentication → Sign-in method, activez **Email / mot de passe** ET **Anonyme**. L'authentification anonyme permet la commande invitée ; sans cette option les commandes sans compte échouent.

Dans Authentication → Settings → Authorized domains, ajoutez `VOTRE_COMPTE.github.io` et plus tard votre domaine personnalisé, s'ils ne sont pas déjà autorisés. Ne partagez aucun mot de passe ni aucune clé de service.

## 2. Realtime Database — règles de sécurité

Firebase → Realtime Database → **Règles** : remplacez les règles par le contenu complet de `database.rules.json` et cliquez **Publier**. Faites ceci avant de rendre le site public. **Ne jamais utiliser `.read: true, .write: true` à la racine.**

La base Realtime Database existe déjà : la base Firestore n'est pas requise. Le SDK configure `databaseURL` automatiquement avec les paramètres de `firebase-config.js`.

## 3. Création de l'admin (à faire UNE SEULE FOIS)

1. Firebase → Authentication → Utilisateurs → **Ajouter un utilisateur** : créez votre compte admin email + mot de passe.
2. Copiez son **UID** exact depuis la liste des utilisateurs.
3. Firebase → Realtime Database → **Données** → cliquez sur `+` à la racine : créez le nœud `admins`. Dans `admins`, ajoutez un enfant dont **le nom est l'UID**, et **la valeur booléenne** `true` (pas la chaîne de caractères `"true"`).
4. La structure doit ressembler à :

```json
{"admins":{"VOTRE_UID_FIREBASE":"REMPLACER_CETTE_CHAINE_PAR_UN_BOOLEAN_TRUE"}}
```

**Important :** la vraie donnée est `admins/VOTRE_UID_FIREBASE = true` (type booléen). La Console Firebase possède les privilèges de propriétaire pour amorcer ce rôle. Les règles interdisent au navigateur de s'auto-attribuer le rôle admin. L'email seul ne donne jamais accès admin.

5. Ouvrez `admin.html`, connectez-vous avec le compte créé.

## 4. Publication GitHub Pages

Créez un dépôt GitHub, importez **tous les fichiers à la racine** (pas le dossier parent), puis Settings → Pages → Deploy from a branch → `main` / `(root)`.

- Boutique : `https://VOTRE_COMPTE.github.io/NOM_DU_DEPOT/`
- Admin : `https://VOTRE_COMPTE.github.io/NOM_DU_DEPOT/admin.html`

Pour un domaine Hostinger : configurez le `CNAME` du dépôt et les enregistrements DNS fournis par GitHub Pages, puis ajoutez le domaine dans Firebase Authentication → Authorized domains.

## 5. Photos sans Firebase Storage

Sur Spark, la boutique utilise **des URL d'images HTTPS**. La façon la plus simple est d'importer des images optimisées dans le dossier `assets/` sur GitHub, puis de saisir une URL absolue telle que :

`https://VOTRE_COMPTE.github.io/NOM_DU_DEPOT/assets/photo-produit.jpg`

On peut aussi utiliser un hébergeur d'images externe autorisant les liens directs. **Le formulaire Admin n'upload pas de fichiers depuis le téléphone** : pour changer les photos directement depuis Admin, il faudra ajouter ultérieurement un service d'hébergement d'images et son API sécurisée. Ne mettez pas d'images en base64 dans Realtime Database.

## 6. Fonctionnalités livrées

- Boutique responsive, bandeau, couverture, recherche, tri et catégories.
- Produits, prix, descriptions, galerie (première image utilisée dans les cartes), couleurs, tailles, stock indicatif et livraison.
- Panier dans navigateur, commande avec compte, commande invitée par auth anonyme.
- Création / connexion compte client et suivi des commandes associées à son UID.
- Admin : produits, catégories, commandes et statuts, blog, couverture, annonces.
- Paiement à la livraison uniquement. Aucun encaissement en ligne.

## 7. Limites importantes avant lancement commercial

**Ceci est une première version fonctionnelle à configurer et tester, pas une plateforme de paiement certifiée.**

- Aucune fonction serveur sur le plan Spark : les prix et stocks affichés peuvent être modifiés côté client ; l'Admin **doit vérifier** la commande avant de confirmer. Ne déclenchez pas de paiement, remise de marchandises ni facture automatique sur la base d'un total transmis par le navigateur.
- Le suivi d'un **invité** reste lié à sa session Firebase anonyme sur le même navigateur. Après effacement des données du navigateur ou changement d'appareil, l'invité ne récupère pas automatiquement la commande. Conservez le numéro de commande, et proposez l'assistance de la boutique. Un suivi par référence + OTP nécessite une brique serveur sécurisée.
- La création d’un compte depuis une session invitée utilise la liaison d’identité Firebase, ce qui conserve les commandes liées au même UID. Se connecter à un **compte préexistant** ne fusionne pas automatiquement les historiques des deux comptes.
- Firebase Realtime Database Spark a des quotas (notamment connexion simultanée, stockage et trafic). Vérifiez les quotas avant une campagne marketing majeure.
- Aucun service de livraison, facturation, SMS, paiement, galerie avec téléversement ou reporting avancé n'est connecté.
- Les pages produits et blog sont alimentées en JavaScript ; pour un référencement SEO important, un déploiement avec rendu statique serait préférable.
- Les liens externes Unsplash utilisés comme images par défaut peuvent varier ou expirer. Remplacez-les par vos images.

## 8. Tests recommandés

1. Après publication des règles et activation des fournisseurs, ouvrez Admin et publiez un produit.
2. Ouvrez boutique en navigation privée et vérifiez que le produit apparaît.
3. Passez une commande invitée ; confirmez qu'elle apparaît dans Admin.
4. Modifiez son statut et vérifiez qu'il remonte avec un compte client dans « Mes commandes ».
5. Vérifiez qu'un compte client **non Admin** ne peut pas ouvrir le tableau de bord.
6. Dans l'émulateur de règles Firebase, confirmez que le client A ne peut pas lire ni modifier la commande du client B.

## 9. Fichiers

- `index.html`, `shop.js` : boutique et client
- `admin.html`, `admin.js` : back-office
- `firebase-config.js`, `firebase.js` : connexion au projet Firebase
- `database.rules.json` : règles RTDB à publier dans la console
- `styles.css` : design responsive

Configuration Firebase Web publique, pas de clé privée. **Jamais de compte admin ou mot de passe dans les fichiers GitHub.**
