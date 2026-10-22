'use strict';

// ===== Tunables (one place to retune the whole game) =====
const BEST_KEY = 'dragon-best';    // localStorage: longest survived time (seconds)
const MUTE_KEY = 'dragon-muted';   // localStorage: sound on/off
const SAVE_KEY = 'dragon-save-v1'; // localStorage: gold, shop upgrades, badges, map

const ARENA = { w: 720, h: 480 };  // play field in CSS pixels

// Base hero stats. Hearts are FIXED at 5. `nova` = damage of the screen-clearing pulse.
const PLAYER_BASE = {
  maxHp: 5, fireRate: 2.5, moveSpeed: 180, projectiles: 1, radius: 16,
  magnet: 18, slow: 0, orbit: 0, damage: 10, starBonus: 0, regen: 0, nova: 0,
  shieldCd: 0, shieldReady: false, shieldTimer: 0,
};

const GEM_XP = 1;                  // base XP each star gives
const TOUCH_DAMAGE = 1;            // hearts lost when a monster touches you
const HIT_COOLDOWN = 0.65;         // seconds of i-frames after a touch (shorter = harder)
const HEART_CHANCE = 0.04;         // base 4 in 100 monsters drop a heart

const PROJECTILE_SPEED = 380;      // px/sec
const PROJECTILE_RADIUS = 6;
const PROJECTILE_LIFE = 1.6;       // seconds before a fireball fizzles

const ORBIT_RADIUS = 46;           // how far Fire-Tornado flames circle out
const ORBIT_SPEED = 2.4;           // radians/sec the flames spin
const ORBIT_HIT_COOLDOWN = 0.25;   // min seconds between one flame hurting one enemy

const NOVA_EVERY = 6;              // seconds between screen-clearing pulses

const SHAKE_ON_HIT = 0.25;         // seconds of screen shake on a player hit
const POP_TIME = 0.18;             // hero squash/stretch duration

const SPAWN_BASE = 1.3;            // seconds between spawns at t=0
const SPAWN_MIN = 0.28;            // fastest the swarm can spawn
const SPAWN_RAMP = 0.014;          // spawn interval shed per second survived

const BOSS_STEP = 5;               // a boss appears every 5 levels
const GOLD_EVERY = 40;             // a gold-coin pile drops every 40 kills

// ===== Registries (one row per entry, auto-wired) =====
// Powers (level-up cards). `world` = the world number (0-based) where it unlocks;
// `rare:true` powers are stronger and appear less often. maxLevel 3 each.
const POWERS = {
  twin:     { id: 'twin',     name: 'Twin Dragons',   emoji: '🐉', world: 0, maxLevel: 3,
              flavor: 'Shoot an extra fireball each level.',
              apply: (s) => { s.player.projectiles += 1; } },
  wings:    { id: 'wings',    name: 'Swift Wings',    emoji: '🪽', world: 0, maxLevel: 3,
              flavor: 'Fly faster each level.',
              apply: (s) => { s.player.moveSpeed += 40; } },
  magnet:   { id: 'magnet',   name: 'Treasure Magnet', emoji: '🧲', world: 0, maxLevel: 3,
              flavor: 'Stars, hearts & coins fly to you from farther.',
              apply: (s) => { s.player.magnet += 46; } },
  armor:    { id: 'armor',    name: 'Dragon Armor',   emoji: '🛡️', world: 0, maxLevel: 3,
              flavor: 'A shield blocks a hit. Recharges faster each level.',
              apply: (s) => { const cds = [9, 7, 4]; s.player.shieldCd = cds[(s.powers.armor || 1) - 1]; s.player.shieldReady = true; s.player.shieldTimer = 0; } },
  might:    { id: 'might',    name: 'Mighty Fire',    emoji: '💥', world: 0, maxLevel: 3,
              flavor: 'Fire hits harder each level.',
              apply: (s) => { s.player.damage += 4; } },
  blaze:    { id: 'blaze',    name: 'Blazing Breath', emoji: '⚡', world: 0, maxLevel: 3,
              flavor: 'Breathe fire faster each level.',
              apply: (s) => { s.player.fireRate += 0.5; } },
  tornado:  { id: 'tornado',  name: 'Fire Tornado',   emoji: '🌪️', world: 1, maxLevel: 3,
              flavor: 'A flame spins around you each level.',
              apply: (s) => { s.player.orbit += 1; } },
  ember:    { id: 'ember',    name: 'Ember Blast',    emoji: '💥', world: 1, rare: true, maxLevel: 3,
              flavor: 'RARE! Bigger damage AND an extra fireball.',
              apply: (s) => { s.player.damage += 4; s.player.projectiles += 1; } },
  frost:    { id: 'frost',    name: 'Frost Breath',   emoji: '❄️', world: 2, maxLevel: 3,
              flavor: 'Slow the swarm more each level.',
              apply: (s) => { s.player.slow += 0.15; } },
  frostnova:{ id: 'frostnova', name: 'Frost Nova',    emoji: '❄️', world: 2, maxLevel: 3,
              flavor: 'Every few seconds a frost wave hurts + slows everyone.',
              apply: (s) => { s.player.nova += 6; s.player.slow += 0.08; } },
  thunder:  { id: 'thunder',  name: 'Thunder Clap',   emoji: '⚡', world: 3, rare: true, maxLevel: 3,
              flavor: 'RARE! A huge zap hits every monster.',
              apply: (s) => { s.player.nova += 12; } },
  star:     { id: 'star',     name: 'Star Shower',    emoji: '⭐', world: 3, maxLevel: 3,
              flavor: 'Stars are worth more XP each level.',
              apply: (s) => { s.player.starBonus += 1; } },
  regrow:   { id: 'regrow',   name: 'Regrowth',       emoji: '🌱', world: 4, maxLevel: 3,
              flavor: 'Slowly heal hearts over time.',
              apply: (s) => { s.player.regen += 1; } },
  sugar:    { id: 'sugar',    name: 'Sugar Rush',     emoji: '🍬', world: 4, maxLevel: 3,
              flavor: 'Move faster AND fire faster.',
              apply: (s) => { s.player.moveSpeed += 30; s.player.fireRate += 0.35; } },
  bubble:   { id: 'bubble',   name: 'Bubble Shield',  emoji: '🫧', world: 5, maxLevel: 3,
              flavor: 'A shield + slow healing.',
              apply: (s) => { s.player.regen += 1; if (s.player.shieldCd === 0) { s.player.shieldCd = 5; s.player.shieldReady = true; } } },
  vine:     { id: 'vine',     name: 'Vine Grab',      emoji: '🌿', world: 6, maxLevel: 3,
              flavor: 'Slow the swarm + heal a little.',
              apply: (s) => { s.player.slow += 0.1; s.player.regen += 1; } },
  cosmic:   { id: 'cosmic',   name: 'Cosmic Power',   emoji: '🌟', world: 7, rare: true, maxLevel: 3,
              flavor: 'RARE! Huge damage + an extra fireball.',
              apply: (s) => { s.player.damage += 8; s.player.projectiles += 1; } },
  meteor:   { id: 'meteor',   name: 'Meteor Storm',   emoji: '☄️', world: 8, rare: true, maxLevel: 3,
              flavor: 'RARE! A meteor blast + a spinning flame.',
              apply: (s) => { s.player.nova += 10; s.player.orbit += 1; } },
  sand:     { id: 'sand',     name: 'Sandstorm',      emoji: '🌪️', world: 9, maxLevel: 3,
              flavor: 'Slow the swarm + a spinning flame.',
              apply: (s) => { s.player.slow += 0.12; s.player.orbit += 1; } },
  prism:    { id: 'prism',    name: 'Prism Burst',    emoji: '🌈', world: 10, rare: true, maxLevel: 3,
              flavor: 'RARE! Extra fireball + spinning flame.',
              apply: (s) => { s.player.projectiles += 1; s.player.orbit += 1; } },
  moonbeam: { id: 'moonbeam', name: 'Moonbeam',       emoji: '🌙', world: 11, maxLevel: 3,
              flavor: 'A moonlight pulse + slow healing.',
              apply: (s) => { s.player.nova += 8; s.player.regen += 1; } },
};

