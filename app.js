/* =================================================================
   ¡El Precio Justo! – app.js
   State management, API calls, price generation, and scoring logic
   ================================================================= */

// --------------- Fallback Products ---------------
const fallbackProducts = [
  { title: 'Smartphone Samsung Galaxy S24', price: 849.99, thumbnail: 'https://cdn.dummyjson.com/products/images/smartphones/Samsung%20Galaxy%20S24/1.png' },
  { title: 'Portátil Apple MacBook Air M2', price: 1299.00, thumbnail: 'https://cdn.dummyjson.com/products/images/laptops/Apple%20MacBook%20Air%20M2/1.png' },
  { title: 'Perfume Calvin Klein CK One', price: 49.99, thumbnail: 'https://cdn.dummyjson.com/products/images/fragrances/Calvin%20Klein%20CK%20One/1.png' },
  { title: 'Auriculares inalámbricos de lujo', price: 279.99, thumbnail: 'https://cdn.dummyjson.com/products/images/vehicle/Dodge%20Challenger/1.png' },
  { title: 'Televisor Samsung 55" 4K UHD', price: 549.99, thumbnail: 'https://cdn.dummyjson.com/products/images/furniture/Annibale%20Colombo%20Bed/1.png' },
  { title: 'Smartphone iPhone 15 Pro', price: 1199.00, thumbnail: 'https://cdn.dummyjson.com/products/images/smartphones/iPhone%2015%20Pro/1.png' },
  { title: 'Portátil HP Pavilion 15', price: 699.00, thumbnail: 'https://cdn.dummyjson.com/products/images/laptops/Huawei%20MatePad%20SE%2010.4-Inch/1.png' },
  { title: 'Tablet Samsung Galaxy Tab S9', price: 899.00, thumbnail: 'https://cdn.dummyjson.com/products/images/tablets/Samsung%20Galaxy%20Tab%20S9/1.png' },
  { title: 'Reloj inteligente Apple Watch Ultra 2', price: 799.00, thumbnail: 'https://cdn.dummyjson.com/products/images/mens-watches/Apple%20Watch%20Series%209%20Aluminum/1.png' },
  { title: 'Perfume Gucci Bloom', price: 89.99, thumbnail: 'https://cdn.dummyjson.com/products/images/fragrances/Gucci%20Bloom%20Eau%20de/1.png' },
  { title: 'Zapatillas Nike Air Max 270', price: 149.99, thumbnail: 'https://cdn.dummyjson.com/products/images/mens-shoes/Nike%20Air%20Max%20270%20SE/1.png' },
  { title: 'Camiseta Polo Ralph Lauren', price: 79.99, thumbnail: 'https://cdn.dummyjson.com/products/images/tops/Polo%20collar%20t-shirt/1.png' },
  { title: 'Sofá esquinero moderno', price: 849.00, thumbnail: 'https://cdn.dummyjson.com/products/images/furniture/Bedside%20Table%20African%20Cherry/1.png' },
  { title: 'Cosmética L\'Oréal Revitalift', price: 29.99, thumbnail: 'https://cdn.dummyjson.com/products/images/skin-care/Essence%20Skin%20Care%20Cream/1.png' },
  { title: 'Bolso de piel marrón elegante', price: 199.00, thumbnail: 'https://cdn.dummyjson.com/products/images/womens-bags/Chanel%20Classic%20Flap%20Bag/1.png' },
  { title: 'Gafas de sol Ray-Ban Aviator', price: 139.00, thumbnail: 'https://cdn.dummyjson.com/products/images/sunglasses/Gradient%20Sunglasses/1.png' },
  { title: 'Collar de plata con colgante', price: 59.99, thumbnail: 'https://cdn.dummyjson.com/products/images/womens-jewellery/Diamond%20Necklace/1.png' },
  { title: 'Smartphone Google Pixel 8', price: 699.00, thumbnail: 'https://cdn.dummyjson.com/products/images/smartphones/Google%20Pixel%208/1.png' },
  { title: 'Portátil Dell XPS 15', price: 1599.00, thumbnail: 'https://cdn.dummyjson.com/products/images/laptops/Lenovo%20IdeaPad%20Slim%205i/1.png' },
  { title: 'Zapatillas Adidas Ultraboost 22', price: 179.99, thumbnail: 'https://cdn.dummyjson.com/products/images/mens-shoes/Adidas%20Classic%20Sneakers/1.png' },
  { title: 'Consola PlayStation 5', price: 549.99, thumbnail: 'https://cdn.dummyjson.com/products/images/smartphones/OPPOF21%20Pro/1.png' },
  { title: 'Perfume Chanel N°5', price: 129.99, thumbnail: 'https://cdn.dummyjson.com/products/images/fragrances/Chanel%20Coco%20Noir%20Eau%20De/1.png' },
  { title: 'Frigorífico americano Samsung', price: 1199.00, thumbnail: 'https://cdn.dummyjson.com/products/images/furniture/Wooden%20Bathroom%20Sink%20With%20Mirror/1.png' },
  { title: 'Auriculares Sony WH-1000XM5', price: 349.00, thumbnail: 'https://cdn.dummyjson.com/products/images/mens-watches/Brown%20Strap%20Watch/1.png' },
];

