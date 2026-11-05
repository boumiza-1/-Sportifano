import { createAssistantReply, getAvailability } from './chatbot-engine.mjs';

const catalog = { products: {}, categories: {}, status: 'loading' };
let context = {};
let handlers = {};
const messages = [];
let open = false;

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const launcher = element('button', 'chat-launcher');
launcher.id = 'chatLauncher';
launcher.type = 'button';
launcher.setAttribute('aria-controls', 'chatPanel');
launcher.setAttribute('aria-expanded', 'false');
launcher.innerHTML = '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 11.5a8 8 0 0 1-8 8H4l-2 2v-10a9 9 0 0 1 18 0Z"/><path d="M7 10h8M7 14h5"/></svg><span>Besoin d’aide ?</span>';

const panel = element('section', 'chat-panel');
panel.id = 'chatPanel';
panel.hidden = true;
panel.setAttribute('role', 'dialog');
panel.setAttribute('aria-labelledby', 'chatTitle');
panel.innerHTML = `
  <header class="chat-header">
    <div><span class="chat-eyebrow">SPORTIFANO · À VOTRE ÉCOUTE</span><h2 id="chatTitle">Votre assistant shopping</h2><p>Produits, prix & conseils pour commander</p></div>
    <button type="button" class="chat-close" aria-label="Fermer l’assistant">✕</button>
  </header>
  <p class="chat-catalog-status" id="chatStatus" role="status"></p>
  <div class="chat-messages" id="chatMessages" role="log" aria-label="Conversation avec l’assistant" aria-live="off"></div>
  <div class="chat-sr-only" id="chatAnnouncer" role="status" aria-atomic="true"></div>
  <div class="chat-suggestions" aria-label="Questions suggérées">
    <button type="button" data-chat-question="Je cherche des crampons">Crampons</button>
    <button type="button" data-chat-question="Produits à moins de 100 DT">Budget 100 DT</button>
    <button type="button" data-chat-question="Comment commander ?">Comment commander ?</button>
  </div>
  <form id="chatForm" class="chat-form">
    <label for="chatInput" class="chat-sr-only">Votre question</label>
    <input id="chatInput" name="message" type="text" maxlength="300" autocomplete="off" placeholder="Ex. : fama crapon ? chnowa soumou ?" required>
    <button type="submit" aria-label="Envoyer le message"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m4 12 16-8-8 16-2-6-6-2Z"/><path d="m10 14 5-5"/></svg></button>
  </form>
  <p class="chat-footnote">Stock indicatif · Confirmation finale par la boutique.</p>`;
document.body.append(launcher, panel);
const log = panel.querySelector('#chatMessages');
const input = panel.querySelector('#chatInput');
const statusLine = panel.querySelector('#chatStatus');

function toggle(show, restoreFocus = true) {
  open = show;
  panel.hidden = !show;
  launcher.setAttribute('aria-expanded', String(show));
  if (show) {
    input.focus({ preventScroll: true });
    log.scrollTop = log.scrollHeight;
  } else if (restoreFocus) launcher.focus({ preventScroll: true });
}
launcher.addEventListener('click', () => toggle(!open));
panel.querySelector('.chat-close').addEventListener('click', () => toggle(false));
panel.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    toggle(false);
  }
});

