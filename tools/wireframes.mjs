// Generates low-fidelity grayscale phone wireframes into docs/wireframes.
// Usage: node tools/wireframes.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const WIDTH = 390;
export const HEIGHT = 844;
export const OUTPUT_DIR = 'docs/wireframes';

const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const C = {
  ink: '#222222',
  body: '#444444',
  muted: '#777777',
  line: '#BBBBBB',
  fill: '#E6E6E6',
  soft: '#F4F4F4',
  paper: '#FFFFFF',
  dark: '#333333',
  scrim: '#000000',
};

const esc = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function wrap(value, width, size) {
  const maxChars = Math.max(8, Math.floor(width / (size * 0.53)));
  const lines = [];
  let current = '';
  for (const word of String(value).split(' ')) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

const lineHeight = (size) => Math.round(size * 1.35);
const textHeight = (value, width, size) => wrap(value, width, size).length * lineHeight(size);

function text(x, y, value, { size = 14, weight = 400, fill = C.body, anchor = 'start', italic = false, width } = {}) {
  const lines = width ? wrap(value, width, size) : [String(value)];
  const attrs = [
    `x="${x}"`, `y="${y}"`, `font-size="${size}"`,
    weight !== 400 ? `font-weight="${weight}"` : '',
    `fill="${fill}"`,
    anchor !== 'start' ? `text-anchor="${anchor}"` : '',
    italic ? 'font-style="italic"' : '',
  ].filter(Boolean).join(' ');
  if (lines.length === 1) return `<text ${attrs}>${esc(lines[0])}</text>`;
  const spans = lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight(size)}">${esc(line)}</tspan>`)
    .join('');
  return `<text ${attrs}>${spans}</text>`;
}

function rect(x, y, w, h, { fill = 'none', stroke = C.line, r = 8, sw = 1, dash, opacity } = {}) {
  const attrs = [
    `x="${x}"`, `y="${y}"`, `width="${w}"`, `height="${h}"`,
    r ? `rx="${r}"` : '',
    `fill="${fill}"`,
    stroke ? `stroke="${stroke}"` : '',
    stroke && sw !== 1 ? `stroke-width="${sw}"` : '',
    dash ? `stroke-dasharray="${dash}"` : '',
    opacity !== undefined ? `opacity="${opacity}"` : '',
  ].filter(Boolean).join(' ');
  return `<rect ${attrs}/>`;
}

function button(x, y, w, label, { variant = 'secondary', h = 44 } = {}) {
  const center = x + w / 2;
  const baseline = y + h / 2 + 5;
  if (variant === 'primary') {
    return rect(x, y, w, h, { fill: C.dark, stroke: C.dark, r: 10 })
      + text(center, baseline, label, { size: 15, weight: 600, fill: C.paper, anchor: 'middle' });
  }
  if (variant === 'ghost') {
    return text(center, baseline, label, { size: 15, weight: 600, fill: C.ink, anchor: 'middle' });
  }
  return rect(x, y, w, h, { fill: C.paper, stroke: C.ink, r: 10 })
    + text(center, baseline, label, { size: 15, weight: 600, fill: C.ink, anchor: 'middle' });
}

function input(x, y, w, label, value, { placeholder = false, helper, error, h = 44 } = {}) {
  const box = y + 8;
  return [
    text(x, y, label, { size: 12, weight: 600, fill: C.muted }),
    rect(x, box, w, h, { fill: C.paper, stroke: error ? C.ink : C.line, sw: error ? 2 : 1 }),
    text(x + 14, box + h / 2 + 5, value, { size: 15, fill: placeholder ? C.muted : C.ink }),
    error ? text(x, box + h + 20, error, { size: 12, weight: 600, fill: C.ink, width: w }) : '',
    helper ? text(x, box + h + (error ? 40 : 20), helper, { size: 12, fill: C.muted, width: w }) : '',
  ].join('');
}

const chipWidth = (label) => Math.round(label.length * 7.5 + 28);

function chip(x, y, label, { selected = false, disabled = false } = {}) {
  const w = chipWidth(label);
  const style = selected
    ? { fill: C.dark, stroke: C.dark }
    : { fill: C.paper, stroke: disabled ? C.line : C.ink, dash: disabled ? '4 3' : undefined };
  return rect(x, y, w, 34, { ...style, r: 17 })
    + text(x + w / 2, y + 22, label, {
      size: 13, weight: 600, anchor: 'middle', fill: selected ? C.paper : disabled ? C.muted : C.ink,
    });
}

function chips(x, y, maxWidth, items) {
  let cx = x;
  let cy = y;
  const parts = [];
  for (const item of items) {
    const w = chipWidth(item.label);
    if (cx + w > x + maxWidth) {
      cx = x;
      cy += 44;
    }
    parts.push(chip(cx, cy, item.label, item));
    cx += w + 8;
  }
  return parts.join('');
}

function badge(rightX, y, label, { filled = false } = {}) {
  const w = Math.round(label.length * 6.6 + 18);
  const x = rightX - w;
  return rect(x, y, w, 22, { fill: filled ? C.dark : C.paper, stroke: filled ? C.dark : C.muted, r: 11 })
    + text(x + w / 2, y + 15, label, { size: 11, weight: 600, anchor: 'middle', fill: filled ? C.paper : C.body });
}

function statusBar() {
  return text(24, 30, '9:41', { size: 13, weight: 600, fill: C.ink })
    + rect(338, 20, 28, 12, { fill: 'none', stroke: C.ink, r: 3 })
    + rect(341, 23, 18, 6, { fill: C.ink, stroke: null, r: 1 });
}

function header({ title, back = false, large = false, actions = [] }) {
  const parts = [];
  if (back) {
    parts.push(text(18, 80, '‹', { size: 30, fill: C.ink }));
    parts.push(text(42, 78, title, { size: 17, weight: 700, fill: C.ink }));
  } else {
    parts.push(text(20, large ? 84 : 78, title, { size: large ? 28 : 20, weight: 800, fill: C.ink }));
  }
  let x = 370;
  for (const action of [...actions].reverse()) {
    const w = Math.max(46, Math.round(action.label.length * 7 + 16));
    x -= w;
    parts.push(rect(x, 56, w, 30, { fill: C.paper, stroke: C.ink, r: 8 }));
    parts.push(text(x + w / 2, 76, action.label, { size: 12, weight: 600, anchor: 'middle', fill: C.ink }));
    if (action.dot) parts.push(`<circle cx="${x + w - 2}" cy="58" r="5" fill="${C.dark}"/>`);
    x -= 6;
  }
  parts.push(`<line x1="0" y1="98" x2="${WIDTH}" y2="98" stroke="${C.line}"/>`);
  return parts.join('');
}