// Fusions — a super power that unlocks when TWO powers are at max level. Pickable once.
const FUSIONS = {
  firestorm: { id: 'firestorm', name: 'Firestorm Dragon', emoji: '🔥',
               requires: ['twin', 'tornado'],
               flavor: 'SUPER! Extra fireballs AND spinning fire.',
               apply: (s) => { s.player.projectiles += 2; s.player.orbit += 2; } },
  iceshield: { id: 'iceshield', name: 'Ice Shield Dragon', emoji: '🧊',
               requires: ['armor', 'frost'],
               flavor: 'SUPER! Fast shield + the swarm nearly freezes.',
               apply: (s) => { s.player.slow += 0.3; s.player.shieldCd = 2; s.player.shieldReady = true; } },
  goldrush:  { id: 'goldrush',  name: 'Gold Rush Dragon',  emoji: '💰',
               requires: ['magnet', 'wings'],
               flavor: 'SUPER! Zoom fast and suck in every coin.',
               apply: (s) => { s.player.moveSpeed += 70; s.player.magnet += 220; } },
  firebreath:{ id: 'firebreath', name: 'Fury Breath', emoji: '🌋',
               requires: ['blaze', 'might'],
               flavor: 'SUPER! Rapid, powerful fire.',
               apply: (s) => { s.player.fireRate += 1; s.player.damage += 8; } },
};

// The shop — permanent upgrades you buy with gold (gold carries between runs).
const SHOP = {
  claw:   { id: 'claw',   name: 'Sharp Claws',  emoji: '🔥', desc: '+2 fireball damage',        cost: [30, 60, 100, 150, 220], max: 5 },
  speed:  { id: 'speed',  name: 'Speedy Wings', emoji: '🪽', desc: '+15 move speed',             cost: [25, 50, 85, 130, 190], max: 5 },
  breath: { id: 'breath', name: 'Quick Breath', emoji: '⚡', desc: '+0.3 fire speed',            cost: [35, 70, 115, 170, 240], max: 5 },
  luck:   { id: 'luck',   name: 'Lucky Hearts', emoji: '🍀', desc: '+4% heart drop chance',      cost: [45, 100, 180], max: 3 },
  gold:   { id: 'gold',   name: 'Gold Finder',  emoji: '💰', desc: '+20% more gold from drops',  cost: [50, 110, 200], max: 3 },
};

// Badges — earn them by playing, then tap one to wear it. Shows in the HUD.
const BADGES = [
  { id: 'hatchling',     emoji: '🐣', name: 'Hatchling',     hint: 'Play your first run' },
  { id: 'firestarter',   emoji: '🔥', name: 'Fire Starter',  hint: 'Reach level 5' },
  { id: 'dragonmaster',  emoji: '🐉', name: 'Dragon Master', hint: 'Reach level 10' },
  { id: 'bosslayer',     emoji: '👑', name: 'Boss Slayer',   hint: 'Beat a boss' },
  { id: 'worldtraveler', emoji: '🌍', name: 'World Traveler', hint: 'Reach world 3' },
  { id: 'legend',        emoji: '🏆', name: 'Legend',        hint: 'Reach level 20' },
  { id: 'cosmic',        emoji: '🌌', name: 'Cosmic Dragon', hint: 'Reach level 30' },
  { id: 'immortal',      emoji: '👑', name: 'Immortal',      hint: 'Reach level 40' },
];

// Enemies. behavior ∈ chase | zigzag. Two per world; later worlds are tougher.
const ENEMIES = {
  rock:      { id: 'rock',      emoji: '🪨', hp: 16, speed: 58,  behavior: 'chase' },
  bat:       { id: 'bat',       emoji: '🦇', hp: 12, speed: 86,  behavior: 'zigzag' },
  lavablob:  { id: 'lavablob',  emoji: '🌋', hp: 24, speed: 62,  behavior: 'chase' },
  ember:     { id: 'ember',     emoji: '🔥', hp: 14, speed: 96,  behavior: 'zigzag' },
  snowman:   { id: 'snowman',   emoji: '⛄', hp: 32, speed: 60,  behavior: 'chase' },
  iceshard:  { id: 'iceshard',  emoji: '❄️', hp: 16, speed: 106, behavior: 'zigzag' },
  cloud:     { id: 'cloud',     emoji: '☁️', hp: 40, speed: 58,  behavior: 'chase' },
  spark:     { id: 'spark',     emoji: '⚡', hp: 18, speed: 116, behavior: 'zigzag' },
  gumdrop:   { id: 'gumdrop',   emoji: '🍬', hp: 48, speed: 64,  behavior: 'chase' },
  cupcake:   { id: 'cupcake',   emoji: '🧁', hp: 20, speed: 112, behavior: 'zigzag' },
  crab:      { id: 'crab',      emoji: '🦀', hp: 56, speed: 66,  behavior: 'chase' },
  octo:      { id: 'octo',      emoji: '🐙', hp: 22, speed: 116, behavior: 'zigzag' },
  snake:     { id: 'snake',     emoji: '🐍', hp: 64, speed: 68,  behavior: 'chase' },
  monkey:    { id: 'monkey',    emoji: '🐒', hp: 24, speed: 122, behavior: 'zigzag' },
  alien:     { id: 'alien',     emoji: '👾', hp: 72, speed: 70,  behavior: 'chase' },
  comet:     { id: 'comet',     emoji: '☄️', hp: 26, speed: 128, behavior: 'zigzag' },
  boulder:   { id: 'boulder',   emoji: '⛰️', hp: 80, speed: 66,  behavior: 'chase' },
  eagle:     { id: 'eagle',     emoji: '🦅', hp: 28, speed: 130, behavior: 'zigzag' },
  scorpion:  { id: 'scorpion',  emoji: '🦂', hp: 90, speed: 68,  behavior: 'chase' },
  cactus:    { id: 'cactus',    emoji: '🌵', hp: 30, speed: 120, behavior: 'zigzag' },
  rainbow:   { id: 'rainbow',   emoji: '🌈', hp: 100, speed: 70, behavior: 'chase' },
  unicorn:   { id: 'unicorn',   emoji: '🦄', hp: 32, speed: 126, behavior: 'zigzag' },
  moonrock:  { id: 'moonrock',  emoji: '🌙', hp: 110, speed: 72, behavior: 'chase' },
  shooting:  { id: 'shooting',  emoji: '🌠', hp: 34, speed: 132, behavior: 'zigzag' },
};

// Bosses — one per world, big and slow, appear every 5 levels.
const BOSSES = {
  rockking:     { id: 'rockking',     name: 'Rock King',     emoji: '👑', hp: 450,  speed: 38, radius: 34 },
  magmadragon:  { id: 'magmadragon',  name: 'Magma Dragon',  emoji: '🐲', hp: 600,  speed: 40, radius: 34 },
  frostgiant:   { id: 'frostgiant',   name: 'Frost Giant',   emoji: '🧊', hp: 750,  speed: 38, radius: 34 },
  stormking:    { id: 'stormking',    name: 'Storm King',    emoji: '🌩️', hp: 900,  speed: 42, radius: 34 },
  donutking:    { id: 'donutking',    name: 'Donut King',    emoji: '🍩', hp: 1050, speed: 42, radius: 34 },
  shark:        { id: 'shark',        name: 'Shark Boss',    emoji: '🦈', hp: 1200, speed: 44, radius: 34 },
  gorilla:      { id: 'gorilla',      name: 'Gorilla King',  emoji: '🦍', hp: 1350, speed: 44, radius: 34 },
  ufo:          { id: 'ufo',          name: 'UFO Boss',      emoji: '🛸', hp: 1500, speed: 46, radius: 34 },
  eagleking:    { id: 'eagleking',    name: 'Eagle King',    emoji: '🦅', hp: 1650, speed: 46, radius: 34 },
  scorpionking: { id: 'scorpionking', name: 'Scorpion King', emoji: '🦂', hp: 1800, speed: 46, radius: 34 },
  rainbowqueen: { id: 'rainbowqueen', name: 'Rainbow Queen', emoji: '🌈', hp: 1950, speed: 48, radius: 34 },
  moonking:     { id: 'moonking',     name: 'Moon King',     emoji: '🌙', hp: 2100, speed: 48, radius: 34 },
};

