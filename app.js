/* =================================================================
   ¡El Precio Justo! – app.js
   State management, API calls, price generation, and scoring logic
   ================================================================= */

// --------------- Constants ---------------
const API_KEY = '7b7c1a69d95da70eecb1d0080abe23b65e3a23cdea8cf5e14a5127ebdd6d0621';
const API_URL = `https://serpapi.com/search.json?engine=google_shopping&q=productos+destacados+carrefour&location=Spain&gl=es&hl=es&api_key=${API_KEY}`;

// --------------- Fallback Products ---------------
const fallbackProducts = [
  { title: 'Televisor Samsung 55\" 4K UHD', price: 549.99, thumbnail: 'https://via.placeholder.com/300?text=TV+Samsung' },
  { title: 'Cafetera Nespresso Vertuo', price: 129.99, thumbnail: 'https://via.placeholder.com/300?text=Cafetera' },
  { title: 'Robot aspirador Roomba 692', price: 249.00, thumbnail: 'https://via.placeholder.com/300?text=Roomba' },
  { title: 'Auriculares Sony WH-1000XM4', price: 279.99, thumbnail: 'https://via.placeholder.com/300?text=Auriculares' },
  { title: 'Batidora KitchenAid Artisan', price: 399.99, thumbnail: 'https://via.placeholder.com/300?text=Batidora' },
  { title: 'Patinete eléctrico Xiaomi Pro 2', price: 449.00, thumbnail: 'https://via.placeholder.com/300?text=Patinete' },
  { title: 'Tablet Apple iPad 10.2\"', price: 379.00, thumbnail: 'https://via.placeholder.com/300?text=iPad' },
  { title: 'Freidora de aire Cosori 5.5L', price: 99.99, thumbnail: 'https://via.placeholder.com/300?text=Freidora' },
  { title: 'Reloj inteligente Garmin Venu 2', price: 349.99, thumbnail: 'https://via.placeholder.com/300?text=Garmin' },
  { title: 'Altavoz Bluetooth JBL Charge 5', price: 159.00, thumbnail: 'https://via.placeholder.com/300?text=JBL' },
  { title: 'Cámara Canon EOS 2000D', price: 449.99, thumbnail: 'https://via.placeholder.com/300?text=Canon' },
  { title: 'Consola Nintendo Switch OLED', price: 349.99, thumbnail: 'https://via.placeholder.com/300?text=Nintendo' },
  { title: 'Portátil Lenovo IdeaPad 3', price: 499.00, thumbnail: 'https://via.placeholder.com/300?text=Lenovo' },
  { title: 'Plancha de pelo GHD Original', price: 139.00, thumbnail: 'https://via.placeholder.com/300?text=GHD' },
  { title: 'Microondas Teka ML 820 BIS', price: 119.99, thumbnail: 'https://via.placeholder.com/300?text=Microondas' },
  { title: 'Silla gaming Secretlab Titan', price: 389.00, thumbnail: 'https://via.placeholder.com/300?text=Silla' },
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

async function fetchProducts() {
  elLoadingStatus.textContent = 'Buscando productos en Carrefour España…';
  try {
    const resp = await fetch(API_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const results = data.shopping_results || data.inline_shopping_results || [];
    if (results.length < 12) throw new Error('No hay suficientes productos');

    state.products = results
      .filter((r) => r.extracted_price && r.title && r.thumbnail)
      .slice(0, Math.max(state.totalRounds, 12))
      .map((r) => ({
        title: r.title,
        price: parseFloat(r.extracted_price),
        thumbnail: r.thumbnail,
      }));

    if (state.products.length < state.totalRounds) throw new Error('Productos insuficientes');
  } catch (err) {
    console.warn('API falló, usando productos de reserva:', err.message);
    elLoadingStatus.textContent = 'Usando productos de reserva…';
    state.products = shuffle([...fallbackProducts]).slice(0, Math.max(state.totalRounds, 12));
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