// --------------- Game State ---------------
const state = {
  players: [],       // { name: string, score: number }
  products: [],      // { title, price, thumbnail }
  currentRound: 0,
  totalRounds: 0,
  primoIndex: 0,     // index of El Primero, rotates each round
  roundChoices: [],   // { playerIndex, chosenPrice }
  roundPrices: [],    // shuffled prices for the current round (numbers)
  actualPrice: 0,
};

// --------------- DOM Refs ---------------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Setup
const elPlayerCount   = $('#player-count');
const elPlayerNames   = $('#player-names');
const elBtnDecrease   = $('#btn-decrease');
const elBtnIncrease   = $('#btn-increase');
const elBtnStart      = $('#btn-start');

// Loading
const elLoadingStatus = $('#loading-status');

// Game
const elRoundNumber    = $('#round-number');
const elTotalRounds    = $('#total-rounds');
const elPrimoName      = $('#primo-name');
const elProductImage   = $('#product-image');
const elProductTitle   = $('#product-title');
const elCurrentPlayer  = $('#current-player-name');
const elPricesGrid     = $('#prices-grid');
const elBtnReveal      = $('#btn-reveal');
const elBtnToggleScore = $('#btn-toggle-scores');
const elScoreboardPop  = $('#scoreboard-popup');

// Reveal
const elCorrectPrice       = $('#correct-price-display');
const elRevealProductImg   = $('#reveal-product-image');
const elRevealProductTitle = $('#reveal-product-title');
const elRoundResults       = $('#round-results');
const elRevealScoreboard   = $('#reveal-scoreboard');
const elBtnNextRound       = $('#btn-next-round');

// Final
const elFinalPodium = $('#final-podium');
const elFinalScores = $('#final-scores');
const elBtnRestart  = $('#btn-restart');

// --------------- Utility Functions ---------------

