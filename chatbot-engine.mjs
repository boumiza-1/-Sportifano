// The assistant only searches the public catalog; it never invents products or stock.
const normalize = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’']/g, ' ').replace(/(\d)(dt|tnd)\b/g, '$1 $2');
const words = value => normalize(value).match(/[\p{L}\p{N}]+/gu) || [];
const groups = {
  crampon: 'crampon crampons crapon crapons krampoun krampounet كرامبون كرامبونات',
  chaussure: 'chaussure chaussures shoes shoe sbat sbet sabat سباط حذاء احذية',
  sneaker: 'sneaker sneakers basket baskets',
  maillot: 'maillot maillots tshirt t-shirt مريول تيشرت',
  football: 'football foot futbol كورة كرة',
  running: 'running course courir جري',
  fitness: 'fitness musculation gym رياضة',
  ballon: 'ballon ballons ball كرة',
  noir: 'noir noire black k7al ak7al كحل اسود سوداء',
  blanc: 'blanc blanche white abyed ابيض بيضاء',
  rouge: 'rouge red a7mer احمر حمراء',
  bleu: 'bleu bleue blue azra9 ازرق زرقاء',
  vert: 'vert verte green a5dher اخضر خضراء',
  rose: 'rose pink وردي',
  gris: 'gris grise grey gray رمادي'
};
const aliases = new Map(Object.entries(groups).flatMap(([canonical, variants]) => words(variants).map(variant => [variant, canonical])));
const canonical = word => aliases.get(word) || word;
const tokens = value => words(value).map(canonical);
const colors = new Set(['noir', 'blanc', 'rouge', 'bleu', 'vert', 'rose', 'gris']);
const productTypes = new Set(['crampon', 'chaussure', 'sneaker', 'maillot', 'football', 'running', 'fitness', 'ballon']);
const ignored = new Set(words(`a au aux avec de des du d en un une le la les l ce cette ces et ou pour sur dans mon ma mes ton ta tes il elle est sont je j tu vous nous on me moi m se s c y t n qu que qui quoi quel quelle quelles quels combien prix soum souma tarif coute coutent cout couter details detail information infos description disponible disponibles disponibilite stock dispo produit produits article articles cherche chercher recherche rechercher voudrais veux avez avezvous trouve trouver voir montre montrer propose proposez donne donnez svp stp bonjour salut hello slm salem ahla aslema asslema merci oui non fama famma fema n7eb nheb nlawj nlawej nlawej a3tini atini 3andek 3andkom andkom chnowa chnia 9adech 9addech 9adeh kadech kifech kifh kif kifach chnow soumo soumou soumha hedha hetha hedhi eli li elli bel men fi fel wela wala w b bil bi bch bech tnajem tnajm تنجم نحب نلوج على في متاع عندكم عندك هذا هاذي شنو شنية سوم سعر ثمن قداش موجود موجودة متوفر متوفرة المنتج منتجات هل اريد ابحث عن من لو سمحت taille tailles pointure pointures size sizes couleur couleurs لون الوان قياس مقاس budget max maximum sous moins cher chers chere pas plus euros dt tnd dinar dinars دينار اقل ارخص ta7t a9al ar5es ar5ess arkhes autre autres alternative alternatives similaire similaires different differents 8irou 8irhom ghayrou ghirou غيره غيرها بديل بدائل premier premiere deuxieme troisieme quatrieme 1er 2eme 3eme 4eme celui celle ci ca the is are do you have i want how much please my for of to`));

words('livraison livrer livre delivery tawsil tawsile فما فمة شنوة سومو سومها تفاصيل').forEach(word => ignored.add(word));

export function getAvailability(product) {
  const stock = product?.stock;
  if (!['number', 'string'].includes(typeof stock) || String(stock).trim() === '') return 'unknown';
  const quantity = Number(stock);
  if (!Number.isFinite(quantity) || quantity < 0) return 'unknown';
  return quantity > 0 ? 'available' : 'unavailable';
}

const list = value => (Array.isArray(value) ? value : String(value ?? '').split(',')).map(value => String(value).trim()).filter(Boolean);
const publicProducts = products => Object.entries(products || {}).filter(([, product]) => product && typeof product === 'object' && product.active !== false && product.name);
const validPrice = product => product.price !== '' && product.price !== null && product.price !== undefined && Number.isFinite(Number(product.price)) && Number(product.price) >= 0;
function closeWord(a, b) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  // A single missing, added, substituted, or transposed character is tolerated.
  let i = 0, j = 0, errors = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++errors > 1) return false;
    if (a.length === b.length && a[i] === b[j + 1] && a[i + 1] === b[j]) { i += 2; j += 2; }
    else if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return errors + Number(i < a.length || j < b.length) <= 1;
}