// Worlds — the adventure. `arena`/`grid` are the floor colours; `enemies` picks the
// spawn pool; `boss` picks the big bad. Loop back after world 12.
const WORLDS = [
  { id: 'castle',   name: 'Castle World',   emoji: '🏰', arena: '#eaf3ff', grid: '#d7e6ff', enemies: ['rock', 'bat'],          boss: 'rockking' },
  { id: 'lava',     name: 'Lava World',     emoji: '🌋', arena: '#ffe9e0', grid: '#ffd3c4', enemies: ['lavablob', 'ember'],    boss: 'magmadragon' },
  { id: 'ice',      name: 'Ice World',      emoji: '❄️', arena: '#e6f6ff', grid: '#c9ecff', enemies: ['snowman', 'iceshard'],  boss: 'frostgiant' },
  { id: 'cloud',    name: 'Cloud World',    emoji: '☁️', arena: '#f3ecff', grid: '#e3d4ff', enemies: ['cloud', 'spark'],        boss: 'stormking' },
  { id: 'candy',    name: 'Candy World',    emoji: '🍭', arena: '#ffeaf5', grid: '#ffd3e8', enemies: ['gumdrop', 'cupcake'],    boss: 'donutking' },
  { id: 'ocean',    name: 'Ocean World',    emoji: '🌊', arena: '#e4f6ff', grid: '#c4ecff', enemies: ['crab', 'octo'],          boss: 'shark' },
  { id: 'jungle',   name: 'Jungle World',   emoji: '🌴', arena: '#ecf9e8', grid: '#d3efcc', enemies: ['snake', 'monkey'],       boss: 'gorilla' },
  { id: 'space',    name: 'Space World',    emoji: '🌌', arena: '#eee9ff', grid: '#dcd2ff', enemies: ['alien', 'comet'],        boss: 'ufo' },
  { id: 'mountain', name: 'Mountain World', emoji: '🏔️', arena: '#eef6ee', grid: '#d8ead4', enemies: ['boulder', 'eagle'],      boss: 'eagleking' },
  { id: 'desert',   name: 'Desert World',   emoji: '🏜️', arena: '#fff3e0', grid: '#ffe2bf', enemies: ['scorpion', 'cactus'],    boss: 'scorpionking' },
  { id: 'rainbow',  name: 'Rainbow World',  emoji: '🌈', arena: '#ffeefc', grid: '#ffd6f2', enemies: ['rainbow', 'unicorn'],    boss: 'rainbowqueen' },
  { id: 'moon',     name: 'Moon World',     emoji: '🌙', arena: '#e9ecff', grid: '#d6dcff', enemies: ['moonrock', 'shooting'],  boss: 'moonking' },
];

// Particle bursts per content id, with a graceful fallback.
const BURSTS = {
  _default: ['🔥', '✨', '💥'],
};

// ===== Pure helpers: clamp + collision/distance math =====
function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}
function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}
function circleHit(ax, ay, ar, bx, by, br) {
  const r = ar + br;
  return dist2(ax, ay, bx, by) <= r * r;
}
function nearestEnemy(x, y, enemies) {
  let best = null, bestD = Infinity;
  for (const e of enemies) {
    const d = dist2(x, y, e.x, e.y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

// ===== Progression: XP → level =====
function xpForLevel(level) {
  return 5 + (level - 1) * 3;
}
function applyXp(state, amount) {
  state.xp += amount;
  let gained = 0;
  while (state.xp >= state.xpToNext) {
    state.xp -= state.xpToNext;
    state.level += 1;
    state.xpToNext = xpForLevel(state.level);
    gained += 1;
  }
  return gained;
}

// ===== Difficulty ramp =====
function spawnInterval(time) {
  return Math.max(SPAWN_MIN, SPAWN_BASE - time * SPAWN_RAMP);
}
// Rounds cleared (worlds beaten) — monsters get a little stronger every round.
function roundScale(state) {
  return state.worldIndex;
}

// ===== Small formatting / record helpers (pure) =====
function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}
function betterBest(prev, time) {
  return Math.max(Math.round(prev || 0), Math.round(time || 0));
}

// ===== Firing & aim (pure) =====
function steer(x, y, tx, ty, speed) {
  const dx = tx - x, dy = ty - y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { vx: 0, vy: 0 };
  return { vx: (dx / len) * speed, vy: (dy / len) * speed };
}
function spawnProjectiles(player, tx, ty) {
  const base = steer(player.x, player.y, tx, ty, PROJECTILE_SPEED);
  const baseAngle = (base.vx === 0 && base.vy === 0) ? 0 : Math.atan2(base.vy, base.vx);
  const shots = [];
  const n = Math.max(1, player.projectiles | 0);
  for (let i = 0; i < n; i++) {
    const off = (n === 1) ? 0 : (i / (n - 1) - 0.5) * 0.3;
    shots.push({
      x: player.x, y: player.y,
      vx: Math.cos(baseAngle + off) * PROJECTILE_SPEED,
      vy: Math.sin(baseAngle + off) * PROJECTILE_SPEED,
      damage: player.damage, radius: PROJECTILE_RADIUS, life: PROJECTILE_LIFE,
    });
  }
  return shots;
}

// ===== Powers: which are available now + offer 3 (pure) =====
// A power is available once you've reached its world (world-gated "different items
// per world") and it isn't maxed yet.
function availablePowerIds(state) {
  const ids = [];
  for (const id in POWERS) {
    const p = POWERS[id];
    if ((p.world == null || p.world <= state.worldIndex) && (state.powers[id] || 0) < p.maxLevel) {
      ids.push(id);
    }
  }
  return ids;
}
function offerUpgrades(state, rng) {
  const r = rng || Math.random;
  const avail = availablePowerIds(state);
  const rareAvail = avail.filter((id) => POWERS[id].rare);
  // shuffle available powers
  for (let i = avail.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = avail[i]; avail[i] = avail[j]; avail[j] = t;
  }
  const picks = avail.slice(0, 3);
  // lucky draw: ~25% chance to swap one card for a rare (stronger) power
  if (rareAvail.length && r() < 0.25) {
    const rareId = rareAvail[Math.floor(r() * rareAvail.length)];
    picks[Math.floor(r() * picks.length)] = rareId;
  }
  const pool = picks.map((id) => ({ kind: 'power', id }));
  for (const id in FUSIONS) {
    const fu = FUSIONS[id];
    if (state.fusions.includes(id)) continue;
    if (fu.requires.every((req) => (state.powers[req] || 0) >= POWERS[req].maxLevel)) {
      pool.push({ kind: 'fusion', id });
    }
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }
  return pool.slice(0, 3);
}
function chooseUpgrade(state, choice) {
  if (!choice) return false;
  if (choice.kind === 'power') {
    const pw = POWERS[choice.id];
    if (!pw) return false;
    state.powers[choice.id] = (state.powers[choice.id] || 0) + 1;
    pw.apply(state);
    return true;
  }
  if (choice.kind === 'fusion') {
    const fu = FUSIONS[choice.id];
    if (!fu || state.fusions.includes(choice.id)) return false;
    state.fusions.push(choice.id);
    fu.apply(state);
    return true;
  }
  return false;
}

// ===== State factory (ONE game-state object) =====
function freshGame(perks) {
  const pk = perks || {};
  const lv = (id) => pk[id] || 0;
  const player = Object.assign({}, PLAYER_BASE, {
    x: ARENA.w / 2, y: ARENA.h / 2,
    damage: PLAYER_BASE.damage + lv('claw') * 2,
    moveSpeed: PLAYER_BASE.moveSpeed + lv('speed') * 15,
    fireRate: PLAYER_BASE.fireRate + lv('breath') * 0.3,
    hp: PLAYER_BASE.maxHp,
  });
  return {
    status: 'start', time: 0,
    level: 1, xp: 0, xpToNext: xpForLevel(1),
    worldIndex: 0, boss: null, nextBossAt: BOSS_STEP,
    player,
    enemies: [], projectiles: [], orbitals: [], gems: [], hearts: [], goldDrops: [], particles: [], floaters: [],
    shake: 0, spawnTimer: spawnInterval(0), fireTimer: 0, orbitTimer: 0, regenTimer: 0, novaTimer: 0, novaFx: 0,
    heartChance: HEART_CHANCE + lv('luck') * 0.04,
    goldBonus: lv('gold') * 0.2,
    runGold: 0, kills: 0, nextGoldAt: GOLD_EVERY,
    powers: {}, fusions: [], offered: [], pendingLevels: 0,
  };
}

// ===== Persistence (best time + the save file: gold, upgrades, badges, map) =====
function defaultSave() {
  return { gold: 0, ups: {}, badge: 'hatchling', badges: ['hatchling'], bestWorld: 1 };
}
function loadSave() {
  if (typeof localStorage === 'undefined') return defaultSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const d = JSON.parse(raw);
    const s = Object.assign(defaultSave(), d);
    if (!Array.isArray(s.badges)) s.badges = ['hatchling'];
    return s;
  } catch (e) { return defaultSave(); }
}
function saveSave(s) {
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) {}
  }
}
function loadBest() {
  if (typeof localStorage === 'undefined') return 0;
  const n = Number(localStorage.getItem(BEST_KEY));
  return (Number.isFinite(n) && n > 0) ? Math.round(n) : 0;
}
function saveBest(time) {
  const best = betterBest(loadBest(), time);
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
  }
  return best;
}

