# ¡El Precio Justo!

A Spanish-language price-guessing party game inspired by *The Price Is Right*.
Players try to guess the real price of products from El Corte Inglés — the
closest guess (without going over) scores the point!

## How to play

1. Open `index.html` in any modern browser (or serve it with a local HTTP server).
2. Enter the players' names and choose the number of rounds.
3. Each round shows a product image and name. Players take turns selecting
   the price they think is correct from 12 options on screen.
4. After everyone has guessed, the real price is revealed and points are awarded.
5. The player with the most points after all rounds wins!

## Refreshing the product database

Products are stored in `data/products.json` and loaded by the game at runtime.
The file is updated by running the included scraper script against
[El Corte Inglés](https://www.elcorteingles.es/).

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer

### Steps

```bash
# 1. Install scraper dependencies (only needed once)
cd scripts
npm install

# 2. Run the scraper – writes ../data/products.json
node scrape-products.js

# 3. Review the output
cat ../data/products.json | head -40

# 4. Commit the updated file
cd ..
git add data/products.json
git commit -m "chore: refresh product database"
git push
```

The scraper targets multiple categories (electronics, fashion, home, beauty,
sports, toys …) and tries to collect at least 50 products. If El Corte Inglés
changes their page structure, see the comments at the top of
`scripts/scrape-products.js` for guidance on updating the selectors.

## Project structure

```
├── index.html          # Game UI
├── style.css           # Styles
├── app.js              # All game logic
├── data/
│   └── products.json   # Product database (committed, refreshed by scraper)
└── scripts/
    ├── package.json        # Scraper dependencies
    └── scrape-products.js  # El Corte Inglés scraper
```