function readFilters(message, previous = {}) {
  const text = normalize(message);
  const filters = { ...previous };
  const budget = text.match(/(?:budget|max(?:imum)?|moins de|sous|ta7t|a9al men|اقل من)\s*(\d+(?:[.,]\d+)?)/) || text.match(/(\d+(?:[.,]\d+)?)\s*(?:dt|tnd|dinars?|دينار)\b/);
  if (budget) filters.maxPrice = Number(budget[1].replace(',', '.'));
  const size = text.match(/(?:taille|pointure|size|9yas|قياس|مقاس)\s*(\d{2}|[xsml]{1,3})\b/i);
  const bareSize = !budget && text.match(/\b([2-5]\d)\b/);
  if (size || bareSize) filters.size = (size || bareSize)[1].toUpperCase();
  const color = tokens(text).find(token => colors.has(token));
  if (color) filters.color = color;
  return filters;
}

function respectsFilters(product, filters) {
  return (filters.maxPrice === undefined || (validPrice(product) && Number(product.price) <= filters.maxPrice)) &&
    (!filters.size || list(product.sizes).some(size => normalize(size) === normalize(filters.size))) &&
    (!filters.color || tokens(list(product.colors).join(' ')).includes(filters.color));
}

function filterSummary(filters) {
  return [filters.maxPrice !== undefined && `budget maximum ${filters.maxPrice.toFixed(2)} DT`, filters.size && `taille ${filters.size}`, filters.color && `couleur ${filters.color}`].filter(Boolean).join(', ');
}

const reply = (text, productIds = [], context = {}, actions = ['catalog']) => ({ text, productIds, actions, context });
const orderHelp = 'Pour commander : ouvrez un produit, choisissez la taille, la couleur et la quantité, puis « Ajouter au panier ». Ouvrez le panier et cliquez « Commander ». Renseignez votre nom, téléphone, gouvernorat et adresse, puis confirmez. Vous pouvez commander avec ou sans compte. Le paiement se fait à la livraison ; le montant final et les frais de livraison seront confirmés par la boutique.';

/**
 * Pure response builder. Product cards are rendered by the caller using these IDs.
 * Context is local to the chat session and contains no customer/order information.
 */
