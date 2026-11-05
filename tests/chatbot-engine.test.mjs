import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssistantReply, getAvailability } from '../chatbot-engine.mjs';

const products = {
  predator: { name: 'Adidas Predator', category: 'crampons', price: 180, stock: 4, active: true, sizes: '40, 41, 42', colors: 'Noir, Blanc', description: 'Crampons de football', delivery: 'Livraison selon gouvernorat' },
  speed: { name: 'Nike Mercurial', category: 'crampons', price: 150, stock: 2, sizes: '42, 43', colors: 'Bleu', description: 'Crampon terrain ferme' },
  sold: { name: 'Puma Future', category: 'crampons', price: 160, stock: 0, sizes: '42', colors: 'Noir' },
  hidden: { name: 'Crampon caché', category: 'crampons', price: 1, stock: 10, active: false },
  shirt: { name: 'Maillot football', category: 'maillots', price: 60, stock: 7, colors: 'Noir', sizes: 'S, M, L' },
  runner: { name: 'Running Air', category: 'running', price: 120, sizes: '40, 42', colors: 'Blanc' },
  empty: null
};
const catalog = { products, categories: { crampons: { name: 'Crampons' }, maillots: { name: 'Maillots' }, running: { name: 'Running' } }, status: 'ready' };
const ask = (message, context) => createAssistantReply(message, catalog, context);

test('stock semantics never turn missing, empty or invalid quantities into availability', () => {
  assert.equal(getAvailability({ stock: 2 }), 'available');
  assert.equal(getAvailability({ stock: '0' }), 'unavailable');
  for (const stock of [undefined, null, '', ' ', false, [], {}, -1, 'invalid']) assert.equal(getAvailability({ stock }), 'unknown');
});

test('French, Tunisian and Arabic crampon searches share catalog results, excluding inactive/null products', () => {
  for (const query of ['crampon', 'fama crapon ?', 'نحب كرامبون', 'فما كرامبون', 'cramponn']) {
    const result = ask(query);
    assert.ok(result.productIds.includes('predator'), query);
    assert.ok(result.productIds.includes('speed'), query);
    assert.ok(!result.productIds.includes('hidden'));
    assert.ok(!result.productIds.includes('shirt'));
  }
});

test('exact product name ranks first and sold-out model has explicit stock notice plus related alternatives', () => {
  const result = ask('fama Puma Future ?');
  assert.equal(result.productIds[0], 'sold');
  assert.match(result.text, /rupture de stock/);
  assert.ok(result.productIds.includes('predator'));
  assert.ok(!result.productIds.includes('shirt'));
});

test('maximum budget, requested size and color are enforced together', () => {
  const result = ask('crapon bleu taille 42 moins de 155 DT');
  assert.deepEqual(result.productIds, ['speed']);
  assert.match(result.text, /155.00 DT/);
  assert.deepEqual(ask('crapon noir taille 42 max 100').productIds, []);
});

test('unsupported brand does not pretend to be an exact product; category alternatives are labelled', () => {
  const result = ask('crampon Reebok');
  assert.ok(result.productIds.length);
  assert.match(result.text, /pas le modele exact|pas le modèle exact/);
  assert.ok(!result.productIds.includes('shirt'));
});

test('unknown search does not return unrelated products as matches', () => {
  const result = ask('raquette tennis');
  assert.deepEqual(result.productIds, []);
  assert.match(result.text, /ne trouve pas/);
});

test('follow-up price/details uses selected product and live product values are not copied into context', () => {
  const first = ask('Adidas Predator');
  const result = ask('9adech soumou ?', first.context);
  assert.deepEqual(result.productIds, ['predator']);
  assert.match(result.text, /Adidas Predator/);
  assert.equal(result.context.price, undefined);
});

test('follow-up filters reuse prior product query, while a new product query clears prior filters', () => {
  const first = ask('crapon');
  assert.deepEqual(ask('bleu taille 42', first.context).productIds, ['speed']);
  const filtered = ask('crapon bleu');
  assert.deepEqual(ask('maillot', filtered.context).productIds, ['shirt']);
});

