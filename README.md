# Himalaya — Eau Minérale Naturelle

Site vitrine et boutique en ligne pour Himalaya (Abidjan, Côte d’Ivoire). L’interface existante (HTML/CSS/JavaScript) et son parcours de commande sont conservés ; Supabase centralise désormais les produits, les stocks, les réglages et les commandes.

## Fonctionnalités

**Côté client :** catalogue, panier conservé sur l’appareil, livraison ou retrait, créneau horaire, paiement en espèces, confirmation WhatsApp et suivi d’une commande par son numéro.

**Côté boutique :** connexion par compte Supabase autorisé, commandes visibles depuis tous les appareils, mise à jour des statuts et des stocks, gestion des produits et des zones de livraison, réglages WhatsApp et adresse, export JSON des commandes.

Les paiements Mobile Money et carte ne sont pas intégrés : l’option Mobile Money reste refusée comme dans la version précédente.

## Configuration Supabase (obligatoire avant les commandes réelles)

1. Le projet de production existe déjà : **HIMALAYA**, région `eu-west-3`. Les migrations de ce projet ont été appliquées ; ne lancez pas l’ancien script archivé `supabase/archive/202611240001_initial.superseded.sql`.
2. Les migrations appliquées sont `20261124224950_restrict_public_is_admin_execution.sql` (limite le RPC historique d’administration aux comptes connectés), `20261124231205_align_existing_himalaya_schema.sql` (conserve les tables et lignes existantes, ajoute `shop_settings`, les politiques RLS et les fonctions sécurisées, puis insère les produits initiaux uniquement s’ils manquent) et `20261124231659_split_himalaya_rls_policies.sql` (sépare les lectures publiques des écritures administrateur sans chevauchement des règles SELECT).
3. L’URL Supabase et la clé publishable (publique) sont configurées dans `assets/js/config.js`. La clé publique Turnstile est encore à renseigner dans ce fichier ; la clé secrète Turnstile ne doit jamais y figurer.
4. L’invitation du compte administrateur a été envoyée et son UUID est déjà inscrit dans `public.admin_users` ; l’accès ne sera possible qu’après validation du courriel. Pour tout autre administrateur, invitez un compte de confiance dans **Authentication → Users**, puis ajoutez uniquement son UUID à `public.admin_users`. Ne donnez jamais ce rôle à un compte client et désactivez les inscriptions publiques avant le lancement.
5. Le site utilise GitHub Pages à l’adresse `https://wilfried-neo.github.io/HIMALAYA-2.0/`. Pour Turnstile, autorisez le domaine `wilfried-neo.github.io` (sans chemin). L’origine CORS à configurer côté Edge Function est `https://wilfried-neo.github.io` (sans chemin final).
6. Une fois Turnstile créé, déployez `create-himalaya-order` et configurez `TURNSTILE_SECRET` ainsi que `ALLOWED_ORIGIN` dans les secrets de la fonction Supabase. Gardez le secret Turnstile dans Supabase ; la clé `service_role`, utilisée côté serveur Supabase uniquement, ne doit jamais être copiée dans le site ou le dépôt.
7. Dans **Authentication → URL Configuration → Redirect URLs**, autorisez aussi `https://wilfried-neo.github.io/HIMALAYA-2.0/reset-password.html` pour que le lien « Mot de passe oublié » puisse revenir sur la page de choix du nouveau mot de passe.
8. Ne publiez pas les changements de ce dépôt avant d’avoir configuré Turnstile et l’accès administrateur, puis vérifié la connexion, le catalogue, le suivi et une commande de test.

**Important :** la clé publishable/anon est conçue pour être publique ; la sécurité repose sur les règles RLS et les fonctions SQL. N’ajoutez jamais la clé `service_role`, un mot de passe de base de données ou un secret privé à `config.js`, au dépôt Git ou au JavaScript client.

Tant que Turnstile, l’invitation administrateur et le déploiement de la fonction ne sont pas terminés, la boutique affiche les données centralisées mais ne doit pas accepter de commandes réelles ni être considérée comme opérationnelle.

## Lancer localement

Servez le dossier avec un serveur HTTP (et non en ouvrant le fichier directement) :

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Pour les essais locaux, adaptez temporairement `ALLOWED_ORIGIN` à l’origine réellement utilisée et configurez le domaine correspondant dans Turnstile. Les données métier ne sont plus stockées dans le navigateur ; seul le panier demeure local à l’appareil.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Boutique client |
| `admin.html` | Espace boutique protégé |
| `assets/js/config.js` | URL et clés publiques uniquement |
| `assets/js/store.js` | Accès Supabase, panier local, validation des commandes |
| `assets/js/app.js` | Parcours et interface client |
| `assets/js/admin.js` | Interface de gestion |
| `assets/css/style.css` | Styles existants, conservés |
| `supabase/migrations/` | Migrations réellement appliquées au projet existant ; le script initial incompatible reste archivé dans `supabase/archive/` |
| `supabase/functions/create-himalaya-order/index.ts` | Vérification Turnstile et appel transactionnel serveur |
| `images/` | Logo, bannière et photos produits |

## Sécurité et données

- Les commandes ne peuvent pas être lues anonymement ; l’administration est autorisée par compte, avec un rôle distinct en base.
- Le navigateur soumet les commandes à une Edge Function qui vérifie un jeton Turnstile. Seule cette fonction peut appeler la procédure de création.
- PostgreSQL recalcule le prix, les frais et le total à partir des données serveur, puis verrouille les lignes de stock pendant la transaction.
- Les numéros de commande sont imprévisibles et le suivi ne retourne que les informations nécessaires, pas les coordonnées du client.
- L’annulation rétablit le stock une seule fois ; une commande annulée ne peut pas être remise en circulation via l’interface.
- Les ventes affichées dans les statistiques correspondent aux commandes marquées « Terminée ».
- Les commandes enregistrées avant la migration dans un `localStorage` ne sont pas transférées automatiquement. Exportez-les depuis l’ancien navigateur si vous devez les conserver.
- Configurez et vérifiez les sauvegardes du projet Supabase ; l’export JSON des commandes constitue une copie manuelle, pas une sauvegarde automatique.

## Déploiement GitHub Pages

Le dépôt demeure un site statique. Après configuration de `assets/js/config.js`, de l’Edge Function et de ses secrets, GitHub Pages peut publier la branche `main`. La base Supabase n’est pas hébergée sur GitHub Pages. Utilisez HTTPS et configurez les URL de redirection e-mail autorisées dans Supabase.
