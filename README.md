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
| Ragdoll Archers | Arcade (embedded) | Aim with mouse, drag and release |
| Gorilla Tag Web | Arcade (embedded) | Click and drag to swing arms |
| Getaway Shootout | Arcade (embedded) | W to jump, E to shoot/grab |
| Run 3 | Arcade (embedded) | Arrows / WASD, space to jump |
| Retro Bowl | Arcade (embedded) | Mouse to aim, click to throw |
| Ragdoll Drop | Arcade (embedded) | Click to drop |
| Sandbox City | Arcade (embedded) | WASD to drive |
| Rooftop Snipers 2 | Arcade (embedded) | W to jump |

High scores are saved per game in the browser's `localStorage` (hand-built games only — embedded titles manage their own saves).

## Features

- **🎮 Games** — 19 titles: six hand-built originals plus thirteen embedded favorites.
- **🤖 Monke AI** — Gemini-powered chatbot with five personas (Monke, Friend, Math, Smart, Essays), image upload, voice dictation, a local math fast-path, chat history, and a 30/day per-browser limit. The API key lives client-side (inherent to browser-called AI); it's a free-tier key with no billing attached.
- **🕵️ Cloak** — disguise the browser tab as Google, Drive, Gmail, or Clever (title + favicon spoofing), a fully fake Google search that never sends real queries, and a configurable panic key that bails to a safe page instantly.
- **🌐 Proxy** — load any URL in a full-width frame.
- **💬 Lobby chat** — realtime Firebase chat with anonymous auth.
- **💭 Comms** — the full Vault Comms system: create/join public servers with text and voice channels, direct messages, friend requests, blocking, image messages, and real WebRTC voice/video calls with Firestore signaling. No login needed — you join as your lobby-chat name via anonymous auth (the vault's password login was deliberately not ported). Shares the same Firebase collections as the vault app, so it's one network.

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
js/tabs.js            tab navigation (Games / AI / Cloak / Proxy / Comms)
js/ai.js              Monke AI chatbot (Gemini, personas, image, dictation)
js/cloak.js           tab disguise + fake Google search + panic key
js/proxy.js           proxy URL loader
js/comms.js           Vault Comms port (servers, DMs, friends, WebRTC voice/video)
js/chat.js            lobby chat (Firebase anonymous auth)
embed/subway.html     }
embed/rooftop.html    } game loader pages — each pulls its assets
embed/cookie.html     } from a public CDN mirror at play time
embed/ctr.html        }
embed/escape.html     }
embed/ragdoll-archers.html  } vault arcade imports — same pattern,
embed/gorilla-tag.html      } full game pages with <base> pointing
embed/getaway-shootout.html } at public CDN mirrors
embed/run3.html             }
embed/retro-bowl.html       }
embed/ragdoll-drop.html     }
embed/sandbox-city.html     }
embed/rooftop-snipers-2.html}
```

Every game registers itself on `window.ArcadeGames` with a `meta` block (title, tagline, category, art, hint) and a `create(stage, ui)` factory returning `{ start, pause, resume, isPaused, destroy }`. To add a game, drop a new file in `js/games/`, include it in `index.html`, and add its id to the `ORDER` list in `js/main.js`.

## A note on third-party games

Games from sites like Poki are proprietary — they can't be legally copied, re-hosted, or hotlinked (and those sites technically block embedding). So the six core games here are original implementations, and the "Want more?" section links out to Poki, itch.io, and CrazyGames.

The five **embedded** titles (Subway Surfers, Rooftop Snipers, Cookie Clicker, Cut the Rope, Escape Road) are a different story: they load at play time from public CDN mirrors of the games, not from this repo. That means this repo doesn't redistribute any game files — but it also means those games only work as long as the mirrors stay up. If a mirror gets taken down, that card will stop loading. They are the original commercial games, not remakes.

The eight **vault arcade imports** (Ragdoll Archers, Gorilla Tag Web, Getaway Shootout, Run 3, Retro Bowl, Ragdoll Drop, Sandbox City, Rooftop Snipers 2) work the same way — full game pages whose `<base>` tag points at a public CDN mirror. Same caveat: they stream assets at play time and depend on those mirrors staying up.