export function createAssistantReply(message, { products = {}, categories = {}, status = 'ready' } = {}, context = {}) {
  const text = normalize(message).trim();
  const allWords = tokens(text);
  const semantic = [...new Set(allWords.filter(token => !ignored.has(token) && !colors.has(token) && !/^\d+$/.test(token) && !/^(xxs|xs|s|m|l|xl|xxl|xxxl)$/.test(token)))];
  const alternatives = /\b(autres?|alternatives?|similaires?|different\w*|8irou|8irhom|ghayrou|ghirou)\b|غيره|غيرها|بديل|بدائل/u.test(text);
  const cheaper = /moins cher|pas cher|ar5es|ar5ess|arkhes|a9al soum|ارخص/.test(text);
  const detailQuestion = /\b(prix|soum\w*|tarif|cout\w*|detail\w*|dispo\w*|stock|taille\w*|pointure\w*|couleur\w*|livraison)\b|سوم|سعر|ثمن|موجود|مقاس|قياس|تفاصيل/.test(text);
  const orderQuestion = /\b(command\w*|ncommandi|necommandi|panier|checkout|cart|order)\b|نطلب|نكمندي|اطلب|طلبية/.test(text);
  const paymentQuestion = /\b(paiement|payer|paye|payment|carte|cash)\b|خلاص|نخلص/.test(text);
  const deliveryQuestion = /\b(livraison|livrer|livre|delivery|tawsil|tawsile)\b|توصيل/.test(text);
  const greeting = /^(bonjour|salut|hello|slm|salem|ahla|aslema|asslema|merci|السلام عليكم|عسلامة)[ !?.]*$/.test(text);
  const genericCatalog = /^(?:tous les produits|tous|catalogue|catalog|produits|produit|les produits|chneya mawjoud|شنو موجود|المنتجات)[ !?.]*$/.test(text) || (allWords.includes('produits') && !semantic.length);
  const explicitHelp = /^(?:aide|help|comment ca marche|kifh|kifech)[ !?.]*$/.test(text);
  if (greeting || explicitHelp || !text) return reply('Aslema 👋 Je suis l’assistant Sportifano. Dites-moi ce que vous cherchez : « crapon », « maillot noir », « running moins de 150 DT »… Je peux aussi vous aider à commander.', [], context, ['catalog', 'order-help']);
  // Shop policy questions can be answered even when the catalog is unavailable.
  if (orderQuestion) return reply(orderHelp, [], context, ['cart', 'catalog']);
  if (paymentQuestion && !detailQuestion) return reply('Le paiement se fait à la livraison. Le site ne propose pas de paiement en ligne. Le montant final, la disponibilité et les frais de livraison seront confirmés par la boutique.', [], context, ['order-help', 'cart']);
  if (deliveryQuestion && !context.focusId && !semantic.some(token => publicProducts(products).some(([, p]) => tokens(p.name).includes(token)))) return reply('La boutique livre en Tunisie. Les informations propres à un article sont indiquées dans sa fiche. Les frais et le délai de livraison ne sont pas fixés dans le catalogue général : la boutique devra vous les confirmer.', [], context, ['order-help']);
  if (status === 'loading') return reply('Le catalogue est en cours de chargement. Réessayez votre recherche dans quelques instants.', [], context, ['order-help']);
  if (status === 'error') return reply('Je n’arrive pas à consulter le catalogue pour le moment. Je ne peux donc pas confirmer un prix ou une disponibilité. Réessayez dans un instant ; je peux toujours expliquer comment commander.', [], context, ['order-help']);
  const entries = publicProducts(products);
  if (!entries.length) return reply('Aucun produit n’est actuellement affiché dans le catalogue. Je ne peux pas confirmer de prix ni de disponibilité. Revenez plus tard.', [], context, ['order-help']);

  // Follow-up questions about a card keep the previous selection, but never use a deleted product.
  const ordinal = text.match(/\b(premier|premiere|1er|deuxieme|2eme|troisieme|3eme|quatrieme|4eme)\b/);
  const index = ordinal && { premier: 0, premiere: 0, '1er': 0, deuxieme: 1, '2eme': 1, troisieme: 2, '3eme': 2, quatrieme: 3, '4eme': 3 }[ordinal[1]];
  const focusedId = ordinal ? context.shownIds?.[index] : context.focusId;
  const focused = entries.find(([id]) => id === focusedId);
  const freshFilters = readFilters(message);
  if (!semantic.length && focused && detailQuestion && !alternatives && !cheaper && !Object.keys(freshFilters).length) {
    const availability = getAvailability(focused[1]);
    const stockText = availability === 'available' ? 'Stock indiqué disponible, sous réserve de confirmation par la boutique.' : availability === 'unavailable' ? 'Cet article est indiqué en rupture de stock.' : 'Le stock de cet article n’est pas renseigné ; la boutique devra confirmer sa disponibilité.';
    const delivery = deliveryQuestion ? (focused[1].delivery ? ` Livraison : ${focused[1].delivery}` : ' Aucun tarif ni délai de livraison n’est renseigné pour cet article.') : '';
    return reply(`Voici les informations du catalogue pour ${focused[1].name}. ${stockText}${delivery}`, [focusedId], { ...context, focusId: focusedId }, ['cart', 'order-help']);
  }

  const query = semantic.length ? semantic : genericCatalog ? [] : tokens(context.query || '').filter(token => !ignored.has(token));
  const filters = readFilters(message, !semantic.length && !genericCatalog ? context.filters : {});
  if (cheaper && focused && validPrice(focused[1])) filters.maxPrice = Math.min(filters.maxPrice ?? Infinity, Number(focused[1].price) - 0.01);
  const categoryId = focused?.[1].category || context.categoryId;
  let ranked = entries.map(([id, product]) => {
    const name = tokens(product.name), category = tokens(categories[product.category]?.name), description = tokens(product.description);
    const haystack = [...name, ...category, ...description];
    const matched = query.filter(token => haystack.some(word => closeWord(token, word)));
    const exactName = query.length > 0 && query.every(token => name.includes(token)) && query.some(token => !category.includes(token) && !productTypes.has(token));
    const score = matched.reduce((score, token) => score + (name.includes(token) ? 10 : category.includes(token) ? 5 : 1), 0) + Number(exactName) * 100;
    return { id, product, score, matches: matched.length === query.length, exactName };
  });
  if (!query.length && !genericCatalog && !alternatives && !cheaper && !Object.keys(filters).length) return reply('Dites-moi un nom de produit, une marque ou une catégorie à chercher. Par exemple : « crampon », « maillot noir » ou « running moins de 150 DT ». Je peux aussi expliquer comment commander.', [], context, ['catalog', 'order-help']);
  if (alternatives || cheaper) ranked = ranked.filter(item => !(context.shownIds || []).includes(item.id));
  let matches = ranked.filter(item => item.matches && respectsFilters(item.product, filters) && (!cheaper || validPrice(item.product)) && (!(alternatives || cheaper) || getAvailability(item.product) !== 'unavailable'));
  let isAlternative = alternatives || cheaper;
  if (!matches.length && query.length) {
    // Relax the product name only when a category actually matches the original request.
    const queryCategories = new Set(entries.filter(([, product]) => tokens(categories[product.category]?.name).some(word => query.some(token => closeWord(token, word)))).map(([, product]) => product.category));
    if ((alternatives || cheaper) && categoryId) queryCategories.add(categoryId);
    matches = ranked.filter(item => queryCategories.has(item.product.category) && getAvailability(item.product) !== 'unavailable' && respectsFilters(item.product, filters));
    isAlternative = matches.length > 0;
  }
  if (!matches.length) {
    const limits = filterSummary(filters);
    return reply(`${alternatives || cheaper ? 'Je ne trouve pas d’autre article correspondant' : 'Je ne trouve pas de produit correspondant'}${limits ? ` à ces critères (${limits})` : ' à cette recherche'} dans le catalogue actuel. Essayez une autre marque, catégorie ou un budget différent.`, [], { ...context, query: query.join(' '), filters }, ['catalog', 'order-help']);
  }
  const availabilityRank = product => ({ available: 0, unknown: 1, unavailable: 2 }[getAvailability(product)]);
  matches.sort((a, b) => cheaper ? Number(a.product.price) - Number(b.product.price) : Number(b.exactName) - Number(a.exactName) || availabilityRank(a.product) - availabilityRank(b.product) || b.score - a.score);
  const selected = matches.slice(0, 4);
  // If the requested model is sold out, include honest, in-stock category alternatives.
  const unavailableExact = selected.find(item => item.exactName && getAvailability(item.product) === 'unavailable');
  if (unavailableExact && selected.length < 4) {
    const extra = ranked.filter(item => item.product.category && item.product.category === unavailableExact.product.category && getAvailability(item.product) === 'available' && respectsFilters(item.product, filters) && !selected.some(chosen => chosen.id === item.id)).sort((a, b) => b.score - a.score).slice(0, 4 - selected.length);
    selected.push(...extra);
  }
  const ids = selected.map(item => item.id);
  const anyAvailable = selected.some(item => getAvailability(item.product) === 'available');
  const anyUnknown = selected.some(item => getAvailability(item.product) === 'unknown');
  let response = isAlternative ? 'Voici d’autres articles à comparer dans le catalogue.' : 'Voici les produits qui correspondent dans le catalogue.';
  if (unavailableExact) response = `${unavailableExact.product.name} est indiqué en rupture de stock.${ids.length > 1 ? ' Voici aussi des alternatives de la même catégorie.' : ''}`;
  else if (isAlternative && !alternatives && !cheaper) response = 'Je ne trouve pas le modèle exact demandé. Voici des alternatives dans la même catégorie qui respectent vos critères.';
  const limits = filterSummary(filters);
  if (limits) response += ` Critères : ${limits}.`;
  if (anyAvailable) response += ' Le stock affiché est indicatif et sera confirmé par la boutique.';
  if (anyUnknown) response += ' Certains stocks ne sont pas renseignés : leur disponibilité reste à confirmer.';
  if (!anyAvailable && !anyUnknown && !unavailableExact) response += ' Ces articles sont indiqués en rupture de stock.';
  response += ' Cliquez sur une fiche pour voir les détails et choisir vos options.';
  return reply(response, ids, { query: query.join(' '), filters, shownIds: ids, focusId: ids[0], categoryId: selected[0].product.category }, ['cart', 'order-help']);
}