const section = (y, label) => text(20, y, label, { size: 11, weight: 700, fill: C.muted });

function row(x, y, w, h, { title, subtitle, badge: badgeLabel, badgeFilled = false }) {
  return [
    rect(x, y, w, h, { fill: C.paper, stroke: C.line, r: 10 }),
    text(x + 14, y + 25, title, { size: 15, weight: 600, fill: C.ink }),
    subtitle ? text(x + 14, y + 46, subtitle, { size: 12, fill: C.muted }) : '',
    badgeLabel ? badge(x + w - 12, y + 12, badgeLabel, { filled: badgeFilled }) : '',
  ].join('');
}

function note(x, y, w, value) {
  const h = textHeight(value, w - 24, 12) + 30;
  return rect(x, y, w, h, { fill: '#FAFAFA', stroke: '#999999', dash: '5 4', r: 6 })
    + text(x + 12, y + 15, 'WIREFRAME NOTE', { size: 9, weight: 700, fill: C.muted })
    + text(x + 12, y + 31, value, { size: 12, fill: C.muted, italic: true, width: w - 24 });
}

function variantTag(x, y, label) {
  const w = Math.round(label.length * 6.4 + 16);
  return rect(x, y, w, 18, { fill: '#555555', stroke: null, r: 4 })
    + text(x + 8, y + 13, label, { size: 10, weight: 700, fill: C.paper });
}

const variantPanel = (x, y, w, h, label) =>
  rect(x, y, w, h, { fill: C.soft, stroke: '#999999', dash: '6 4', r: 12 }) + variantTag(x + 12, y + 12, label);

function segmented(x, y, w, items, selectedIndex) {
  const segment = w / items.length;
  const parts = [rect(x, y, w, 36, { fill: C.soft, stroke: C.line, r: 10 })];
  items.forEach((item, index) => {
    const sx = x + index * segment;
    if (index === selectedIndex) parts.push(rect(sx + 3, y + 3, segment - 6, 30, { fill: C.dark, stroke: null, r: 8 }));
    parts.push(text(sx + segment / 2, y + 23, item, {
      size: 13, weight: 600, anchor: 'middle', fill: index === selectedIndex ? C.paper : C.ink,
    }));
  });
  return parts.join('');
}

function radioRow(y, { title, meta, selected = false }) {
  return [
    rect(20, y, 350, 52, { fill: C.paper, stroke: selected ? C.ink : C.line, sw: selected ? 2 : 1, r: 10 }),
    `<circle cx="42" cy="${y + 26}" r="9" fill="none" stroke="${C.ink}" stroke-width="1.5"/>`,
    selected ? `<circle cx="42" cy="${y + 26}" r="5" fill="${C.ink}"/>` : '',
    text(62, y + 23, title, { size: 15, weight: 600, fill: C.ink }),
    text(62, y + 41, meta, { size: 12, fill: C.muted }),
  ].join('');
}

function scrim() {
  return rect(0, 0, WIDTH, HEIGHT, { fill: C.scrim, stroke: null, r: 0, opacity: 0.35 });
}

function sheet(y, title) {
  return rect(0, y, WIDTH, HEIGHT - y + 24, { fill: C.paper, stroke: null, r: 18 })
    + rect(175, y + 8, 40, 5, { fill: '#CCCCCC', stroke: null, r: 2 })
    + text(20, y + 44, title, { size: 19, weight: 700, fill: C.ink })
    + text(370, y + 44, 'Close', { size: 14, weight: 600, fill: C.ink, anchor: 'end' });
}

function walletBackdrop() {
  return [
    statusBar(),
    header({ title: 'Friday party', back: true, actions: [{ label: 'Board' }, { label: 'Chat' }, { label: 'Rules' }, { label: '...' }] }),
    rect(20, 110, 350, 40, { fill: C.soft, stroke: null }),
    ...[176, 256, 336].map((y) => rect(20, y, 350, 72, { fill: C.paper, stroke: C.line, r: 10 })),
  ].join('');
}

function slotCard(y, { slot, state, mission, detail }) {
  const parts = [];
  if (state === 'open') {
    parts.push(rect(20, y, 350, 72, { fill: C.paper, stroke: C.ink, r: 10 }));
    parts.push(text(34, y + 20, `SLOT ${slot}`, { size: 10, weight: 700, fill: C.muted }));
    parts.push(text(34, y + 40, mission, { size: 14, weight: 600, fill: C.ink, width: 230 }));
    parts.push(button(282, y + 18, 76, 'Resolve', { h: 36 }));
  } else if (state === 'empty') {
    parts.push(rect(20, y, 350, 72, { fill: C.paper, stroke: C.ink, dash: '6 4', r: 10 }));
    parts.push(text(34, y + 20, `SLOT ${slot} · EMPTY`, { size: 10, weight: 700, fill: C.muted }));
    parts.push(text(34, y + 46, 'New mission ready', { size: 15, weight: 600, fill: C.ink }));
    parts.push(button(282, y + 18, 76, 'Pick', { variant: 'primary', h: 36 }));
  } else {
    parts.push(rect(20, y, 350, 72, { fill: C.soft, stroke: C.muted, dash: '6 4', r: 10 }));
    parts.push(text(34, y + 20, `SLOT ${slot} · COOLDOWN`, { size: 10, weight: 700, fill: C.muted }));
    parts.push(text(34, y + 42, detail, { size: 14, weight: 600, fill: C.body }));
    parts.push(rect(34, y + 54, 230, 6, { fill: '#DDDDDD', stroke: null, r: 3 }));
    parts.push(rect(34, y + 54, 90, 6, { fill: C.muted, stroke: null, r: 3 }));
    parts.push(variantTag(290, y + 27, 'VARIANT'));
  }
  return parts.join('');
}

function historyRow(y, { status, mission }) {
  return rect(20, y, 350, 48, { fill: C.paper, stroke: C.line, r: 10 })
    + text(34, y + 19, status, { size: 10, weight: 700, fill: C.muted })
    + text(34, y + 37, mission, { size: 13, fill: C.ink });
}

function rankRow(y, { rank, name, score, own = false, h = 44 }) {
  return rect(20, y, 350, h, { fill: own ? C.fill : C.paper, stroke: own ? C.ink : C.line, sw: own ? 2 : 1, r: 10 })
    + `<circle cx="44" cy="${y + h / 2}" r="12" fill="none" stroke="${C.ink}"/>`
    + text(44, y + h / 2 + 4, rank, { size: 12, weight: 700, anchor: 'middle', fill: C.ink })
    + text(68, y + h / 2 + 5, name, { size: 14, weight: own ? 700 : 500, fill: C.ink })
    + text(356, y + h / 2 + 5, score, { size: 14, weight: 700, anchor: 'end', fill: C.ink });
}

