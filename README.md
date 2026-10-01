# Bro Arcade

A free, no-download collection of browser games — built with plain HTML, CSS, and JavaScript. No frameworks, no build step. Just open `index.html` (or serve the folder) and play.

## Games

| Game | Genre | Controls |
|------|-------|----------|
| Snake | Classics | Arrows / WASD, swipe on touch |
| 2048 | Puzzle | Arrows / WASD, swipe on touch |
| Breakout | Arcade | Mouse / touch, or ← → keys |
| Flappy | Arcade | Click / tap / spacebar |
| Minesweeper | Puzzle | Click to reveal, right-click to flag |
| Memory Match | Puzzle | Click / tap cards |
| Subway Surfers | Arcade (embedded) | Arrows / swipe, space for hoverboard |
| Rooftop Snipers | Arcade (embedded) | W to jump |
| Cookie Clicker | Arcade (embedded) | Click the cookie |
| Cut the Rope | Arcade (embedded) | Swipe to cut ropes |
| Escape Road | Arcade (embedded) | WASD / arrow keys to drive |

High scores are saved per game in the browser's `localStorage` (hand-built games only — embedded titles manage their own saves).

## Run it

```bash
# option 1: just open it
open index.html

# option 2: serve it locally
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Structure

```
index.html          page structure + game modal
css/style.css       all styling
js/main.js          hub logic (cards, search, filters, modal, high scores, starfield)
js/games/snake.js
js/games/g2048.js
js/games/breakout.js
js/games/minesweeper.js
js/games/flappy.js
js/games/memory.js
js/games/embed.js     embedded titles (iframe loader, see below)
embed/subway.html     }
embed/rooftop.html    } game loader pages — each pulls its assets
embed/cookie.html     } from a public CDN mirror at play time
embed/ctr.html        }
embed/escape.html     }
```

Every game registers itself on `window.ArcadeGames` with a `meta` block (title, tagline, category, art, hint) and a `create(stage, ui)` factory returning `{ start, pause, resume, isPaused, destroy }`. To add a game, drop a new file in `js/games/`, include it in `index.html`, and add its id to the `ORDER` list in `js/main.js`.

## A note on third-party games

Games from sites like Poki are proprietary — they can't be legally copied, re-hosted, or hotlinked (and those sites technically block embedding). So the six core games here are original implementations, and the "Want more?" section links out to Poki, itch.io, and CrazyGames.

The five **embedded** titles (Subway Surfers, Rooftop Snipers, Cookie Clicker, Cut the Rope, Escape Road) are a different story: they load at play time from public CDN mirrors of the games, not from this repo. That means this repo doesn't redistribute any game files — but it also means those games only work as long as the mirrors stay up. If a mirror gets taken down, that card will stop loading. They are the original commercial games, not remakes.