// ===== Engine: spawning, kills, juice, level-up, bosses, game over =====
function currentWorld(state) {
  return WORLDS[state.worldIndex % WORLDS.length];
}
function spawnEnemy(state, rng) {
  const r = rng || Math.random;
  const pool = currentWorld(state).enemies;
  const def = ENEMIES[pool[Math.floor(r() * pool.length)]];
  const rs = roundScale(state);
  const hpMul = 1 + rs * 0.12;    // monsters get stronger every round
  const spdMul = 1 + rs * 0.02;
  const edge = Math.floor(r() * 4);
  let x, y;
  if (edge === 0) { x = r() * ARENA.w; y = -20; }
  else if (edge === 1) { x = ARENA.w + 20; y = r() * ARENA.h; }
  else if (edge === 2) { x = r() * ARENA.w; y = ARENA.h + 20; }
  else { x = -20; y = r() * ARENA.h; }
  const hp = Math.round(def.hp * hpMul);
  state.enemies.push({
    id: def.id, emoji: def.emoji, behavior: def.behavior,
    x, y, hp, maxHp: hp, speed: def.speed * spdMul,
    xp: GEM_XP, radius: 16, age: 0, orbitHit: 0,
  });
}
// A dead enemy drops a star, may drop a heart, and every GOLD_EVERY kills drops gold.
function killEnemy(state, e) {
  const value = GEM_XP + (state.player.starBonus || 0);
  state.gems.push({ x: e.x, y: e.y, value, radius: 8, age: 0 });
  if (Math.random() < state.heartChance) state.hearts.push({ x: e.x, y: e.y, radius: 9, age: 0 });
  spawnBurst(state, e.x, e.y, e.id);
  state._kill = true;
  state.kills += 1;
  if (state.kills >= state.nextGoldAt) {
    dropGold(state, e.x, e.y, 4, 5);
    state.nextGoldAt += GOLD_EVERY;
    state._golddrop = true;
  }
}
function dropGold(state, x, y, count, value) {
  const v = Math.max(1, Math.round(value * (1 + (state.goldBonus || 0))));
  for (let i = 0; i < count; i++) {
    state.goldDrops.push({ x: x + (Math.random() - 0.5) * 70, y: y + (Math.random() - 0.5) * 70, value: v, age: 0 });
  }
}
function spawnBoss(state) {
  const world = currentWorld(state);
  const def = BOSSES[world.boss];
  const rs = roundScale(state);
  const hp = Math.round(def.hp * (1 + rs * 0.22));
  state.boss = {
    id: def.id, name: def.name, emoji: def.emoji,
    x: ARENA.w / 2, y: -40, hp, maxHp: hp,
    speed: def.speed, radius: def.radius, age: 0, orbitHit: 0,
  };
  spawnFloater(state, ARENA.w / 2, 70, def.name + '!', 'boss');
  state._boss = true;
}
function killBoss(state) {
  const b = state.boss;
  const value = GEM_XP + (state.player.starBonus || 0);
  for (let i = 0; i < 12; i++) {
    state.gems.push({
      x: b.x + (Math.random() - 0.5) * 140, y: b.y + (Math.random() - 0.5) * 140,
      value, radius: 8, age: 0,
    });
  }
  state.hearts.push({ x: b.x, y: b.y, radius: 9, age: 0 });
  dropGold(state, b.x, b.y, 6, 10); // a big pile of gold coins
  spawnBurst(state, b.x, b.y, b.id);
  state.worldIndex += 1;
  state.boss = null;
  spawnFloater(state, b.x, b.y, 'New world! ' + currentWorld(state).emoji, 'world');
  state._worldup = true;
}
function spawnFloater(state, x, y, text, kind) {
  state.floaters.push({ x, y, text, kind: kind || 'dmg', age: 0, life: 0.9 });
}
function spawnBurst(state, x, y, id) {
  const emojis = BURSTS[id] || BURSTS._default;
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI * 2 * i) / 6 + (Math.random() * 0.5);
    const spd = 60 + Math.random() * 80;
    state.particles.push({
      x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      emoji: emojis[i % emojis.length], age: 0, life: 0.7,
    });
  }
}
function hurtHero(state) {
  const p = state.player;
  if (p.invuln > 0) return;
  if (p.shieldReady) {
    p.shieldReady = false;
    p.shieldTimer = 0;
    p.invuln = 0.5;
    spawnFloater(state, p.x, p.y - 24, '🛡️', 'shield');
    state._block = true;
    return;
  }
  p.hp = clamp(p.hp - TOUCH_DAMAGE, 0, p.maxHp);
  p.invuln = HIT_COOLDOWN;
  state.shake = SHAKE_ON_HIT;
  state._hurt = true;
  if (p.hp <= 0) gameOver(state);
}
function levelUp(state, levels) {
  state.pendingLevels = (state.pendingLevels || 0) + (levels - 1);
  const offered = offerUpgrades(state);
  if (offered.length === 0) { state.status = 'playing'; return; }
  state.status = 'levelup';
  state.offered = offered;
  state.player.pop = POP_TIME;
  state._levelup = true;
}
function gameOver(state) {
  state.status = 'over';
  state._over = true;
}