/** Format a number as Spanish currency: 1.234,50 € */
function formatSpanishCurrency(n) {
  const fixed = Math.abs(n).toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withDots},${decPart} \u20AC`;
}

/** Generate 11 fake prices within ±40% of the actual price, plus the real one. */
const PRICE_RANGE_FACTOR = 0.4;            // ±40% of the actual price
const MIN_PRICE_DIFF_RATIO = 0.01;         // Minimum 1% gap between any two prices
const FALLBACK_OFFSET_STEP = 0.02;         // Step multiplier for fallback fill
const FALLBACK_OFFSET_BASE = 0.01;         // Base offset for fallback fill
const TOTAL_PRICE_OPTIONS = 12;

function generatePrices(actualPrice) {
  const prices = new Set();
  prices.add(roundToTwo(actualPrice));

  const lo = actualPrice * (1 - PRICE_RANGE_FACTOR);
  const hi = actualPrice * (1 + PRICE_RANGE_FACTOR);

  let attempts = 0;
  while (prices.size < TOTAL_PRICE_OPTIONS && attempts < 200) {
    let fake = lo + Math.random() * (hi - lo);
    fake = roundToTwo(fake);
    // Avoid duplicates and prices that are too close to each other
    let tooClose = false;
    for (const p of prices) {
      if (Math.abs(p - fake) < actualPrice * MIN_PRICE_DIFF_RATIO) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose && fake > 0) {
      prices.add(fake);
    }
    attempts++;
  }

  // If we still don't have 12, fill with slight variations
  while (prices.size < TOTAL_PRICE_OPTIONS) {
    const offset = (prices.size * FALLBACK_OFFSET_STEP + FALLBACK_OFFSET_BASE) * actualPrice * (Math.random() > 0.5 ? 1 : -1);
    prices.add(roundToTwo(actualPrice + offset));
  }

  return shuffle([...prices]);
}

function roundToTwo(n) {
  return Math.round(n * 100) / 100;
}

/** Fisher-Yates shuffle */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Switch to a named screen */
function showScreen(id) {
  $$('.screen').forEach((s) => s.classList.remove('active'));
  $(`#screen-${id}`).classList.add('active');
}

// --------------- Setup Screen ---------------

function renderPlayerInputs() {
  const count = parseInt(elPlayerCount.value, 10) || 12;
  elPlayerNames.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `Jugador ${i + 1}`;
    input.dataset.index = i;
    input.value = state.players[i] ? state.players[i].name : '';
    elPlayerNames.appendChild(input);
  }
}

elBtnDecrease.addEventListener('click', () => {
  const v = parseInt(elPlayerCount.value, 10);
  if (v > 2) { elPlayerCount.value = v - 1; renderPlayerInputs(); }
});

elBtnIncrease.addEventListener('click', () => {
  const v = parseInt(elPlayerCount.value, 10);
  if (v < 16) { elPlayerCount.value = v + 1; renderPlayerInputs(); }
});

elPlayerCount.addEventListener('change', renderPlayerInputs);

// Start Game
elBtnStart.addEventListener('click', async () => {
  // Gather player names
  const inputs = elPlayerNames.querySelectorAll('input');
  state.players = [];
  inputs.forEach((inp, i) => {
    const name = inp.value.trim() || `Jugador ${i + 1}`;
    state.players.push({ name, score: 0 });
  });

  state.totalRounds = state.players.length;
  state.currentRound = 0;
  state.primoIndex = 0;

  showScreen('loading');
  await fetchProducts();
});

// --------------- API / Fetch Products ---------------

const SVG_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns%3D%22http%3A//www.w3.org/2000/svg%22 width%3D%22300%22 height%3D%22300%22 viewBox%3D%220 0 300 300%22%3E%3Crect width%3D%22300%22 height%3D%22300%22 fill%3D%22%23f0f0f0%22/%3E%3Ctext x%3D%2250%25%22 y%3D%2245%25%22 font-size%3D%2264%22 text-anchor%3D%22middle%22 dominant-baseline%3D%22middle%22%3E%F0%9F%9B%8D%3C/text%3E%3Ctext x%3D%2250%25%22 y%3D%2265%25%22 font-size%3D%2218%22 text-anchor%3D%22middle%22 dominant-baseline%3D%22middle%22 fill%3D%22%23999%22%3ESin imagen%3C/text%3E%3C/svg%3E';