function productCard(id) {
  const product = catalog.products[id];
  if (!product || product.active === false) return null;
  const card = element('article', 'chat-product');
  card.dataset.chatCard = id;
  const top = element('div', 'chat-product-top');
  const imageUrl = Array.isArray(product.images) ? product.images[0] : '';
  if (typeof imageUrl === 'string' && (/^https:\/\//i.test(imageUrl) || /^\.\/assets\//.test(imageUrl))) {
    const image = element('img', 'chat-product-image');
    image.src = imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('error', () => image.remove(), { once: true });
    top.append(image);
  }
  const info = element('div', 'chat-product-info');
  info.append(element('h3', '', String(product.name || 'Produit')));
  const validPrice = product.price !== '' && product.price != null && Number.isFinite(Number(product.price)) && Number(product.price) >= 0;
  info.append(element('p', 'chat-product-price', validPrice ? Number(product.price).toFixed(2) + ' DT' : 'Prix à confirmer'));
  const availability = getAvailability(product);
  info.append(element('p', 'chat-stock chat-stock-' + availability, {
    available: 'En stock selon le catalogue', unavailable: 'Indisponible selon le catalogue', unknown: 'Disponibilité à confirmer'
  }[availability]));
  top.append(info);
  card.append(top);
  for (const [label, value] of [['Tailles', product.sizes], ['Couleurs', product.colors]]) {
    if (value) card.append(element('p', 'chat-product-options', label + ' : ' + String(value)));
  }
  if (product.description || product.delivery) {
    const details = element('details', 'chat-product-details');
    details.append(element('summary', '', 'Détails du produit'));
    if (product.description) details.append(element('p', '', String(product.description)));
    if (product.delivery) details.append(element('p', '', 'Livraison : ' + String(product.delivery)));
    card.append(details);
  }
  const button = element('button', 'chat-product-link', availability === 'unavailable' ? 'Actuellement indisponible' : 'Voir le produit →');
  button.type = 'button';
  button.dataset.chatProduct = id;
  button.disabled = availability === 'unavailable';
  card.append(button);
  return card;
}

const actionLabels = { cart: 'Ouvrir mon panier →', 'order-help': 'Comment commander ?', catalog: 'Voir le catalogue →', alternatives: 'Autres produits', cheaper: 'Moins cher' };
function renderMessage(message) {
  const bubble = element('div', 'chat-message chat-message-' + message.kind);
  bubble.append(element('p', 'chat-message-text', message.text));
  if (message.kind === 'assistant') {
    for (const id of message.productIds || []) {
      const card = productCard(id);
      bubble.append(card || element('p', 'chat-product-options', 'Ce produit n’est plus visible dans le catalogue.'));
    }
    if (message.actions?.length) {
      const actions = element('div', 'chat-actions');
      for (const action of message.actions) {
        if (!actionLabels[action]) continue;
        const button = element('button', '', actionLabels[action]);
        button.type = 'button';
        button.dataset.chatAction = action;
        actions.append(button);
      }
      bubble.append(actions);
    }
  }
  return bubble;
}

function addReply(message) {
  const reply = { kind: 'assistant', ...message };
  if (reply.productIds?.length) reply.actions = [...new Set([...(reply.actions || []), 'alternatives', 'cheaper'])];
  messages.push(reply);
  log.append(renderMessage(reply));
  // Keep only the recent conversation in memory; no messages are sent or stored remotely.
  while (messages.length > 31) {
    messages.shift();
    log.firstElementChild?.remove();
  }
  panel.querySelector('#chatAnnouncer').textContent = reply.text;
  log.scrollTop = log.scrollHeight;
}

function ask(value) {
  const text = value.trim().slice(0, 300);
  if (!text) return;
  const userMessage = { kind: 'user', text };
  messages.push(userMessage);
  log.append(renderMessage(userMessage));
  const reply = createAssistantReply(text, catalog, context);
  context = reply.context;
  addReply(reply);
  input.value = '';
}
panel.querySelector('#chatForm').addEventListener('submit', event => {
  event.preventDefault();
  ask(input.value);
});

function openStoreModal(callback, ...args) {
  toggle(false, false);
  callback(...args);
  const modal = document.querySelector('#modalBg .modal');
  const heading = modal?.querySelector('h2');
  if (heading) {
    heading.id = 'chatStoreDialogTitle';
    heading.tabIndex = -1;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', heading.id);
    heading.focus({ preventScroll: true });
  }
}

panel.addEventListener('click', event => {
  const question = event.target.closest('[data-chat-question]');
  if (question) ask(question.dataset.chatQuestion);
  const productButton = event.target.closest('[data-chat-product]');
  if (productButton && !productButton.disabled) {
    const id = productButton.dataset.chatProduct;
    const product = catalog.products[id];
    if (!product || product.active === false || getAvailability(product) === 'unavailable') {
      addReply({ text: 'Ce produit n’est plus disponible. Demandez-moi une alternative.' });
    } else if (handlers.onProduct) {
      context = { ...context, focusId: id };
      openStoreModal(handlers.onProduct, id);
    }
  }
  const action = event.target.closest('[data-chat-action]')?.dataset.chatAction;
  if (action === 'alternatives') ask('Autres produits similaires');
  if (action === 'cheaper') ask('Moins cher');
  if (action === 'order-help') ask('Comment commander ?');
  if (action === 'cart') {
    if (handlers.onCart) {
      openStoreModal(handlers.onCart);
    } else {
      addReply({ text: 'Le panier est temporairement indisponible. Réessayez après le chargement de la boutique.' });
    }
  }
  if (action === 'catalog') {
    toggle(false);
    document.querySelector('#shop')?.scrollIntoView({ behavior: 'smooth' });
  }
});

function updateStatus() {
  statusLine.textContent = {
    loading: 'Chargement du catalogue…',
    error: 'Catalogue temporairement inaccessible · Aide aux commandes disponible',
    ready: 'Réponses basées sur le catalogue de la boutique'
  }[catalog.status];
}

export function updateAssistantCatalog(update) {
  Object.assign(catalog, update);
  updateStatus();
  // Refresh prices and visibility without replacing the conversation or losing keyboard focus.
  for (const oldCard of log.querySelectorAll('[data-chat-card]')) {
    const id = oldCard.dataset.chatCard;
    const card = productCard(id) || element('p', 'chat-product-options', 'Ce produit n’est plus visible dans le catalogue.');
    card.dataset.chatCard = id;
    const details = card.querySelector('details');
    if (details && oldCard.querySelector('details')?.open) details.open = true;
    const focused = oldCard.contains(document.activeElement);
    const focusedDetails = document.activeElement?.tagName === 'SUMMARY';
    oldCard.replaceWith(card);
    if (focused) {
      const target = card.querySelector(focusedDetails ? 'summary' : 'button:not(:disabled)') || input;
      target.focus({ preventScroll: true });
    }
  }
}

export function configureAssistant(callbacks) {
  handlers = callbacks;
}

addReply({ text: 'Aslema 👋 Je vous aide à trouver votre équipement ! Dites-moi le produit, votre budget ou votre pointure. Vous pouvez écrire en français, en derja ou en arabe.', actions: ['order-help'] });
updateStatus();
// The independent widget can still explain ordering if a remote Firebase module fails to load.
setTimeout(() => {
  if (catalog.status === 'loading') updateAssistantCatalog({ status: 'error' });
}, 12000);