// ===== Engine: the simulation step =====
function update(state, dt, input) {
  if (state.status !== 'playing') return;
  const p = state.player;
  const mv = input || { x: 0, y: 0 };

  state.time += dt;
  if (p.pop > 0) p.pop = Math.max(0, p.pop - dt);
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
  if (state.novaFx > 0) state.novaFx = Math.max(0, state.novaFx - dt * 2);

  // shield recharge
  if (p.shieldCd > 0 && !p.shieldReady) {
    p.shieldTimer += dt;
    if (p.shieldTimer >= p.shieldCd) { p.shieldReady = true; p.shieldTimer = 0; }
  }

  for (const f of state.floaters) { f.age += dt; f.y -= 22 * dt; }
  state.floaters = state.floaters.filter((f) => f.age < f.life);
  for (const t of state.particles) { t.age += dt; t.x += t.vx * dt; t.y += t.vy * dt; t.vy += 120 * dt; }
  state.particles = state.particles.filter((t) => t.age < t.life);
  for (const gm of state.gems) gm.age += dt;

  // --- move the hero ---
  if (mv.x || mv.y) {
    const len = Math.hypot(mv.x, mv.y);
    p.x = clamp(p.x + (mv.x / len) * p.moveSpeed * dt, p.radius, ARENA.w - p.radius);
    p.y = clamp(p.y + (mv.y / len) * p.moveSpeed * dt, p.radius, ARENA.h - p.radius);
  }

  // --- boss schedule (every 5 levels) ---
  if (!state.boss && state.level >= state.nextBossAt) {
    spawnBoss(state);
    state.nextBossAt += BOSS_STEP;
  }

  // --- orbiting flames (Fire Tornado) ---
  state.orbitTimer += dt * ORBIT_SPEED;
  state.orbitals = [];
  const orbitCount = p.orbit;
  for (let i = 0; i < orbitCount; i++) {
    const ang = state.orbitTimer + (i * Math.PI * 2) / orbitCount;
    state.orbitals.push({
      x: p.x + Math.cos(ang) * ORBIT_RADIUS,
      y: p.y + Math.sin(ang) * ORBIT_RADIUS,
    });
  }

  // --- regen (Regrowth power): heal a heart every few seconds ---
  if (p.regen > 0) {
    state.regenTimer += dt;
    const interval = Math.max(4, 10 - 2 * p.regen);
    if (state.regenTimer >= interval) {
      state.regenTimer = 0;
      if (p.hp < p.maxHp) { p.hp += 1; spawnFloater(state, p.x, p.y - 24, '+❤', 'heal'); state._heal = true; }
    }
  }

  // --- spawn director (current world's pool; more monsters per tick each round) ---
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0 || state.enemies.length === 0) {
    const count = Math.min(3, 1 + Math.floor(roundScale(state) / 4));
    for (let i = 0; i < count; i++) spawnEnemy(state);
    state.spawnTimer = spawnInterval(state.time);
  }

  // --- auto-fire at the nearest enemy or the boss ---
  let target = nearestEnemy(p.x, p.y, state.enemies);
  if (state.boss) {
    const bd = dist2(p.x, p.y, state.boss.x, state.boss.y);
    const ed = target ? dist2(p.x, p.y, target.x, target.y) : Infinity;
    if (bd < ed) target = state.boss;
  }
  if (target) {
    p.aim = Math.atan2(target.y - p.y, target.x - p.x);
    state.fireTimer -= dt;
    if (state.fireTimer <= 0) {
      for (const shot of spawnProjectiles(p, target.x, target.y)) state.projectiles.push(shot);
      state.fireTimer = 1 / p.fireRate;
      p.pop = POP_TIME;
      state._fired = true;
    }
  }

  // --- move enemies (slowed by Frost Breath) ---
  for (const e of state.enemies) {
    e.age += dt;
    if (e.orbitHit > 0) e.orbitHit -= dt;
    const spd = e.speed * (1 - p.slow);
    const s = steer(e.x, e.y, p.x, p.y, spd);
    let vx = s.vx, vy = s.vy;
    if (e.behavior === 'zigzag') {
      const perp = Math.atan2(vy, vx) + Math.PI / 2;
      const wob = Math.sin(e.age * 6) * spd * 0.6;
      vx += Math.cos(perp) * wob; vy += Math.sin(perp) * wob;
    }
    e.x += vx * dt; e.y += vy * dt;
  }

  // --- move the boss ---
  if (state.boss) {
    const b = state.boss;
    b.age += dt;
    if (b.orbitHit > 0) b.orbitHit -= dt;
    const s = steer(b.x, b.y, p.x, p.y, b.speed);
    b.x += s.vx * dt; b.y += s.vy * dt;
  }

  // --- move projectiles ---
  for (const pr of state.projectiles) {
    pr.life -= dt;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
  }
  state.projectiles = state.projectiles.filter((pr) =>
    pr.life > 0 && pr.x > -40 && pr.x < ARENA.w + 40 && pr.y > -40 && pr.y < ARENA.h + 40);

  // --- projectiles → enemies ---
  for (const pr of state.projectiles) {
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      if (circleHit(pr.x, pr.y, pr.radius, e.x, e.y, e.radius)) {
        e.hp -= pr.damage;
        pr.life = 0;
        spawnFloater(state, e.x, e.y, String(pr.damage), 'dmg');
        spawnBurst(state, e.x, e.y, e.id);
        state._hit = true;
        if (e.hp <= 0) killEnemy(state, e);
        break;
      }
    }
  }
  state.projectiles = state.projectiles.filter((pr) => pr.life > 0);

  // --- orbiting flames → enemies ---
  for (const o of state.orbitals) {
    for (const e of state.enemies) {
      if (e.hp <= 0 || e.orbitHit > 0) continue;
      if (circleHit(o.x, o.y, 11, e.x, e.y, e.radius)) {
        e.hp -= p.damage;
        e.orbitHit = ORBIT_HIT_COOLDOWN;
        spawnFloater(state, e.x, e.y, String(p.damage), 'dmg');
        state._hit = true;
        if (e.hp <= 0) killEnemy(state, e);
      }
    }
  }

  // --- nova pulse (Frost Nova / Thunder Clap / Meteor / Moonbeam) ---
  if (p.nova > 0) {
    state.novaTimer += dt;
    if (state.novaTimer >= NOVA_EVERY) {
      state.novaTimer = 0;
      state.novaFx = 1;
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        e.hp -= p.nova;
        spawnFloater(state, e.x, e.y, String(p.nova), 'dmg');
        if (e.hp <= 0) killEnemy(state, e);
      }
      if (state.boss) {
        state.boss.hp -= p.nova;
        spawnFloater(state, state.boss.x, state.boss.y, String(p.nova), 'dmg');
        if (state.boss.hp <= 0) killBoss(state);
      }
      state._nova = true;
    }
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);

  // --- projectiles + flames → boss ---
  if (state.boss) {
    const b = state.boss;
    for (const pr of state.projectiles) {
      if (pr.life <= 0) continue;
      if (circleHit(pr.x, pr.y, pr.radius, b.x, b.y, b.radius)) {
        b.hp -= pr.damage;
        pr.life = 0;
        spawnFloater(state, b.x, b.y, String(pr.damage), 'dmg');
        state._hit = true;
        if (b.hp <= 0) { killBoss(state); break; }
      }
    }
  }
  if (state.boss) {
    const b = state.boss;
    for (const o of state.orbitals) {
      if (b.orbitHit > 0) continue;
      if (circleHit(o.x, o.y, 11, b.x, b.y, b.radius)) {
        b.hp -= p.damage;
        b.orbitHit = ORBIT_HIT_COOLDOWN;
        spawnFloater(state, b.x, b.y, String(p.damage), 'dmg');
        state._hit = true;
        if (b.hp <= 0) { killBoss(state); break; }
      }
    }
  }

  // --- enemies → hero ---
  if (p.invuln <= 0) {
    for (const e of state.enemies) {
      if (circleHit(p.x, p.y, p.radius, e.x, e.y, e.radius)) { hurtHero(state); break; }
    }
  }

  // --- boss → hero ---
  if (state.boss && p.invuln <= 0) {
    if (circleHit(p.x, p.y, p.radius, state.boss.x, state.boss.y, state.boss.radius)) hurtHero(state);
  }

  // --- hero → hearts (heal +1 up to 5; a full heart just disappears) ---
  const keptHearts = [];
  for (const h of state.hearts) {
    h.age += dt;
    if (circleHit(p.x, p.y, p.radius + p.magnet, h.x, h.y, h.radius)) {
      if (p.hp < p.maxHp) { p.hp += 1; spawnFloater(state, h.x, h.y, '+❤', 'heal'); state._heal = true; }
    } else keptHearts.push(h);
  }
  state.hearts = keptHearts;

  // --- hero → gold coins (they fly to you, then bank as gold) ---
  const keptGold = [];
  for (const gc of state.goldDrops) {
    gc.age += dt;
    const s = steer(gc.x, gc.y, p.x, p.y, 340);
    gc.x += s.vx * dt; gc.y += s.vy * dt;
    if (circleHit(p.x, p.y, p.radius + 14, gc.x, gc.y, 8)) {
      state.runGold += gc.value;
      spawnFloater(state, gc.x, gc.y, '+' + gc.value + ' 🪙', 'gold');
      state._gold = true;
    } else keptGold.push(gc);
  }
  state.goldDrops = keptGold;

  // --- hero → stars (XP) ---
  let gained = 0;
  const kept = [];
  for (const gm of state.gems) {
    if (circleHit(p.x, p.y, p.radius + p.magnet, gm.x, gm.y, gm.radius)) {
      gained += gm.value;
      spawnFloater(state, gm.x, gm.y, '+' + gm.value, 'xp');
      state._gem = true;
    } else kept.push(gm);
  }
  state.gems = kept;
  if (gained > 0) {
    const levels = applyXp(state, gained);
    if (levels > 0) levelUp(state, levels);
  }
}