async function fetchProducts() {
  elLoadingStatus.textContent = 'Buscando productos destacados…';
  try {
    const resp = await fetch('data/products.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const results = await resp.json();

    if (!Array.isArray(results) || results.length < 12) throw new Error('No hay suficientes productos');

    state.products = results
      .filter((p) => p.price && p.title && p.thumbnail)
      .slice(0, Math.max(state.totalRounds, 16))
      .map((p) => ({
        title: p.title,
        price: Math.round(p.price * 100) / 100,
        thumbnail: p.thumbnail,
      }));

    state.products = shuffle(state.products);

    if (state.products.length < state.totalRounds) throw new Error('Productos insuficientes');
  } catch (err) {
    console.warn('API falló, usando productos de reserva:', err.message);
    elLoadingStatus.textContent = 'Usando productos de reserva…';
    state.products = shuffle([...fallbackProducts]).slice(0, Math.max(state.totalRounds, 16));
    await delay(800);
  }

  startGame();
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

// --------------- Game Logic ---------------

function startGame() {
  showScreen('game');
  elTotalRounds.textContent = state.totalRounds;
  startRound();
}

function startRound() {
  const round = state.currentRound;
  const product = state.products[round];

  state.actualPrice = product.price;
  state.roundPrices = generatePrices(product.price);
  state.roundChoices = [];

  // UI updates
  elRoundNumber.textContent = round + 1;
  elPrimoName.textContent = state.players[state.primoIndex].name;
  elProductImage.onerror = function() { this.onerror = null; this.src = SVG_PLACEHOLDER; };
  elProductImage.src = product.thumbnail;
  elProductImage.alt = product.title;
  elProductTitle.textContent = product.title;

  // Build price buttons
  elPricesGrid.innerHTML = '';
  state.roundPrices.forEach((price, idx) => {
    const btn = document.createElement('button');
    btn.className = 'price-btn';
    btn.dataset.index = idx;
    btn.dataset.price = price;
    btn.textContent = formatSpanishCurrency(price);
    btn.addEventListener('click', () => onPriceClick(btn, price));
    elPricesGrid.appendChild(btn);
  });

  elBtnReveal.classList.add('hidden');
  updateTurnDisplay();
}

function getPlayerOrder() {
  // El Primero goes first, then rotate through all players
  const order = [];
  for (let i = 0; i < state.players.length; i++) {
    order.push((state.primoIndex + i) % state.players.length);
  }
  return order;
}

function updateTurnDisplay() {
  const order = getPlayerOrder();
  const turnIdx = state.roundChoices.length;
  if (turnIdx < state.players.length) {
    const pIdx = order[turnIdx];
    elCurrentPlayer.textContent = state.players[pIdx].name;
  } else {
    elCurrentPlayer.textContent = '—';
  }
}

function onPriceClick(btn, price) {
  if (btn.disabled) return;
  const order = getPlayerOrder();
  const turnIdx = state.roundChoices.length;
  if (turnIdx >= state.players.length) return;

  const playerIdx = order[turnIdx];
  btn.disabled = true;
  btn.classList.add('selected');

  // Show player name on button
  const tag = document.createElement('span');
  tag.className = 'player-tag';
  tag.textContent = state.players[playerIdx].name;
  btn.appendChild(tag);

  state.roundChoices.push({ playerIndex: playerIdx, chosenPrice: price });

  if (state.roundChoices.length >= state.players.length) {
    // All players chose
    elBtnReveal.classList.remove('hidden');
  }
  updateTurnDisplay();
}

// --------------- Reveal ---------------

elBtnReveal.addEventListener('click', () => {
  revealRound();
});

function revealRound() {
  const actual = state.actualPrice;
  const product = state.products[state.currentRound];

  // Highlight correct price button
  const buttons = elPricesGrid.querySelectorAll('.price-btn');
  buttons.forEach((btn) => {
    if (parseFloat(btn.dataset.price) === actual) {
      btn.classList.add('correct-price');
    }
  });

  // Score: sort choices by distance from actual
  const sorted = [...state.roundChoices].sort(
    (a, b) => Math.abs(a.chosenPrice - actual) - Math.abs(b.chosenPrice - actual)
  );

  const pointsMap = [3, 2, 1];
  const roundResultsData = [];

  sorted.forEach((choice, i) => {
    const pts = i < 3 ? pointsMap[i] : 0;
    state.players[choice.playerIndex].score += pts;
    const dist = Math.abs(choice.chosenPrice - actual);
    roundResultsData.push({
      name: state.players[choice.playerIndex].name,
      chosenPrice: choice.chosenPrice,
      distance: dist,
      points: pts,
    });
  });

  // Switch to reveal screen
  showScreen('reveal');

  elCorrectPrice.textContent = formatSpanishCurrency(actual);
  elRevealProductImg.onerror = function() { this.onerror = null; this.src = SVG_PLACEHOLDER; };
  elRevealProductImg.src = product.thumbnail;
  elRevealProductTitle.textContent = product.title;

  // Round results
  const medals = ['🥇', '🥈', '🥉'];
  elRoundResults.innerHTML = roundResultsData
    .map(
      (r, i) => `
      <div class="result-row">
        <span>
          <span class="medal">${i < 3 ? medals[i] : ''}</span>
          ${r.name} — ${formatSpanishCurrency(r.chosenPrice)}
        </span>
        <span class="points">${r.points > 0 ? `+${r.points} pts` : ''}</span>
      </div>`
    )
    .join('');

  // Total scoreboard
  renderScoreboard(elRevealScoreboard);

  // Update next button text
  if (state.currentRound + 1 >= state.totalRounds) {
    elBtnNextRound.textContent = '¡Ver puntuación final!';
  } else {
    elBtnNextRound.textContent = 'Siguiente ronda';
  }
}

function renderScoreboard(container) {
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  container.innerHTML = sorted
    .map(
      (p) => `
    <div class="result-row">
      <span>${p.name}</span>
      <span class="points">${p.score} pts</span>
    </div>`
    )
    .join('');
}

// --------------- Navigation ---------------

elBtnNextRound.addEventListener('click', () => {
  state.currentRound++;
  state.primoIndex = state.currentRound % state.players.length;

  if (state.currentRound >= state.totalRounds) {
    showFinalScreen();
  } else {
    showScreen('game');
    startRound();
  }
});

// --------------- Scoreboard Toggle ---------------

elBtnToggleScore.addEventListener('click', () => {
  if (elScoreboardPop.classList.contains('hidden')) {
    renderScoreboard(elScoreboardPop);
    elScoreboardPop.classList.remove('hidden');
  } else {
    elScoreboardPop.classList.add('hidden');
  }
});

// --------------- Final Screen ---------------

function showFinalScreen() {
  showScreen('final');

  const sorted = [...state.players].sort((a, b) => b.score - a.score);

  // Podium (top 3)
  const podiumClasses = ['first', 'second', 'third'];
  const podiumEmoji = ['🥇', '🥈', '🥉'];
  elFinalPodium.innerHTML = sorted
    .slice(0, 3)
    .map(
      (p, i) => `
    <div class="podium-card ${podiumClasses[i]}">
      <div class="podium-rank">${podiumEmoji[i]}</div>
      <div class="podium-name">${p.name}</div>
      <div class="podium-score">${p.score} puntos</div>
    </div>`
    )
    .join('');

  // Full list
  elFinalScores.innerHTML = sorted
    .map(
      (p, i) => `
    <div class="final-score-row">
      <span>${i + 1}. ${p.name}</span>
      <span class="score-val">${p.score} pts</span>
    </div>`
    )
    .join('');
}

// --------------- Restart ---------------

elBtnRestart.addEventListener('click', () => {
  state.currentRound = 0;
  state.primoIndex = 0;
  state.players.forEach((p) => (p.score = 0));
  showScreen('setup');
  renderPlayerInputs();
});

// --------------- Init ---------------
renderPlayerInputs();
