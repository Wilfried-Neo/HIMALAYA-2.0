# Himalaya — Eau Minérale Naturelle (site e-commerce)

Site vitrine + boutique en ligne pour Himalaya (Abidjan, Côte d'Ivoire).
Statique (HTML/CSS/JS), prêt pour GitHub Pages.

## Lancer le site

Ouvrez `index.html` dans un navigateur, ou servez le dossier :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Boutique : catalogue, panier, commande, suivi, contact |
| `admin.html` | Espace boutique : commandes, produits, zones, paramètres |
| `assets/js/store.js` | Données & logique partagée (produits, commandes, réglages) |
| `assets/js/app.js` | Logique de la boutique |
| `assets/js/admin.js` | Logique de l'espace boutique |
| `assets/css/style.css` | Styles |
| `images/` | Logo, bannière et photos produits |

## Fonctionnalités

**Côté client** : catalogue avec stocks, panier, commande en 3 étapes
(livraison à domicile ou retrait en boutique), créneau horaire, paiement
espèces à la livraison, confirmation avec récapitulatif WhatsApp,
suivi de commande par numéro.

**Côté boutique** (`admin.html`, mot de passe par défaut `himalaya2026`) :
liste des commandes avec statuts, détail + récapitulatif WhatsApp,
gestion des produits (prix, stock, visibilité, ajout/suppression),
zones et frais de livraison, numéro WhatsApp, export JSON.

## Déploiement sur GitHub Pages

1. Remplacez le contenu de votre dépôt `HIMALAYA-SITE-WEB` par ce dossier
   (gardez le même nom de branche `main`).
2. GitHub Pages republiera le site automatiquement.

## Limite importante (à lire)

C'est un site **100 % statique** : les commandes, produits et réglages sont
enregistrés dans le **navigateur de l'appareil** qui les a créés
(`localStorage`). Concrètement :

- Les commandes passées par un client ne sont visibles dans l'espace boutique
  **que sur le même appareil/navigateur** — d'où le bouton « Récapitulatif
  WhatsApp » qui envoie chaque commande sur votre WhatsApp en un clic.
- Pour un vrai suivi multi-appareils (commandes visibles partout, comptes
  clients, paiement Mobile Money réel), il faudra une version avec serveur
  et base de données — c'est l'étape 2 du projet.

## Crédits

- Visuels (logo, bannière, photos produits) : Himalaya — fournis par le client.
- Polices : Montserrat & Open Sans (Google Fonts).
