# SPORTIFANO SPORT PRO — guide installation (Firebase Spark gratuit)

## IMPORTANT : NE SUPPRIMEZ PAS L'ANCIEN REPOSITORY

Conservez `boumiza-1/-Sportifano` et son domaine. **Ne supprimez ni le repository, ni la base Firebase, ni les commandes existantes**. Faites une sauvegarde du repository et exportez les données de Firebase avant mise à jour. Le nouveau ZIP remplace les fichiers du site à la racine du même repository. Le fichier `CNAME` contient `sportifano.com` pour conserver le domaine personnalisé ; vérifiez sa valeur si votre configuration GitHub diffère.

## 1. Contenu du ZIP

- `index.html` + `styles.css` : nouvelle boutique sport responsive, barre mobile, sections sport, catalogue et promotions.
- `shop.js` : affichage en temps réel des produits, choix de couleur/taille, panier, commande invitée ou avec compte, historique client.
- `admin.html` + `admin.js` : login Admin, tableau de bord, ajout/modification/suppression des produits, catégories, promotions par ancien prix, blog, titres/bannières, commandes et leur statut.
- `firebase-config.js`, `firebase.js` : configuration du projet `boutique-ecommerce-2026`.
- `database.rules.json` : règles de Realtime Database à vérifier et publier.
- `CNAME` : domaine GitHub Pages.

## 2. Mettre le site à jour sur GitHub

1. Téléchargez **d'abord** une copie de votre dépôt GitHub actuel (Code → Download ZIP).
2. Décompressez cette archive.
3. Ouvrez votre dépôt `https://github.com/boumiza-1/-Sportifano` et faites **Add file → Upload files**.
4. Glissez **les fichiers à l'intérieur** du dossier extrait, pas le fichier ZIP ni le dossier parent. Remplacez les fichiers de même nom, puis **Commit changes** sur `main`.
5. Si l'interface GitHub refuse une écriture en lot, remplacez les fichiers via un clone Git local ou GitHub Desktop ; ne supprimez pas le dépôt.
6. Attendez la fin de Actions/Pages, puis ouvrez `https://sportifano.com/` et `https://sportifano.com/admin.html` avec Ctrl+Shift+R.

## 3. Firebase : configurer l'authentification et la base

1. Firebase Console → projet `boutique-ecommerce-2026` → Authentication → Sign-in method : activez **E-mail / mot de passe** et **Anonyme**. L'accès anonyme est nécessaire aux commandes sans compte.
2. Authentication → Settings → Authorized domains : ajoutez `sportifano.com` et `boumiza-1.github.io` si absents. Pour `www.sportifano.com`, ajoutez-le aussi s'il est utilisé.
3. Firebase → Realtime Database → Rules : publiez le contenu de `database.rules.json` (après vérification et idéalement test dans Rules Playground). **Ne publiez jamais une règle `.read: true, .write: true` à la racine.**
4. Firebase → Authentication → Users → Add user. Créez votre email et mot de passe administrateur. **Ne les mettez jamais dans GitHub ni dans ce chat.**
5. Copiez l'UID exact de ce compte. Realtime Database → Data : créez `admins/<UID>` avec la valeur **booléenne** `true` (pas la chaîne "true"). La création de ce rôle doit se faire dans la Console propriétaire, pas depuis le site.
6. Connectez-vous sur `/admin.html`. Si vous recevez « le compte n'a pas le rôle administrateur », vérifiez UID et type booléen. Les produits et commandes s'affichent une fois le rôle confirmé.

## 4. Mode d'emploi Admin

- **Produits → Ajouter un produit** : renseignez nom, prix en DT, ancien prix facultatif, description, stock indicatif, couleurs séparées par virgules (Noir, Blanc...), tailles séparées par virgules (S, M, L...), informations livraison, catégorie, visibilité et **une URL d'image HTTPS par ligne**. Cliquez Enregistrer ; la boutique se met à jour via Firebase. Pour les articles sans taille, laissez le champ vide.
- **Catégories → Nouvelle catégorie** : nommez et enregistrez. Affectez ensuite la catégorie à un produit.
- **Commandes** : une commande de client, même invité, apparaît dans la section **Commandes** en statut `nouvelle` si les règles et le fournisseur Anonyme sont activés. Cliquez sa référence pour voir numéro client, adresse, contenu et changer le statut : `nouvelle`, `confirmée`, `préparation`, `expédiée`, `livrée`, `annulée`. Les comptes clients peuvent retrouver leur statut.
- **Blog** : ajoutez le titre, texte et URL d'image.
- **Couverture & annonces** : changez le titre de la bannière, le texte, l'URL de photo, le bandeau d'information.
- **Suppression** : entrez dans « Modifier » puis Supprimer (confirmation).

**Photos :** ce projet Spark n'inclut PAS de transfert direct de fichiers du téléphone/PC vers un hébergeur. Il accepte des liens HTTPS et `./assets/...`; les images peuvent être téléversées dans GitHub `assets/` séparément. Ne stockez pas les images en base64 dans Firebase Realtime Database.

## 5. Fonctionnement et limites à connaître

- Une **commande sans compte** utilise Firebase Anonymous Authentication. Après suppression de la session navigateur, le visiteur ne peut plus consulter son historique invité. Un client inscrit peut consulter ses commandes associées à son UID.
- **Paiement à la livraison seulement** ; aucune intégration de paiement en ligne, SMS ou transporteur n'est fournie.
- **Pas de backend de vérification des prix/stock** sur ce site statique. Une personne pourrait soumettre un panier manipulé. L'Admin doit **recalculer** les prix, disponibilité, livraison et remise manuellement avant de confirmer ou facturer. Ne considérez pas le montant côté navigateur comme fiable.
- Le quota Spark Firebase limite l'usage ; ceci n'est pas un équivalent complet de SHEIN/TEMU ni une infrastructure grand trafic.
- Les 4 photos de disciplines et la photo de couverture sont des URLs d'illustration externes et peuvent cesser de fonctionner ; les remplacer par vos propres photos avant lancement.
- Les produits ne sont **pas précréés** ; l'Admin est censé créer votre catalogue. Les anciennes données Firebase sont conservées.
- Testez l'inscription, la connexion Admin, une commande invitée, une commande avec compte et le suivi du statut avant ouverture publique.

## 6. Déploiement et domaine

GitHub Pages : `boumiza-1/-Sportifano` → Settings → Pages : branche `main`, racine. Custom domain : `sportifano.com`. Les DNS Hostinger restent dirigés vers les IP GitHub Pages ; ne changez pas les DNS et ne réactivez pas Render. `https://www.sportifano.com` peut rediriger vers le domaine principal selon la configuration GitHub.

**Conseil de migration :** gardez le ZIP de sauvegarde et testez avec un produit factice avant d'envoyer des commandes réelles.