function toggle(x, y, on) {
  return rect(x, y, 46, 26, { fill: on ? C.dark : C.fill, stroke: on ? C.dark : C.muted, r: 13 })
    + `<circle cx="${on ? x + 33 : x + 13}" cy="${y + 13}" r="10" fill="${C.paper}" stroke="${on ? C.dark : C.muted}"/>`;
}

function stepper(rightX, y, value) {
  const x = rightX - 112;
  return rect(x, y, 112, 32, { fill: C.paper, stroke: C.ink, r: 8 })
    + `<line x1="${x + 34}" y1="${y}" x2="${x + 34}" y2="${y + 32}" stroke="${C.line}"/>`
    + `<line x1="${x + 78}" y1="${y}" x2="${x + 78}" y2="${y + 32}" stroke="${C.line}"/>`
    + text(x + 17, y + 22, '−', { size: 16, weight: 700, fill: C.ink, anchor: 'middle' })
    + text(x + 56, y + 21, value, { size: 13, weight: 700, fill: C.ink, anchor: 'middle' })
    + text(x + 95, y + 22, '+', { size: 16, weight: 700, fill: C.ink, anchor: 'middle' });
}

// control: 'chevron' (value + ›), 'on'/'off' (toggle), 'stepper' (value in stepper), 'locked' (value + Locked badge)
function settingRow(y, { title, meta, value = '', control = 'chevron', h = 52 }) {
  const locked = control === 'locked';
  const parts = [
    rect(20, y, 350, h, { fill: locked ? C.soft : C.paper, stroke: C.line, dash: locked ? '4 3' : undefined, r: 10 }),
    text(34, meta ? y + 22 : y + h / 2 + 5, title, { size: 14, weight: 600, fill: locked ? C.body : C.ink }),
    meta ? text(34, y + 40, meta, { size: 12, fill: C.muted }) : '',
  ];
  if (control === 'chevron') {
    parts.push(text(338, y + h / 2 + 5, value, { size: 13, weight: 600, fill: C.body, anchor: 'end' }));
    parts.push(text(356, y + h / 2 + 6, '›', { size: 20, fill: C.ink, anchor: 'end' }));
  } else if (control === 'on' || control === 'off') {
    parts.push(toggle(312, y + h / 2 - 13, control === 'on'));
  } else if (control === 'stepper') {
    parts.push(stepper(358, y + h / 2 - 16, value));
  } else if (locked) {
    parts.push(text(290, y + h / 2 + 5, value, { size: 13, weight: 600, fill: C.body, anchor: 'end' }));
    parts.push(badge(358, y + h / 2 - 11, 'Locked'));
  }
  return parts.join('');
}

