# Dragon Swarm Survivor — Design

**Date:** 2026-10-21
**Status:** Approved

A top-down "survive the swarm" game (like Vampire Survivors / Blooket Monster Brawl).
You play a baby dragon that auto-breathes fire; you only move. Kill the swarm → grab
gold coins → level up → pick 1 of 3 powers. This is a re-theme + expansion of the
existing Swarm Survivor in `Lesson2-Josephine`.

## Theme

- **Hero:** 🐉 baby dragon (auto-fires fireballs 🔥).
- **Pickups:** gold coins 🪙 give XP; hearts ❤️ heal.
- **Look:** bright, cute, pastel (light blue / pink / purple), rounded corners.
- **Files:** still 3 files, no build step, no audio files, no frameworks.

## Health (hearts)

- Start with **5 hearts** ❤️❤️❤️❤️❤️ (max grows with Dragon Armor).
- Enemy **touch = −1 heart**, with a short i-frame window so you don't lose them all at once.
- **~5% of monsters (5 in 100) drop a heart** that heals +1 (up to max).
- 0 hearts = game over.

## Powers & fusions (the Monster Brawl part)

On level-up you pick **1 of 3 cards**. Powers are *named*, and picking the same one again
**levels it up** (max level 3). Two powers at max level unlock a **fusion** (a super power
that can be picked once per run).

| Power | Emoji | Per level (max 3) |
|---|---|---|
| Twin Dragons | 🐉 | +1 fireball |
| Fire Tornado | 🌪️ | +1 orbiting flame |
| Coin Magnet | 🧲 | +pickup radius |
| Swift Wings | 🪽 | +move speed |
| Dragon Armor | 🛡️ | +1 max heart (and heals 1) |
| Frost Breath | ❄️ | swarm moves slower |

| Fusion | Needs | Effect |
|---|---|---|
| Firestorm Dragon 🔥 | Twin Dragons + Fire Tornado | +2 fireballs, +2 orbiting flames |
| Ice Shield Dragon 🧊 | Dragon Armor + Frost Breath | +2 hearts, big slow |
| Gold Rush Dragon 💰 | Coin Magnet + Swift Wings | zoom fast + huge magnet |

## Worlds & bosses

Every **5 levels** a **boss** appears. Beat it → the **world changes** (new background
colour + new enemy types) and you get a pile of coins + a heart. Survive forever; the
worlds loop back around after world 8 (but tougher each loop).

| Levels | World | Enemies | Boss |
|---|---|---|---|
| 1–5 | 🏰 Castle | 🪨 🦇 | 👑 Rock King |
| 6–10 | 🌋 Lava | 🌋 🔥 | 🐲 Magma Dragon |
| 11–15 | ❄️ Ice | ⛄ ❄️ | 🧊 Frost Giant |
| 16–20 | ☁️ Cloud | ☁️ ⚡ | 🌩️ Storm King |
| 21–25 | 🍭 Candy | 🍬 🧁 | 🍩 Donut King |
| 26–30 | 🌊 Ocean | 🦀 🐙 | 🦈 Shark Boss |
| 31–35 | 🌴 Jungle | 🐍 🐒 | 🦍 Gorilla King |
| 36–40 | 🌌 Space | 👾 ☄️ | 🛸 UFO Boss |

## Architecture

Keep the existing 3-file, pure-core + guarded-edge structure. Extend the registries at the
top of `game.js`:

- `POWERS` — `{ id, name, emoji, maxLevel, flavor, apply(state, level) }`.
- `FUSIONS` — `{ id, name, emoji, requires:[powerA,powerB], flavor, apply(state) }`.
- `ENEMIES` — 16 enemies (2 per world), `{ id, emoji, hp, speed, behavior }`.
- `BOSSES` — 8 bosses, `{ id, name, emoji, hp, speed, radius }`.
- `WORLDS` — 8 worlds, `{ id, name, emoji, arena, grid, enemies[], boss }`.

New engine pieces: orbiting flames (`state.orbitals`), heart pickups (`state.hearts`),
boss state (`state.boss`, `state.nextBossAt`), world pointer (`state.worldIndex`), and a
per-player `powers` / `fusions` map. The upgrade offer becomes
`offerUpgrades(state)` → 3 random cards (unowned powers, not-yet-maxed powers, or eligible
fusions); `chooseUpgrade(state, choice)` applies it.

The canvas reads the **current world's** background/grid colours from `WORLDS`, so each
world re-skins the arena without touching CSS. Sound stays synthesized (new cues: heal,
boss, world-change). Best time persists via `localStorage`.

## Testing

Pure functions (`offerUpgrades`, `chooseUpgrade`, `applyXp`, boss/world scheduling,
collision helpers) stay exportable under the `module.exports` guard so they can be unit
tested with `node --test`.