// ===== Sound (synthesized Web Audio — NO audio files, ever) =====
const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
let audioCtx = null;
let muted = false;

function loadMute() {
  return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
}
function setMute(on) {
  muted = on;
  if (typeof localStorage !== 'undefined') {
    try { localStorage.setItem(MUTE_KEY, on ? '1' : '0'); } catch (e) {}
  }
  const btn = (typeof document !== 'undefined') && document.getElementById('mute');
  if (btn) { btn.textContent = on ? '🔇' : '🔊'; btn.setAttribute('aria-pressed', String(on)); }
}
function ensureAudio() {
  if (muted || !AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function tone(ctx, freq, start, dur, type, peak) {
  const o = ctx.createOscillator();
  const gain = ctx.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak || 0.14, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(gain); gain.connect(ctx.destination);
  o.start(start); o.stop(start + dur + 0.03);
}
const SFX = {
  fire:    (c, t) => { tone(c, 660, t, 0.07, 'square', 0.08); },
  hit:     (c, t) => { tone(c, 320, t, 0.05, 'triangle', 0.07); },
  kill:    (c, t) => { tone(c, 180, t, 0.12, 'square', 0.12); tone(c, 90, t + 0.06, 0.12, 'square', 0.1); },
  gem:     (c, t) => { tone(c, 880, t, 0.07, 'triangle', 0.1); tone(c, 1320, t + 0.05, 0.08, 'triangle', 0.09); },
  gold:    (c, t) => { tone(c, 1200, t, 0.08, 'triangle', 0.1); },
  golddrop:(c, t) => { tone(c, 880, t, 0.06, 'triangle', 0.09); tone(c, 1175, t + 0.05, 0.08, 'triangle', 0.09); },
  hurt:    (c, t) => { tone(c, 140, t, 0.18, 'sawtooth', 0.12); },
  heal:    (c, t) => { tone(c, 660, t, 0.08, 'sine', 0.1); tone(c, 990, t + 0.07, 0.1, 'sine', 0.1); },
  block:   (c, t) => { tone(c, 220, t, 0.08, 'sine', 0.09); },
  nova:    (c, t) => { tone(c, 90, t, 0.3, 'sawtooth', 0.1); tone(c, 180, t + 0.05, 0.25, 'triangle', 0.1); },
  boss:    (c, t) => { tone(c, 110, t, 0.4, 'sawtooth', 0.12); tone(c, 82, t + 0.1, 0.4, 'sawtooth', 0.1); },
  worldup: (c, t) => { [392, 494, 587, 784].forEach((f, i) => tone(c, f, t + i * 0.08, 0.2, 'triangle', 0.13)); },
  levelup: (c, t) => { [523, 659, 784, 1047].forEach((f, i) => tone(c, f, t + i * 0.07, 0.18, 'triangle', 0.13)); },
  buy:     (c, t) => { tone(c, 660, t, 0.08, 'triangle', 0.12); tone(c, 880, t + 0.08, 0.12, 'triangle', 0.12); },
  over:    (c, t) => { [440, 330, 247].forEach((f, i) => tone(c, f, t + i * 0.12, 0.26, 'sine', 0.13)); },
};
function sfx(name) {
  const ctx = ensureAudio();
  if (!ctx) return;
  (SFX[name] || SFX.fire)(ctx, ctx.currentTime);
}
function consumeAudioEvents(state) {
  if (state._fired)   { sfx('fire');    state._fired = false; }
  if (state._hit)     { sfx('hit');     state._hit = false; }
  if (state._kill)    { sfx('kill');    state._kill = false; }
  if (state._gem)     { sfx('gem');     state._gem = false; }
  if (state._gold)    { sfx('gold');    state._gold = false; }
  if (state._golddrop){ sfx('golddrop');state._golddrop = false; }
  if (state._hurt)    { sfx('hurt');    state._hurt = false; }
  if (state._heal)    { sfx('heal');    state._heal = false; }
  if (state._block)   { sfx('block');   state._block = false; }
  if (state._nova)    { sfx('nova');    state._nova = false; }
  if (state._boss)    { sfx('boss');    state._boss = false; }
  if (state._worldup) { sfx('worldup'); state._worldup = false; }
  if (state._levelup) { sfx('levelup'); state._levelup = false; }
  if (state._over)    { sfx('over');    state._over = false; }
}

// ===== Render (canvas 2D — browser only) =====
function cssVar(name, fallback) {
  if (typeof document === 'undefined' || !document.documentElement) return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function drawHero(ctx, p) {
  const squash = 1 + (p.pop > 0 ? (p.pop / POP_TIME) * 0.3 : 0);
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.aim) ctx.rotate(p.aim);
  ctx.scale(squash, 2 - squash);
  if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.font = '34px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🐉', 0, 0);
  ctx.restore();
}
function render(ctx, state) {
  const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 40 : 0;
  const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 40 : 0;
  const world = currentWorld(state);
  ctx.save();
  ctx.clearRect(0, 0, ARENA.w, ARENA.h);
  ctx.translate(shakeX, shakeY);

  ctx.fillStyle = world.arena;
  ctx.fillRect(-40, -40, ARENA.w + 80, ARENA.h + 80);
  ctx.strokeStyle = world.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= ARENA.w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA.h); ctx.stroke(); }
  for (let y = 0; y <= ARENA.h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA.w, y); ctx.stroke(); }

  // stars (XP)
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const gm of state.gems) ctx.fillText('⭐', gm.x, gm.y);

  // hearts (heal pickups)
  ctx.font = '18px system-ui, sans-serif';
  for (const h of state.hearts) {
    const bob = Math.sin(h.age * 4) * 2;
    ctx.fillText('❤️', h.x, h.y + bob);
  }

  // gold coins (shop money)
  ctx.font = '18px system-ui, sans-serif';
  for (const gc of state.goldDrops) ctx.fillText('🪙', gc.x, gc.y);

  // fireballs
  ctx.font = '15px system-ui, sans-serif';
  for (const pr of state.projectiles) ctx.fillText('🔥', pr.x, pr.y);
  for (const o of state.orbitals) ctx.fillText('🔥', o.x, o.y);

  // enemies
  ctx.font = '28px system-ui, sans-serif';
  for (const e of state.enemies) ctx.fillText(e.emoji, e.x, e.y);

  // boss (big, with an HP bar above)
  if (state.boss) {
    const b = state.boss;
    const bw = 84, bh = 8, by = b.y - b.radius - 18;
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    ctx.fillRect(b.x - bw / 2, by, bw, bh);
    ctx.fillStyle = cssVar('--hp', '#ff5d8f');
    ctx.fillRect(b.x - bw / 2, by, bw * clamp(b.hp / b.maxHp, 0, 1), bh);
    ctx.font = '52px system-ui, sans-serif';
    ctx.fillText(b.emoji, b.x, b.y);
  }

  drawHero(ctx, state.player);

  // shield bubble
  if (state.player.shieldReady) {
    ctx.strokeStyle = cssVar('--accent', '#a855f7');
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.radius + 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  // nova ring (screen-clearing pulse)
  if (state.novaFx > 0) {
    const r = (1 - state.novaFx) * 260 + 20;
    ctx.strokeStyle = 'rgba(168,85,247,' + (state.novaFx * 0.7) + ')';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // particle bursts
  ctx.font = '20px system-ui, sans-serif';
  for (const t of state.particles) {
    ctx.globalAlpha = Math.max(0, 1 - t.age / t.life);
    ctx.fillText(t.emoji, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  // floating numbers
  ctx.font = 'bold 16px system-ui, sans-serif';
  for (const f of state.floaters) {
    ctx.globalAlpha = Math.max(0, 1 - f.age / f.life);
    ctx.fillStyle = (f.kind === 'xp') ? cssVar('--xp', '#ffb340')
      : (f.kind === 'heal') ? cssVar('--hp', '#ff5d8f')
      : (f.kind === 'gold' || f.kind === 'shield') ? cssVar('--xp', '#ffb340')
      : (f.kind === 'boss' || f.kind === 'world') ? cssVar('--accent', '#a855f7')
      : cssVar('--ink', '#43306b');
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ===== HUD + overlays + shop + badges + map (DOM — browser only) =====
function badgeEmoji(id) {
  const b = BADGES.find((x) => x.id === id);
  return b ? b.emoji : '🐣';
}
function updateHud(state) {
  if (typeof document === 'undefined') return;
  const set = (id, fn) => { const el = document.getElementById(id); if (el) fn(el); };
  set('hearts', (el) => {
    let s = '';
    for (let i = 0; i < state.player.maxHp; i++) s += (i < state.player.hp) ? '❤️' : '🤍';
    el.textContent = s;
  });
  set('hud-badge', (el) => { el.textContent = badgeEmoji(save.badge); });
  set('hud-gold', (el) => { el.textContent = '🪙 ' + state.runGold; });
  set('timer', (el) => { el.textContent = formatTime(state.time); });
  set('level', (el) => { el.textContent = 'Lv ' + state.level; });
  set('xp-fill', (el) => { el.style.width = clamp(state.xp / state.xpToNext * 100, 0, 100) + '%'; });
  set('world', (el) => {
    const w = currentWorld(state);
    el.textContent = w.emoji + ' ' + w.name;
  });
  set('skills', (el) => {
    el.innerHTML = '';
    for (const id in state.powers) {
      const pw = POWERS[id];
      const chip = document.createElement('span');
      chip.className = 'skill-chip';
      chip.innerHTML = pw.emoji + '<span class="skill-lv">' + state.powers[id] + '</span>';
      el.appendChild(chip);
    }
    for (const id of state.fusions) {
      const fu = FUSIONS[id];
      const chip = document.createElement('span');
      chip.className = 'skill-chip fusion';
      chip.innerHTML = fu.emoji + '<span class="skill-lv">⭐</span>';
      el.appendChild(chip);
    }
  });
}

function renderBadges() {
  const row = document.getElementById('badges');
  if (!row) return;
  row.innerHTML = '';
  for (const b of BADGES) {
    const owned = save.badges.includes(b.id);
    const btn = document.createElement('button');
    btn.className = 'badge' + (owned ? '' : ' locked') + (save.badge === b.id ? ' active' : '');
    btn.innerHTML =
      '<span class="badge-emoji">' + (owned ? b.emoji : '🔒') + '</span>' +
      '<span class="badge-name">' + (owned ? b.name : '???') + '</span>' +
      '<span class="badge-hint">' + (owned ? b.hint : 'Keep playing!') + '</span>';
    if (owned) {
      btn.addEventListener('click', () => { save.badge = b.id; saveSave(save); renderBadges(); updateHud(state); sfx('buy'); });
    }
    row.appendChild(btn);
  }
}

function renderShop() {
  const list = document.getElementById('shop-list');
  const goldEl = document.getElementById('shop-gold');
  if (!list) return;
  if (goldEl) goldEl.textContent = String(save.gold);
  list.innerHTML = '';
  for (const id in SHOP) {
    const it = SHOP[id];
    const lvl = save.ups[id] || 0;
    const maxed = lvl >= it.max;
    const cost = maxed ? null : it.cost[lvl];
    const row = document.createElement('div');
    row.className = 'shop-row';
    const info = document.createElement('div');
    info.className = 'shop-info';
    info.innerHTML =
      '<span class="shop-emoji">' + it.emoji + '</span>' +
      '<span class="shop-name">' + it.name + '</span>' +
      '<span class="shop-desc">' + it.desc + ' · Lv ' + lvl + '/' + it.max + '</span>';
    row.appendChild(info);
    const btn = document.createElement('button');
    btn.className = 'buy-btn';
    if (maxed) { btn.textContent = 'MAX ✓'; btn.disabled = true; }
    else {
      btn.textContent = '🪙 ' + cost;
      btn.disabled = save.gold < cost;
      btn.addEventListener('click', () => {
        if (save.gold >= cost) { save.gold -= cost; save.ups[id] = lvl + 1; saveSave(save); renderShop(); sfx('buy'); }
      });
    }
    row.appendChild(btn);
    list.appendChild(row);
  }
}

function renderMap() {
  const grid = document.getElementById('map-grid');
  if (!grid) return;
  grid.innerHTML = '';
  WORLDS.forEach((w, i) => {
    const num = i + 1;
    const reached = num <= save.bestWorld;
    const cell = document.createElement('div');
    cell.className = 'map-cell' + (reached ? '' : ' locked');
    cell.innerHTML =
      '<span class="map-num">' + num + '</span>' +
      '<span class="map-emoji">' + (reached ? w.emoji : '🔒') + '</span>' +
      '<span class="map-name">' + (reached ? w.name : '???') + '</span>' +
      '<span class="map-boss">' + (reached ? '👑 ' + BOSSES[w.boss].name : 'Beat the last boss!') + '</span>';
    grid.appendChild(cell);
  });
}

function showOverlays(state, handlers) {
  if (typeof document === 'undefined') return;
  const start = document.getElementById('start-screen');
  const levelup = document.getElementById('levelup');
  const over = document.getElementById('gameover');
  const shop = document.getElementById('shop');
  const map = document.getElementById('map');
  const quit = document.getElementById('quit');
  if (!start || !levelup || !over) return;
  if (shop) shop.hidden = true;
  if (map) map.hidden = true;
  if (quit) quit.hidden = (state.status === 'start' || state.status === 'over');
  start.hidden = state.status !== 'start';
  levelup.hidden = state.status !== 'levelup';
  over.hidden = state.status !== 'over';

  if (state.status === 'start') {
    const g = document.getElementById('start-gold');
    if (g) g.textContent = String(save.gold);
    renderBadges();
  }
  if (state.status === 'levelup') {
    const row = document.getElementById('cards');
    row.innerHTML = '';
    for (const choice of state.offered) {
      const card = document.createElement('button');
      if (choice.kind === 'power') {
        const pw = POWERS[choice.id];
        const lv = (state.powers[choice.id] || 0) + 1;
        const isRare = pw.rare;
        card.className = 'card' + (isRare ? ' rare' : '');
        card.innerHTML =
          '<span class="card-emoji">' + pw.emoji + '</span>' +
          '<span class="card-name">' + pw.name + '</span>' +
          '<span class="card-lv">' + (isRare ? '⭐ RARE · ' : '') + 'Lv ' + (lv - 1) + ' → ' + lv + '</span>' +
          '<span class="card-flavor">' + pw.flavor + '</span>';
      } else {
        const fu = FUSIONS[choice.id];
        card.className = 'card fusion';
        card.innerHTML =
          '<span class="card-emoji">' + fu.emoji + '</span>' +
          '<span class="card-name">' + fu.name + '</span>' +
          '<span class="card-lv">⭐ SUPER POWER</span>' +
          '<span class="card-flavor">' + fu.flavor + '</span>';
      }
      card.addEventListener('click', () => handlers.onChoose(choice));
      row.appendChild(card);
    }
  }
  if (state.status === 'over') {
    const t = document.getElementById('over-time');
    const b = document.getElementById('over-best');
    const w = document.getElementById('over-worlds');
    const g = document.getElementById('earned-gold');
    if (t) t.textContent = formatTime(state.time);
    if (b) b.textContent = formatTime(state.best || loadBest());
    if (w) w.textContent = String(state.worldIndex + 1);
    if (g) g.textContent = String(state.earnedGold || 0);
  }
}

function showShop() {
  const start = document.getElementById('start-screen');
  const levelup = document.getElementById('levelup');
  const over = document.getElementById('gameover');
  const map = document.getElementById('map');
  const shop = document.getElementById('shop');
  if (start) start.hidden = true;
  if (levelup) levelup.hidden = true;
  if (over) over.hidden = true;
  if (map) map.hidden = true;
  if (shop) shop.hidden = false;
  renderShop();
}

function showMap() {
  const start = document.getElementById('start-screen');
  const levelup = document.getElementById('levelup');
  const over = document.getElementById('gameover');
  const shop = document.getElementById('shop');
  const map = document.getElementById('map');
  if (start) start.hidden = true;
  if (levelup) levelup.hidden = true;
  if (over) over.hidden = true;
  if (shop) shop.hidden = true;
  if (map) map.hidden = false;
  renderMap();
}

// At game over: bank best time + gold, unlock map worlds, award badges.
function settleRun(state) {
  if (typeof localStorage === 'undefined') return;
  state.best = saveBest(state.time);
  state.earnedGold = state.runGold;
  save.gold += state.runGold;
  save.bestWorld = Math.max(save.bestWorld || 1, state.worldIndex + 1);
  const earn = (id) => { if (!save.badges.includes(id)) save.badges.push(id); };
  earn('hatchling');
  if (state.level >= 5) earn('firestarter');
  if (state.level >= 10) earn('dragonmaster');
  if (state.worldIndex >= 1) earn('bosslayer');
  if (state.worldIndex >= 2) earn('worldtraveler');
  if (state.level >= 20) earn('legend');
  if (state.level >= 30) earn('cosmic');
  if (state.level >= 40) earn('immortal');
  saveSave(save);
}

// ===== Input + game loop + wiring (browser only) =====
const KEYS_LEFT  = ['ArrowLeft', 'a', 'A'];
const KEYS_RIGHT = ['ArrowRight', 'd', 'D'];
const KEYS_UP    = ['ArrowUp', 'w', 'W'];
const KEYS_DOWN  = ['ArrowDown', 's', 'S'];
const held = new Set();

function inputVector() {
  let x = 0, y = 0;
  if (KEYS_LEFT.some((k) => held.has(k))) x -= 1;
  if (KEYS_RIGHT.some((k) => held.has(k))) x += 1;
  if (KEYS_UP.some((k) => held.has(k))) y -= 1;
  if (KEYS_DOWN.some((k) => held.has(k))) y += 1;
  return { x, y };
}

let state = null;
let save = defaultSave();
let lastStatus = null;

function startRun() {
  state.status = 'playing';
  ensureAudio();
}
function resumeFromLevelUp(choice) {
  chooseUpgrade(state, choice);
  if (state.pendingLevels > 0) {
    state.pendingLevels -= 1;
    const offered = offerUpgrades(state);
    if (offered.length === 0) { state.status = 'playing'; return; }
    state.offered = offered;
    showOverlays(state, { onChoose: resumeFromLevelUp });
  } else {
    state.status = 'playing';
  }
}

function quitRun() {
  if (!state) return;
  if (state.status !== 'playing' && state.status !== 'levelup') return;
  settleRun(state);
  state.status = 'start';
}

function init() {
  const canvas = document.getElementById('arena');
  if (!canvas) return;
  canvas.width = ARENA.w;
  canvas.height = ARENA.h;
  const ctx = canvas.getContext('2d');

  save = loadSave();
  state = freshGame(save.ups);
  muted = loadMute();
  setMute(muted);

  const handlers = {
    onChoose: resumeFromLevelUp,
    onStart: startRun,
    onRestart: () => { state = freshGame(save.ups); startRun(); },
  };

  window.addEventListener('keydown', (e) => {
    if ([].concat(KEYS_LEFT, KEYS_RIGHT, KEYS_UP, KEYS_DOWN).includes(e.key)) e.preventDefault();
    held.add(e.key);
  });
  window.addEventListener('keyup', (e) => held.delete(e.key));

  const startBtn = document.getElementById('start-btn');
  if (startBtn) startBtn.addEventListener('click', handlers.onStart);
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', handlers.onRestart);
  const muteBtn = document.getElementById('mute');
  if (muteBtn) muteBtn.addEventListener('click', () => setMute(!muted));
  const quitBtn = document.getElementById('quit');
  if (quitBtn) quitBtn.addEventListener('click', quitRun);

  const shopBtn = document.getElementById('shop-btn');
  if (shopBtn) shopBtn.addEventListener('click', showShop);
  const overShopBtn = document.getElementById('over-shop-btn');
  if (overShopBtn) overShopBtn.addEventListener('click', showShop);
  const shopBackBtn = document.getElementById('shop-back');
  if (shopBackBtn) shopBackBtn.addEventListener('click', () => showOverlays(state, handlers));

  const mapBtn = document.getElementById('map-btn');
  if (mapBtn) mapBtn.addEventListener('click', showMap);
  const mapBackBtn = document.getElementById('map-back');
  if (mapBackBtn) mapBackBtn.addEventListener('click', () => showOverlays(state, handlers));

  const bestEl = document.getElementById('start-best');
  if (bestEl) bestEl.textContent = formatTime(loadBest());

  let last = (typeof performance !== 'undefined') ? performance.now() : 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(state, dt, inputVector());
    consumeAudioEvents(state);
    render(ctx, state);
    updateHud(state);
    if (state.status !== lastStatus) {
      if (state.status === 'over') settleRun(state);
      showOverlays(state, handlers);
      lastStatus = state.status;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', init);
}

// ===== Node export guard (the browser ignores this; node --test reads it) =====
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ARENA, PLAYER_BASE, GEM_XP, TOUCH_DAMAGE, HEART_CHANCE, PROJECTILE_SPEED, GOLD_EVERY, NOVA_EVERY,
    POWERS, FUSIONS, SHOP, BADGES, ENEMIES, BOSSES, WORLDS, BURSTS,
    clamp, dist2, circleHit, nearestEnemy,
    xpForLevel, applyXp, spawnInterval, roundScale, formatTime, betterBest,
    steer, spawnProjectiles, availablePowerIds, offerUpgrades, chooseUpgrade,
    freshGame, defaultSave, loadSave, saveSave, loadBest, saveBest,
    spawnEnemy, killEnemy, dropGold, spawnBoss, killBoss, spawnFloater, spawnBurst,
    hurtHero, levelUp, gameOver, update,
  };
}