function frame({ title, description, body }) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="${FONT}" role="img" aria-labelledby="title desc">`,
    `<title id="title">${esc(title)}</title>`,
    `<desc id="desc">${esc(description)}</desc>`,
    rect(0, 0, WIDTH, HEIGHT, { fill: C.paper, stroke: null, r: 0 }),
    body,
    rect(0.5, 0.5, WIDTH - 1, HEIGHT - 1, { fill: 'none', stroke: '#999999', r: 24 }),
    '</svg>',
    '',
  ].join('\n');
}

export const screens = [
  {
    file: '01-home.svg',
    title: 'Home',
    description: 'Default menu: create or join, active and lobby games, past games from device history, and an empty-home variant.',
    body: () => [
      statusBar(),
      header({ title: 'gotcha!', large: true, actions: [{ label: 'My packs' }, { label: 'Rules' }] }),
      button(20, 112, 169, 'Create game', { variant: 'primary' }),
      button(201, 112, 169, 'Join game'),
      section(186, 'ACTIVE & LOBBY GAMES'),
      row(20, 196, 350, 60, { title: 'Friday party', subtitle: 'You: Sam · Host · 1 mission ready', badge: 'Active', badgeFilled: true }),
      row(20, 264, 350, 60, { title: 'Office lunch', subtitle: 'You: Lee · Waiting for host to start', badge: 'Lobby' }),
      row(20, 332, 350, 60, { title: 'Weekend trip', subtitle: 'You: Ari · Next mission in 12m', badge: 'Active', badgeFilled: true }),
      section(420, 'PAST GAMES (SAVED ON THIS DEVICE)'),
      row(20, 430, 350, 60, { title: 'Beach day', subtitle: 'Ended 12 Oct · Score 4 · Rank 2 of 7', badge: 'Sync 6d left' }),
      row(20, 498, 350, 60, { title: 'Birthday', subtitle: 'Ended 3 Oct · Score 2', badge: 'Incomplete' }),
      variantPanel(20, 584, 350, 236, 'VARIANT: EMPTY HOME'),
      text(195, 650, 'No games yet', { size: 18, weight: 700, fill: C.ink, anchor: 'middle' }),
      text(195, 678, 'Host a new game, or join one with', { size: 13, fill: C.muted, anchor: 'middle' }),
      text(195, 696, 'the code your host shares.', { size: 13, fill: C.muted, anchor: 'middle' }),
      button(52, 726, 136, 'Create game', { variant: 'primary', h: 40 }),
      button(202, 726, 136, 'Join game', { h: 40 }),
      text(195, 796, 'Past games appear here after your first game.', { size: 12, fill: C.muted, anchor: 'middle', italic: true }),
    ].join(''),
  },
  {
    file: '02-create-game.svg',
    title: 'Create game',
    description: 'Host chooses a nickname, a single mission pack source and game settings (defaults pre-selected), then creates the lobby.',
    body: () => [
      statusBar(),
      header({ title: 'Create game', back: true }),
      input(20, 126, 350, 'YOUR NICKNAME', 'Sam', { helper: 'Only for this game. Fixed once the game is created.' }),
      section(232, 'MISSION PACK (ONE PER GAME)'),
      segmented(20, 244, 350, ['Built-in', 'My packs', 'Blank'], 0),
      radioRow(292, { title: 'Example social pack', meta: '8 missions', selected: true }),
      radioRow(352, { title: 'Party classics', meta: '40 missions' }),
      radioRow(412, { title: 'Office safe', meta: '30 missions' }),
      rect(20, 476, 350, 108, { fill: C.soft, stroke: C.line, r: 10 }),
      text(34, 500, 'This game gets its own copy', { size: 14, weight: 700, fill: C.ink }),
      text(34, 518, 'You can edit the copy until you start. It freezes when the game starts.', { size: 12, fill: C.body, width: 320 }),
      button(34, 542, 150, 'Edit pack copy', { h: 32 }),
      section(604, 'GAME SETTINGS'),
      settingRow(614, { title: 'Game settings', meta: '5 slots · 5m doubling · anon board', value: 'Defaults', h: 56 }),
      note(20, 684, 350, 'My packs lists private packs saved on this device; Blank opens an empty draft. Settings start on defaults and stay editable until Start.'),
      button(20, 778, 350, 'Create game', { variant: 'primary', h: 48 }),
    ].join(''),
  },
  {
    file: '03-pack-editor.svg',
    title: 'Pack editor',
    description: 'Host-only editor for the game draft pack or a private saved pack: title, description, ordered missions with a Group OK flag.',
    body: () => [
      statusBar(),
      header({ title: 'Edit pack', back: true, actions: [{ label: 'Done' }] }),
      input(20, 124, 350, 'PACK TITLE', 'Example social pack'),
      input(20, 196, 350, 'DESCRIPTION', 'Party missions for mixed groups'),
      section(282, 'MISSIONS (8)'),
      button(290, 264, 80, '+ Add', { h: 30 }),
      ...[
        ['Get someone to compliment your hair', false],
        ['Get someone to dab', false],
        ['Make someone say moist in a sentence', false],
        ['Start a congo line (min 3 people)', true],
        ['Get someone to tell you their star sign', false],
        ['Get someone to sing Wheels on the Bus', true],
      ].map(([mission, group], index) => {
        const y = 296 + index * 50;
        return rect(20, y, 350, 44, { fill: C.paper, stroke: C.line, r: 8 })
          + text(32, y + 27, '::', { size: 14, weight: 700, fill: C.muted })
          + text(52, y + (group ? 21 : 27), `${index + 1}.`, { size: 13, weight: 700, fill: C.ink })
          + text(74, y + (group ? 21 : 27), mission, { size: 13, fill: C.ink })
          + (group ? text(74, y + 36, 'GROUP OK', { size: 9, weight: 700, fill: C.muted }) : '')
          + text(356, y + 27, 'Edit', { size: 12, weight: 600, fill: C.ink, anchor: 'end' });
      }),
      text(195, 610, '+ 2 more missions', { size: 12, fill: C.muted, anchor: 'middle' }),
      note(20, 624, 350, 'Host only; hidden from players during the game. Starting freezes a snapshot. Swipe to delete, drag :: to reorder. Edit has a "Group target OK" toggle for missions like the congo line.'),
      button(20, 732, 350, 'Save copy to My packs'),
      text(195, 798, 'Optional. Keeps a private copy on this device for future games.', { size: 12, fill: C.muted, anchor: 'middle' }),
    ].join(''),
  },
  {
    file: '04-join-game.svg',
    title: 'Join game',
    description: 'Enter a game code and a nickname unique in that game; shows a nickname-taken error.',
    body: () => [
      statusBar(),
      header({ title: 'Join game', back: true }),
      text(20, 136, 'Ask your host for the game code.', { size: 14, fill: C.body }),
      input(20, 170, 350, 'GAME CODE', 'K7Q2 M9XA', { h: 56 }),
      text(356, 214, 'Paste', { size: 13, weight: 600, fill: C.ink, anchor: 'end' }),
      input(20, 266, 350, 'NICKNAME', 'sam', {
        error: '"Sam" is already taken in this game. Try another.',
        helper: 'Unique in this game, not case-sensitive. Fixed after joining.',
      }),
      note(20, 396, 350, 'You can join a game in its lobby or while it is already active. Late joiners pick from missions still left in the pack, so a hand may stay partly empty.'),
      note(20, 494, 350, 'Other errors use the same inline pattern: code not found, game ended, game expired, offline (joining needs a connection).'),
      button(20, 770, 350, 'Join game', { variant: 'primary', h: 48 }),
    ].join(''),
  },
  {
    file: '05-game-lobby.svg',
    title: 'Game lobby',
    description: 'Game screen in lobby state: join code sharing, roster, settings summary, host-only pack/settings editing and start.',
    body: () => [
      statusBar(),
      header({ title: 'Friday party', back: true, actions: [{ label: 'Rules' }] }),
      badge(150, 112, 'Lobby · not started'),
      rect(20, 146, 350, 112, { fill: C.soft, stroke: C.line, r: 12 }),
      text(195, 172, 'JOIN CODE', { size: 11, weight: 700, fill: C.muted, anchor: 'middle' }),
      text(195, 208, 'K7Q2 M9XA', { size: 30, weight: 800, fill: C.ink, anchor: 'middle' }),
      button(84, 220, 104, 'Copy', { h: 30 }),
      button(202, 220, 104, 'Share', { h: 30 }),
      section(286, 'PLAYERS (4)'),
      ...[['Sam (you)', 'Host'], ['Lee', ''], ['Ari', ''], ['Jo', '']].map(([name, role], index) => {
        const y = 296 + index * 48;
        return rect(20, y, 350, 42, { fill: C.paper, stroke: C.line, r: 10 })
          + `<circle cx="42" cy="${y + 21}" r="11" fill="${C.fill}"/>`
          + text(62, y + 26, name, { size: 14, weight: 600, fill: C.ink })
          + (role ? badge(358, y + 10, role, { filled: true }) : '');
      }),
      section(504, 'PACK & SETTINGS'),
      rect(20, 514, 350, 56, { fill: C.paper, stroke: C.line, r: 10 }),
      text(34, 538, 'Example social pack', { size: 14, weight: 600, fill: C.ink }),
      text(34, 556, '8 missions · host only', { size: 12, fill: C.muted }),
      button(272, 524, 86, 'Edit', { h: 36 }),
      rect(20, 578, 350, 56, { fill: C.paper, stroke: C.line, r: 10 }),
      text(34, 602, 'Game settings', { size: 14, weight: 600, fill: C.ink }),
      text(34, 620, '5 slots · cycle everyone · no end', { size: 12, fill: C.muted }),
      button(272, 588, 86, 'Edit', { h: 36 }),
      note(20, 648, 350, 'Players see View (read-only rules) instead of Edit, no Start, and "Waiting for the host to start". When started, this screen becomes the wallet.'),
      button(20, 752, 350, 'Start game', { variant: 'primary', h: 48 }),
      text(195, 822, 'Late joining is on · no player limit', { size: 12, fill: C.muted, anchor: 'middle' }),
    ].join(''),
  },
  {
    file: '06-wallet.svg',
    title: 'Wallet',
    description: 'Main in-game screen: score, end conditions, mission slots (default five) with open, empty and cooldown states, wallet history, header actions.',
    body: () => [
      statusBar(),
      header({ title: 'Friday party', back: true, actions: [{ label: 'Board' }, { label: 'Chat', dot: true }, { label: 'Rules' }, { label: '...' }] }),
      rect(20, 110, 350, 42, { fill: C.soft, stroke: null, r: 8 }),
      text(34, 137, 'Score 3', { size: 16, weight: 800, fill: C.ink }),
      text(356, 137, 'Ends in 3h 12m · First to 10 pts', { size: 12, fill: C.muted, anchor: 'end' }),
      section(176, 'YOUR MISSIONS (3 OF 5 SLOTS FILLED)'),
      slotCard(186, { slot: 1, state: 'open', mission: 'Get someone to tell you their star sign' }),
      slotCard(266, { slot: 2, state: 'open', mission: 'Get someone to beatbox for 5 seconds' }),
      slotCard(346, { slot: 3, state: 'open', mission: 'Make someone say moist in a sentence' }),
      slotCard(426, { slot: 4, state: 'empty' }),
      slotCard(506, { slot: 5, state: 'cooldown', detail: 'Next mission in 18m 40s' }),
      section(606, 'WALLET HISTORY'),
      historyRow(616, { status: 'COMPLETED · GOT LEE', mission: 'Get someone to dab' }),
      historyRow(670, { status: 'FAILED', mission: 'Start a congo line (min 3 people)' }),
      note(20, 730, 350, 'Board is hidden when the leaderboard is off. "..." holds Game settings (players view only) and the host\'s End game. Slots are a setting (1-10). Other players\' missions are never shown.'),
    ].join(''),
  },
  {
    file: '07-resolve-mission.svg',
    title: 'Resolve mission sheet',
    description: 'Bottom sheet from a wallet card: success with target (Group or player) and optional comment, or failure; irreversible.',
    body: () => [
      walletBackdrop(),
      scrim(),
      sheet(214, 'Resolve mission'),
      rect(20, 274, 350, 50, { fill: C.soft, stroke: C.line, r: 10 }),
      text(34, 304, 'Get someone to tell you their star sign', { size: 14, weight: 600, fill: C.ink }),
      segmented(20, 338, 350, ['Success', 'Fail'], 0),
      text(20, 404, 'Who did you get?', { size: 14, weight: 700, fill: C.ink }),
      chips(20, 416, 350, [
        { label: 'Lee', selected: true }, { label: 'Ari · got', disabled: true },
        { label: 'Jo' }, { label: 'Max · got', disabled: true }, { label: 'Kim' },
      ]),
      text(20, 520, 'Rule: get everyone once before repeating (4 of 6 left).', { size: 12, fill: C.muted, width: 350 }),
      input(20, 556, 350, 'HOW DID YOU PULL IT OFF? (OPTIONAL)', 'Asked what we should all get matching...', { h: 56 }),
      text(20, 650, 'This cannot be undone. The slot starts its cooldown.', { size: 12, weight: 700, fill: C.ink }),
      button(20, 666, 120, 'Cancel', { h: 46 }),
      button(152, 666, 218, 'Confirm success', { variant: 'primary', h: 46 }),
      note(20, 728, 350, 'A Group chip appears only for Group OK missions. The hint follows the target rule. Fail hides target and comment and warns "-1 point" when failure scoring is on.'),
    ].join(''),
  },
  {
    file: '08-mission-offer.svg',
    title: 'Mission offer selection',
    description: 'Choose one of the offered missions (offer size 1-3, default two) for an empty slot, optional reroll, with one-left and pool-exhausted variants.',
    body: () => [
      statusBar(),
      header({ title: 'Pick a mission', back: true, actions: [{ label: 'Reroll · 1 left' }] }),
      text(20, 132, 'Slot 4 · choose one. The other returns to the pool.', { size: 14, fill: C.body }),
      ...[['OPTION A', 'Get someone to sing Wheels on the Bus'], ['OPTION B', 'Get someone to whisper anything in your ear']]
        .map(([label, mission], index) => {
          const y = 150 + index * 160;
          return rect(20, y, 350, 148, { fill: C.paper, stroke: C.ink, r: 14 })
            + text(36, y + 26, label, { size: 11, weight: 700, fill: C.muted })
            + text(36, y + 56, mission, { size: 18, weight: 700, fill: C.ink, width: 318 })
            + button(36, y + 92, 318, 'Choose this mission', { variant: index === 0 ? 'primary' : 'secondary', h: 40 });
        }),
      variantPanel(20, 480, 170, 230, 'VARIANT: ONE LEFT'),
      rect(32, 512, 146, 132, { fill: C.paper, stroke: C.ink, r: 10 }),
      text(44, 538, 'Get someone to beatbox for 5 seconds', { size: 13, weight: 700, fill: C.ink, width: 122 }),
      button(44, 596, 122, 'Choose', { variant: 'primary', h: 34 }),
      text(32, 668, 'Last mission in the pack.', { size: 11, fill: C.muted, width: 146 }),
      variantPanel(200, 480, 170, 230, 'VARIANT: EXHAUSTED'),
      text(212, 534, 'No missions left', { size: 14, weight: 700, fill: C.ink }),
      text(212, 556, 'Every mission in this pack has been handed out. Empty slots stay empty; keep playing the ones you have.', { size: 12, fill: C.body, width: 146 }),
      button(212, 662, 146, 'Back to wallet', { h: 34 }),
      note(20, 726, 350, 'Offer size is a setting (1-3). Reroll swaps the whole offer and shows only when rerolls are on (default 0). If someone claims an option first, show "That mission was just taken" and refresh.'),
    ].join(''),
  },
  {
    file: '09-leaderboard-sheet.svg',
    title: 'Leaderboard sheet',
    description: 'Bottom sheet over the wallet ranking players by score; anonymous aliases by default, with a nicknames-mode variant.',
    body: () => [
      walletBackdrop(),
      scrim(),
      sheet(190, 'Leaderboard'),
      text(20, 262, 'Anonymous · score = points (1 per completed mission)', { size: 12, fill: C.muted }),
      rankRow(276, { rank: '1', name: 'CheeryTiger42', score: '6', h: 40 }),
      rankRow(322, { rank: '2', name: 'RustyFalcon17 (you)', score: '4', own: true, h: 40 }),
      rankRow(368, { rank: '3', name: 'SunnyDolphin83', score: '3', h: 40 }),
      rankRow(414, { rank: '3', name: 'QuietOtter55', score: '3', h: 40 }),
      rankRow(460, { rank: '5', name: 'BraveLynx08', score: '1', h: 40 }),
      text(195, 530, 'Names are anonymous. Keep yours secret!', { size: 13, weight: 600, fill: C.body, anchor: 'middle' }),
      note(20, 548, 350, 'Aliases are random per game. Mode is a setting: anonymous (default), nicknames, or off (Board button hidden). After the game ends everyone sees nicknames.'),
      variantPanel(20, 644, 350, 176, 'VARIANT: NICKNAMES MODE'),
      rankRow(682, { rank: '1', name: 'Lee', score: '6', h: 38 }),
      rankRow(724, { rank: '2', name: 'Sam (you)', score: '4', own: true, h: 38 }),
      rankRow(766, { rank: '3', name: 'Ari', score: '3', h: 38 }),
    ].join(''),
  },
  {
    file: '10-chat-sheet.svg',
    title: 'Chat sheet',
    description: 'Bottom sheet over the wallet with member chat, result posts under the leaderboard identity, and settings-change posts.',
    body: () => {
      const parts = [walletBackdrop(), scrim(), sheet(130, 'Chat')];
      let y = 196;
      const messages = [
        { kind: 'system', label: 'RESULT', body: 'CheeryTiger42 completed "Get someone to dab" and got SunnyDolphin83.', meta: 'Comment: asked about dance crazes' },
        { kind: 'other', author: 'Jo', body: 'who got me earlier??' },
        { kind: 'system', label: 'SETTINGS', body: 'Host changed settings: the game now ends at 11:30 pm.' },
        { kind: 'own', author: 'Sam', body: 'not telling' },
        { kind: 'system', label: 'RESULT', body: 'QuietOtter55 failed "Start a congo line (min 3 people)".' },
      ];
      for (const message of messages) {
        if (message.kind === 'system') {
          const h = textHeight(message.body, 300, 13) + (message.meta ? 42 : 26);
          parts.push(rect(20, y, 350, h, { fill: C.soft, stroke: C.line, dash: '4 3', r: 10 }));
          parts.push(text(34, y + 16, message.label, { size: 9, weight: 700, fill: C.muted }));
          parts.push(text(34, y + 32, message.body, { size: 13, weight: 600, fill: C.ink, width: 300 }));
          if (message.meta) parts.push(text(34, y + h - 12, message.meta, { size: 12, italic: true, fill: C.muted }));
          y += h + 12;
        } else {
          const own = message.kind === 'own';
          const w = 220;
          const x = own ? 370 - w : 20;
          const h = textHeight(message.body, w - 28, 14) + 34;
          parts.push(rect(x, y, w, h, { fill: own ? C.fill : C.paper, stroke: own ? C.ink : C.line, r: 14 }));
          parts.push(text(x + 14, y + 18, message.author, { size: 11, weight: 700, fill: C.muted }));
          parts.push(text(x + 14, y + 36, message.body, { size: 14, fill: C.ink, width: w - 28 }));
          y += h + 12;
        }
      }
      parts.push(note(20, 646, 350, 'Messages show nicknames; result posts use the leaderboard identity (aliases here, nicknames once ended). Chat off = read-only feed of results with no composer.'));
      parts.push(`<line x1="0" y1="752" x2="${WIDTH}" y2="752" stroke="${C.line}"/>`);
      parts.push(rect(20, 768, 262, 44, { fill: C.paper, stroke: C.line, r: 22 }));
      parts.push(text(38, 795, 'Message the group', { size: 14, fill: C.muted }));
      parts.push(button(292, 768, 78, 'Send', { variant: 'primary', h: 44 }));
      return parts.join('');
    },
  },
  {
    file: '11-rules.svg',
    title: 'Rules and help',
    description: 'How to play plus this game\'s actual settings, reachable from home, lobby and wallet.',
    body: () => {
      const parts = [statusBar(), header({ title: 'How to play', back: true })];
      const sections = [
        ['Goal', 'Get other players to do the thing on your secret mission without them realising.'],
        ['Slots', 'You hold up to 5 missions. Pick one of 2 offered missions to fill a slot.'],
        ['Success', 'Mark who you got (or Group, if the mission allows it). Get everyone once before repeating someone.'],
        ['Failure', 'Called out or it did not work? Mark it failed (0 points). Results cannot be undone.'],
        ['Cooldowns', 'Each result empties its slot for a while: 5, 10, 20 min and so on, up to 6 hours.'],
        ['Scores', 'One point per completed mission. The leaderboard uses anonymous names until the end.'],
        ['Secrets', 'Never show your missions. Each mission is handed out only once per game.'],
        ['Ending', 'The host ends the game. Results stay available to sync for 7 days.'],
      ];
      let y = 124;
      parts.push(text(20, y, 'Numbers below are this game\'s settings.', { size: 12, italic: true, fill: C.muted }));
      y += 30;
      for (const [title, body] of sections) {
        parts.push(text(20, y, title, { size: 15, weight: 700, fill: C.ink }));
        parts.push(text(20, y + 20, body, { size: 13, fill: C.body, width: 350 }));
        y += 20 + textHeight(body, 350, 13) + 18;
      }
      parts.push(button(20, y, 350, 'View all game settings', { h: 40 }));
      parts.push(text(195, Math.max(y + 64, 810), 'Honour system: play fair to keep it fun.', { size: 12, italic: true, fill: C.muted, anchor: 'middle' }));
      return parts.join('');
    },
  },
  {
    file: '12-game-ended.svg',
    title: 'Game ended summary',
    description: 'Ended game: end reason, final standings revealed with nicknames, own results, sync window, and opt-in full pack save. Also used for past-game detail.',
    body: () => [
      statusBar(),
      header({ title: 'Beach day', back: true, actions: [{ label: 'Chat' }] }),
      rect(20, 110, 350, 54, { fill: C.soft, stroke: C.line, r: 10 }),
      text(34, 133, 'Lee reached 10 points · ended 12 Oct', { size: 15, weight: 700, fill: C.ink }),
      text(34, 152, 'Results can sync for 6 more days, then stay only on this device.', { size: 12, fill: C.body }),
      section(190, 'FINAL LEADERBOARD · NAMES REVEALED'),
      rankRow(200, { rank: '1', name: 'Lee · was CheeryTiger42', score: '10', h: 38 }),
      rankRow(244, { rank: '2', name: 'Sam (you) · was RustyFalcon17', score: '7', own: true, h: 38 }),
      rankRow(288, { rank: '3', name: 'Ari · was SunnyDolphin83', score: '5', h: 38 }),
      text(195, 344, 'See all 7 players', { size: 13, weight: 600, fill: C.ink, anchor: 'middle' }),
      section(372, 'YOUR MISSIONS'),
      historyRow(382, { status: 'COMPLETED · GOT LEE', mission: 'Get someone to dab' }),
      historyRow(436, { status: 'COMPLETED · GOT GROUP', mission: 'Start a congo line (min 3 people)' }),
      historyRow(490, { status: 'FAILED', mission: 'Get someone to beatbox for 5 seconds' }),
      rect(20, 552, 350, 148, { fill: C.paper, stroke: C.ink, sw: 2, r: 12 }),
      text(36, 580, 'Save this pack?', { size: 16, weight: 700, fill: C.ink }),
      text(36, 602, 'Keep a private copy of all 12 missions for future games. Saving shows you the full list, but never who had which mission.', { size: 12, fill: C.body, width: 318 }),
      button(36, 648, 150, 'Save pack', { variant: 'primary', h: 38 }),
      button(198, 648, 156, 'Not now', { h: 38 }),
      note(20, 716, 350, 'Other end reasons: "Time\'s up" and "Host ended the game". Past games on Home reopen this from device history. Saving and syncing end after 7 days; missing final results show "Incomplete results".'),
    ].join(''),
  },
  {
    file: '13-saved-packs.svg',
    title: 'Saved packs',
    description: 'Private saved packs on this device: use in a new game, edit, delete with confirmation.',
    body: () => [
      statusBar(),
      header({ title: 'My packs', back: true, actions: [{ label: '+ New' }] }),
      text(20, 130, 'Private packs saved on this device.', { size: 14, fill: C.body }),
      ...[
        ['Party classics (my edit)', '40 missions · saved 2 Oct'],
        ['Beach day pack', '12 missions · saved after game 12 Oct'],
        ['Office safe', '30 missions · saved 20 Sep'],
      ].map(([title, meta], index) => {
        const y = 146 + index * 104;
        return rect(20, y, 350, 94, { fill: C.paper, stroke: C.line, r: 12 })
          + text(34, y + 26, title, { size: 15, weight: 700, fill: C.ink })
          + text(34, y + 45, meta, { size: 12, fill: C.muted })
          + button(34, y + 54, 72, 'Use', { variant: 'primary', h: 30 })
          + button(114, y + 54, 64, 'Edit', { h: 30 })
          + button(186, y + 54, 76, 'Delete', { h: 30 });
      }),
      variantPanel(20, 466, 350, 184, 'VARIANT: DELETE CONFIRMATION'),
      rect(40, 496, 310, 140, { fill: C.paper, stroke: C.ink, r: 12 }),
      text(56, 524, 'Delete "Office safe"?', { size: 16, weight: 700, fill: C.ink }),
      text(56, 546, 'Games that already used it keep their own copy. This cannot be undone.', { size: 12, fill: C.body, width: 280 }),
      button(56, 588, 130, 'Cancel', { h: 36 }),
      button(198, 588, 136, 'Delete', { variant: 'primary', h: 36 }),
      note(20, 666, 350, 'Each pack is controlled by a secret key kept on this device. Clearing app data or losing the phone loses access; there is no account recovery. Use starts Create game with a copy of the pack.'),
    ].join(''),
  },
  {
    file: '14-game-settings.svg',
    title: 'Game settings',
    description: 'Settings overview from Create game, lobby or the in-game menu: wallet steppers, rule groups, joining, and the in-play locked variant.',
    body: () => [
      statusBar(),
      header({ title: 'Game settings', back: true, actions: [{ label: 'Reset' }, { label: 'Done' }] }),
      text(20, 124, 'Defaults shown. Changes apply to this game only.', { size: 13, fill: C.body }),
      section(150, 'WALLET'),
      settingRow(160, { title: 'Slots', meta: 'Missions held at once', value: '5', control: 'stepper' }),
      settingRow(218, { title: 'Missions per offer', meta: 'Choices when filling a slot', value: '2', control: 'stepper' }),
      settingRow(276, { title: 'Rerolls per player', meta: 'Swap a mission offer · whole game', value: '0', control: 'stepper' }),
      section(348, 'RULES'),
      settingRow(358, { title: 'Cooldowns', meta: '5m, doubling, cap 6h · fails count' }),
      settingRow(416, { title: 'Targets', meta: 'Cycle everyone' }),
      settingRow(474, { title: 'Scoring & ending', meta: 'Fail = 0 pts · host ends the game' }),
      settingRow(532, { title: 'Leaderboard & chat', meta: 'Anonymous · chat on · full posts' }),
      section(604, 'JOINING'),
      settingRow(614, { title: 'Allow joining after start', control: 'on', h: 46 }),
      settingRow(666, { title: 'Max players', value: 'Unlimited', h: 46 }),
      variantPanel(20, 724, 350, 106, 'VARIANT: DURING PLAY (HOST)'),
      settingRow(758, { title: 'Slots', value: '5', control: 'locked', h: 44 }),
      text(34, 820, 'Live rows stay editable; each change is posted to chat.', { size: 11, fill: C.muted }),
    ].join(''),
  },
  {
    file: '15-cooldown-settings.svg',
    title: 'Cooldown settings',
    description: 'Cooldown base time, scaling (fixed, multiply, add), multiplier or step, cap, failure toggle, sequence preview and cooldowns-off variant.',
    body: () => [
      statusBar(),
      header({ title: 'Cooldowns', back: true, actions: [{ label: 'Done' }] }),
      settingRow(112, { title: 'Base time', meta: '0 turns cooldowns off', value: '5 min', control: 'stepper' }),
      section(186, 'SCALING'),
      segmented(20, 196, 350, ['Fixed', 'Multiply', 'Add'], 1),
      settingRow(244, { title: 'Multiplier', meta: 'Each result multiplies the wait', value: 'x2', control: 'stepper' }),
      text(20, 314, 'Add shows Step (default 5 min) instead. Fixed hides both.', { size: 12, fill: C.muted }),
      settingRow(326, { title: 'Cap', meta: 'Longest single wait (or none)', value: '6 h', control: 'stepper' }),
      settingRow(384, { title: 'Failures advance cooldown', meta: 'Off: only successes count', control: 'on' }),
      section(458, 'PREVIEW · WAIT AFTER EACH RESULT'),
      chips(20, 468, 350, ['5m', '10m', '20m', '40m', '1h 20m', '2h 40m', '5h 20m', '6h', '6h'].map((label) => ({ label }))),
      text(20, 572, 'Several slots can cool down at once; every result moves you to the next wait.', { size: 12, fill: C.body, width: 350 }),
      variantPanel(20, 606, 350, 112, 'VARIANT: COOLDOWNS OFF'),
      settingRow(642, { title: 'Base time', meta: 'Slots refill immediately', value: 'Off', control: 'stepper' }),
      text(34, 710, 'Scaling, cap and preview are hidden.', { size: 11, fill: C.muted }),
      note(20, 732, 350, 'Editable during play by the host. Only cooldowns started after the change use the new times; the change is posted to chat.'),
    ].join(''),
  },
  {
    file: '16-target-settings.svg',
    title: 'Target settings',
    description: 'Repeat rule for who can be named on a success: cycle everyone, X different in blocks, X different sliding, or no restriction.',
    body: () => [
      statusBar(),
      header({ title: 'Targets', back: true, actions: [{ label: 'Done' }] }),
      text(20, 126, 'Who can you name as the person you got?', { size: 14, fill: C.body }),
      radioRow(142, { title: 'Cycle everyone', meta: 'Get every player once, then start again', selected: true }),
      radioRow(202, { title: 'X different, then reset', meta: 'Blocks: hit X people, then the list clears' }),
      radioRow(262, { title: 'Not your last X targets', meta: 'Sliding: your last X cannot repeat' }),
      radioRow(322, { title: 'No restriction', meta: 'Anyone except yourself' }),
      settingRow(394, { title: 'X (different players)', meta: 'Shown only for the two X rules', value: '3', control: 'stepper' }),
      section(474, 'EXAMPLE · NOT YOUR LAST 3'),
      chips(20, 484, 350, [
        { label: 'Lee · recent', disabled: true }, { label: 'Ari · recent', disabled: true },
        { label: 'Jo · recent', disabled: true }, { label: 'Kim' }, { label: 'Max' },
      ]),
      text(20, 584, 'Lee, Ari and Jo were your last 3 targets, so only Kim or Max count now.', { size: 12, fill: C.body, width: 350 }),
      note(20, 626, 350, 'Group is allowed only for missions marked Group OK in the pack and never counts toward these rules. Sliding X is capped at players minus one. Locked once the game starts.'),
    ].join(''),
  },
  {
    file: '17-scoring-ending.svg',
    title: 'Scoring and ending settings',
    description: 'Failure points, negative score toggle, time limit, first-to-X score target and whether reaching it ends the game.',
    body: () => [
      statusBar(),
      header({ title: 'Scoring & ending', back: true, actions: [{ label: 'Done' }] }),
      section(124, 'SCORING'),
      text(20, 148, 'Completed mission = +1 point', { size: 13, fill: C.body }),
      text(20, 178, 'Failed mission', { size: 14, weight: 600, fill: C.ink }),
      segmented(20, 188, 350, ['0 points', '-1 point'], 0),
      settingRow(236, { title: 'Allow negative scores', meta: 'Only with -1. Off: scores stop at 0', control: 'off' }),
      section(314, 'ENDING'),
      text(20, 336, 'The host can always end the game.', { size: 12, fill: C.muted }),
      settingRow(348, { title: 'Time limit', meta: 'Ends at start + limit', value: 'None' }),
      settingRow(406, { title: 'First to X points', meta: 'Winner = first to reach X', value: 'None' }),
      variantPanel(20, 476, 350, 196, 'VARIANT: FIRST TO 10 SET'),
      settingRow(512, { title: 'First to X points', meta: 'Winner = first to reach X', value: '10', control: 'stepper' }),
      settingRow(570, { title: 'Reaching X ends the game', meta: 'Off: play on until host or time', control: 'on' }),
      text(34, 644, 'Lowering X to or below a current score triggers the win at once.', { size: 11, fill: C.muted, width: 320 }),
      note(20, 688, 350, 'Time limit and first-to-X can change during play (a new end time must be in the future). Failure points and negative scores are locked once the game starts.'),
    ].join(''),
  },
  {
    file: '18-leaderboard-chat.svg',
    title: 'Leaderboard and chat settings',
    description: 'Leaderboard mode, player chat, result post style and names, with the irreversible switch-to-nicknames warning variant.',
    body: () => [
      statusBar(),
      header({ title: 'Leaderboard & chat', back: true, actions: [{ label: 'Done' }] }),
      section(124, 'LEADERBOARD DURING PLAY'),
      segmented(20, 134, 350, ['Off', 'Anonymous', 'Nicknames'], 1),
      text(20, 192, 'Full standings with nicknames are always revealed when the game ends.', { size: 12, fill: C.muted, width: 350 }),
      section(236, 'CHAT'),
      settingRow(246, { title: 'Player chat', meta: 'Off: read-only feed of results', control: 'on' }),
      text(20, 324, 'Result posts', { size: 14, weight: 600, fill: C.ink }),
      segmented(20, 334, 350, ['Full mission', 'Generic', 'Off'], 0),
      text(20, 390, 'Generic: "CheeryTiger42 completed a mission". Locked once started.', { size: 12, fill: C.muted, width: 350 }),
      settingRow(420, { title: 'Names in result posts', meta: 'Used when the leaderboard is off', value: 'Aliases' }),
      text(20, 494, 'Otherwise posts follow the leaderboard names.', { size: 12, fill: C.muted }),
      variantPanel(20, 516, 350, 204, 'VARIANT: SWITCH TO NICKNAMES IN PLAY'),
      rect(40, 546, 310, 160, { fill: C.paper, stroke: C.ink, r: 12 }),
      text(56, 574, 'Show real names?', { size: 16, weight: 700, fill: C.ink }),
      text(56, 596, 'Everyone will see who is behind each alias, including earlier result posts. Phones that already loaded names keep them.', { size: 12, fill: C.body, width: 280 }),
      button(56, 656, 130, 'Cancel', { h: 36 }),
      button(198, 656, 136, 'Show names', { variant: 'primary', h: 36 }),
      note(20, 736, 350, 'Leaderboard mode, player chat and post names can change during play and are announced in chat. With chat and result posts both off, Chat is hidden.'),
    ].join(''),
  },
];

export function renderAll() {
  return new Map(screens.map((screen) => [screen.file, frame({
    title: `Gotcha wireframe: ${screen.title}`,
    description: screen.description,
    body: screen.body(),
  })]));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const outDir = path.join(root, OUTPUT_DIR);
  mkdirSync(outDir, { recursive: true });
  for (const [file, svg] of renderAll()) writeFileSync(path.join(outDir, file), svg);
  console.log(`Wrote ${screens.length} wireframes to ${OUTPUT_DIR}`);
}