test('alternatives exclude cards already shown and keep the category', () => {
  const first = ask('Adidas Predator');
  const other = ask('fama produit 8irou ?', first.context);
  assert.ok(other.productIds.includes('speed'));
  assert.ok(!other.productIds.includes('predator'));
  assert.ok(!other.productIds.includes('shirt'));
});

test('cheaper follow-up excludes more expensive products', () => {
  const first = ask('Adidas Predator');
  const other = ask('fama ar5es ?', first.context);
  assert.deepEqual(other.productIds, ['speed']);
});

test('loading, database errors and genuinely empty catalogs remain distinct', () => {
  assert.match(createAssistantReply('crampon', { status: 'loading' }).text, /chargement/);
  assert.match(createAssistantReply('crampon', { status: 'error' }).text, /n’arrive pas/);
  assert.match(createAssistantReply('crampon', { products: {} }).text, /Aucun produit/);
});

test('ordering and payment guidance work even if Firebase is unavailable and never promise delivery price', () => {
  const result = createAssistantReply('kifh ncommandi ?', { status: 'error' });
  assert.match(result.text, /avec ou sans compte/);
  assert.match(result.text, /paiement se fait a la livraison|paiement se fait à la livraison/);
  assert.ok(result.actions.includes('cart'));
  const delivery = createAssistantReply('livraison ?', { status: 'error' });
  assert.match(delivery.text, /confirmer/);
  assert.match(delivery.text, /pas fixes|pas fixés/);
});

test('deleted or hidden contextual products are not returned for follow-up details', () => {
  const result = ask('prix ?', { focusId: 'hidden', query: 'raquette' });
  assert.deepEqual(result.productIds, []);
});

test('unknown stock is described as unconfirmed, never available', () => {
  const result = ask('Running Air');
  assert.deepEqual(result.productIds, ['runner']);
  assert.match(result.text, /disponibilite reste a confirmer|disponibilité reste à confirmer/);
});

test('delivery and Arabic price follow-ups use the focused product', () => {
  const context = ask('Adidas Predator').context;
  assert.match(ask('livraison ?', context).text, /Livraison selon gouvernorat/);
  assert.deepEqual(ask('شنو سومو', context).productIds, ['predator']);
});

test('ordering a named product still explains checkout', () => {
  assert.match(ask('comment commander les crampons').text, /Ajouter au panier/);
  assert.match(ask('kifh ncommandi crapon').text, /Ajouter au panier/);
});

test('fresh cheap category query does not browse unrelated products', () => {
  assert.deepEqual(ask('crampon pas cher').productIds, ['speed', 'predator']);
  assert.deepEqual(ask('crampon moins de 155DT').productIds, ['speed']);
});

test('a catalog budget chip clears the previous category and filters', () => {
  const context = ask('crampon bleu taille 42').context;
  assert.deepEqual(ask('Produits à moins de 100 DT', context).productIds, ['shirt']);
});

test('generic category results do not lead with a single out-of-stock warning', () => {
  const result = ask('crampon');
  assert.ok(!result.text.startsWith('Puma Future'));
});

test('generic product type stays generic when category name differs from the product type', () => {
  const differentCategory = { categories: { foot: { name: 'Football' } }, products: {
    puma: { name: 'Crampons Puma Future', category: 'foot', stock: 0, price: 100 },
    nike: { name: 'Crampons Nike Phantom', category: 'foot', stock: 3, price: 120 }
  }};
  const generic = createAssistantReply('crapon', differentCategory);
  assert.equal(generic.productIds[0], 'nike');
  assert.ok(!generic.text.startsWith('Crampons Puma Future'));
  const explicit = createAssistantReply('Puma Future', differentCategory);
  assert.equal(explicit.productIds[0], 'puma');
  assert.match(explicit.text, /rupture/);
});
