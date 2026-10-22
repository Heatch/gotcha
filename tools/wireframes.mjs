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
    description: 'Host chooses a nickname and a single mission pack source, optionally edits the copy, then creates the lobby.',
    body: () => [
      statusBar(),
      header({ title: 'Create game', back: true }),
      input(20, 126, 350, 'YOUR NICKNAME', 'Sam', { helper: 'Only for this game. Fixed once the game is created.' }),
      section(232, 'MISSION PACK (ONE PER GAME)'),
      segmented(20, 244, 350, ['Built-in', 'My packs', 'Blank'], 0),
      radioRow(292, { title: 'Example social pack', meta: '8 missions', selected: true }),
      radioRow(352, { title: 'Party classics', meta: '40 missions' }),
      radioRow(412, { title: 'Office safe', meta: '30 missions' }),
      rect(20, 482, 350, 112, { fill: C.soft, stroke: C.line, r: 10 }),
      text(34, 506, 'This game gets its own copy', { size: 14, weight: 700, fill: C.ink }),
      text(34, 526, 'You can edit the copy until you start. It freezes when the game starts.', { size: 12, fill: C.body, width: 320 }),
      button(34, 546, 150, 'Edit pack copy', { h: 36 }),
      note(20, 612, 350, 'My packs lists private packs saved on this device. Blank opens the pack editor with an empty draft. Only the host can edit.'),
      button(20, 770, 350, 'Create game', { variant: 'primary', h: 48 }),
    ].join(''),
  },
  {
    file: '03-pack-editor.svg',
    title: 'Pack editor',
    description: 'Host-only editor for the game draft pack or a private saved pack: title, description, ordered missions.',
    body: () => [
      statusBar(),
      header({ title: 'Edit pack', back: true, actions: [{ label: 'Done' }] }),
      input(20, 124, 350, 'PACK TITLE', 'Example social pack'),
      input(20, 196, 350, 'DESCRIPTION', 'Party missions for mixed groups'),
      section(282, 'MISSIONS (8)'),
      button(290, 264, 80, '+ Add', { h: 30 }),
      ...[
        'Get someone to compliment your hair',
        'Get someone to dab',
        'Make someone say moist in a sentence',
        'Start a congo line (min 3 people)',
        'Get someone to tell you their star sign',
        'Get someone to sing Wheels on the Bus',
      ].map((mission, index) => {
        const y = 296 + index * 50;
        return rect(20, y, 350, 44, { fill: C.paper, stroke: C.line, r: 8 })
          + text(32, y + 27, '::', { size: 14, weight: 700, fill: C.muted })
          + text(52, y + 27, `${index + 1}.`, { size: 13, weight: 700, fill: C.ink })
          + text(74, y + 27, mission, { size: 13, fill: C.ink })
          + text(356, y + 27, 'Edit', { size: 12, weight: 600, fill: C.ink, anchor: 'end' });
      }),
      text(195, 610, '+ 2 more missions', { size: 12, fill: C.muted, anchor: 'middle' }),
      note(20, 624, 350, 'Host only. Other players never see this list during the game. Starting freezes a snapshot; later edits do not change that game. Swipe or long-press a row to delete; drag :: to reorder.'),
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
    description: 'Game screen in lobby state: join code sharing, roster, host-only pack editing and start.',
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
      section(504, 'PACK'),
      rect(20, 514, 350, 56, { fill: C.paper, stroke: C.line, r: 10 }),
      text(34, 538, 'Example social pack', { size: 14, weight: 600, fill: C.ink }),
      text(34, 556, '8 missions · host only', { size: 12, fill: C.muted }),
      button(272, 524, 86, 'Edit', { h: 36 }),
      note(20, 584, 350, 'Non-host view hides Edit and Start and shows "Waiting for the host to start". Players see nicknames only. When started, this screen becomes the wallet.'),
      button(20, 712, 350, 'Start game', { variant: 'primary', h: 48 }),
      text(195, 784, 'Players can still join after the game starts.', { size: 12, fill: C.muted, anchor: 'middle' }),
    ].join(''),
  },
  {
    file: '06-wallet.svg',
    title: 'Wallet',
    description: 'Main in-game screen: score, five mission slots with open, empty and cooldown states, wallet history, header actions.',
    body: () => [
      statusBar(),
      header({ title: 'Friday party', back: true, actions: [{ label: 'Board' }, { label: 'Chat', dot: true }, { label: 'Rules' }, { label: '...' }] }),
      rect(20, 110, 350, 42, { fill: C.soft, stroke: null, r: 8 }),
      text(34, 137, 'Score 3', { size: 16, weight: 800, fill: C.ink }),
      text(356, 137, 'You: Sam · Game active', { size: 12, fill: C.muted, anchor: 'end' }),
      section(176, 'YOUR MISSIONS (3 OF 5 SLOTS FILLED)'),
      slotCard(186, { slot: 1, state: 'open', mission: 'Get someone to tell you their star sign' }),
      slotCard(266, { slot: 2, state: 'open', mission: 'Get someone to beatbox for 5 seconds' }),
      slotCard(346, { slot: 3, state: 'open', mission: 'Make someone say moist in a sentence' }),
      slotCard(426, { slot: 4, state: 'empty' }),
      slotCard(506, { slot: 5, state: 'cooldown', detail: 'Next mission in 18m 40s' }),
      section(606, 'WALLET HISTORY'),
      historyRow(616, { status: 'COMPLETED · GOT LEE', mission: 'Get someone to dab' }),
      historyRow(670, { status: 'FAILED', mission: 'Start a congo line (min 3 people)' }),
      note(20, 730, 350, 'Resolve opens the resolution sheet. Board and Chat open bottom sheets. "..." holds End game for the host. Other players\' missions are never shown.'),
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
        { label: 'Group' }, { label: 'Lee', selected: true }, { label: 'Ari · got', disabled: true },
        { label: 'Jo' }, { label: 'Max · got', disabled: true }, { label: 'Kim' },
      ]),
      text(20, 520, 'Get everyone once before repeating. Group always OK.', { size: 12, fill: C.muted, width: 350 }),
      input(20, 556, 350, 'HOW DID YOU PULL IT OFF? (OPTIONAL)', 'Asked what we should all get matching...', { h: 56 }),
      text(20, 650, 'This cannot be undone. The slot starts its cooldown.', { size: 12, weight: 700, fill: C.ink }),
      button(20, 666, 120, 'Cancel', { h: 46 }),
      button(152, 666, 218, 'Confirm success', { variant: 'primary', h: 46 }),
      note(20, 728, 350, 'Fail hides target and comment and shows "Confirm fail". Both outcomes post a result to chat and move the card to wallet history.'),
    ].join(''),
  },
  {
    file: '08-mission-offer.svg',
    title: 'Mission offer selection',
    description: 'Choose one of up to two offered missions for an empty slot, with one-left and pool-exhausted variants.',
    body: () => [
      statusBar(),
      header({ title: 'Pick a mission', back: true }),
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
      note(20, 726, 350, 'Offers are not reserved. If another player claims an option first, show "That mission was just taken" and refresh the offer.'),
    ].join(''),
  },
  {
    file: '09-leaderboard-sheet.svg',
    title: 'Leaderboard sheet',
    description: 'Bottom sheet over the wallet ranking random game-local aliases by completed missions.',
    body: () => [
      walletBackdrop(),
      scrim(),
      sheet(190, 'Leaderboard'),
      text(20, 262, 'Score = completed missions', { size: 12, fill: C.muted }),
      rankRow(278, { rank: '1', name: 'CheeryTiger42', score: '6' }),
      rankRow(330, { rank: '2', name: 'RustyFalcon17 (you)', score: '4', own: true }),
      rankRow(382, { rank: '3', name: 'SunnyDolphin83', score: '3' }),
      rankRow(434, { rank: '3', name: 'QuietOtter55', score: '3' }),
      rankRow(486, { rank: '5', name: 'BraveLynx08', score: '1' }),
      rankRow(538, { rank: '6', name: 'MellowCrane71', score: '0' }),
      text(195, 616, 'Names are anonymous. Keep yours secret!', { size: 13, weight: 600, fill: C.body, anchor: 'middle' }),
      note(20, 640, 350, 'Aliases are random per game and differ from roster/chat nicknames. Ties share a rank. In ended games this shows the final standings.'),
    ].join(''),
  },
  {
    file: '10-chat-sheet.svg',
    title: 'Chat sheet',
    description: 'Bottom sheet over the wallet with member chat and system mission results.',
    body: () => {
      const parts = [walletBackdrop(), scrim(), sheet(130, 'Chat')];
      let y = 196;
      const messages = [
        { kind: 'system', body: 'Lee completed "Get someone to dab" and got Ari.', meta: 'Comment: asked about dance crazes' },
        { kind: 'other', author: 'Jo', body: 'who got me earlier??' },
        { kind: 'own', author: 'Sam', body: 'not telling' },
        { kind: 'system', body: 'Ari failed "Start a congo line (min 3 people)".' },
        { kind: 'other', author: 'Ari', body: 'nobody wanted to dance' },
      ];
      for (const message of messages) {
        if (message.kind === 'system') {
          const h = textHeight(message.body, 300, 13) + (message.meta ? 42 : 26);
          parts.push(rect(20, y, 350, h, { fill: C.soft, stroke: C.line, dash: '4 3', r: 10 }));
          parts.push(text(34, y + 16, 'RESULT', { size: 9, weight: 700, fill: C.muted }));
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
      parts.push(note(20, 646, 350, 'Members only; nicknames are shown here, not aliases. Ended games replace the composer with "Chat is read-only".'));
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
    description: 'How to play, reachable from home, lobby and wallet.',
    body: () => {
      const parts = [statusBar(), header({ title: 'How to play', back: true })];
      const sections = [
        ['Goal', 'Get other players to do the thing on your secret mission without them realising.'],
        ['Slots', 'You hold up to five missions. Pick one of two offered missions to fill a slot.'],
        ['Success', 'Mark who you got, or Group. You must get everyone once before repeating someone.'],
        ['Failure', 'Called out or it did not work? Mark it failed. Results cannot be undone.'],
        ['Cooldowns', 'Each result empties its slot for a while: 5, 10, 20 min and so on, up to 6 hours.'],
        ['Scores', 'One point per completed mission. The leaderboard uses anonymous names.'],
        ['Secrets', 'Never show your missions. Each mission is handed out only once per game.'],
        ['Ending', 'The host ends the game. Results stay available to sync for 7 days.'],
      ];
      let y = 128;
      for (const [title, body] of sections) {
        parts.push(text(20, y, title, { size: 15, weight: 700, fill: C.ink }));
        parts.push(text(20, y + 20, body, { size: 13, fill: C.body, width: 350 }));
        y += 20 + textHeight(body, 350, 13) + 20;
      }
      parts.push(text(195, Math.max(y + 12, 810), 'Honour system: play fair to keep it fun.', { size: 12, italic: true, fill: C.muted, anchor: 'middle' }));
      return parts.join('');
    },
  },
  {
    file: '12-game-ended.svg',
    title: 'Game ended summary',
    description: 'Ended game: final standings, own results, sync window, and opt-in full pack save. Also used for past-game detail.',
    body: () => [
      statusBar(),
      header({ title: 'Beach day', back: true, actions: [{ label: 'Chat' }] }),
      rect(20, 110, 350, 54, { fill: C.soft, stroke: C.line, r: 10 }),
      text(34, 133, 'Game ended 12 Oct', { size: 15, weight: 700, fill: C.ink }),
      text(34, 152, 'Results can sync for 6 more days, then stay only on this device.', { size: 12, fill: C.body }),
      section(190, 'FINAL LEADERBOARD'),
      rankRow(200, { rank: '1', name: 'CheeryTiger42', score: '6', h: 38 }),
      rankRow(244, { rank: '2', name: 'RustyFalcon17 (you)', score: '4', own: true, h: 38 }),
      rankRow(288, { rank: '3', name: 'SunnyDolphin83', score: '3', h: 38 }),
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
      note(20, 716, 350, 'Past games on Home open this layout from device history. Saving and syncing end when the 7 days are up. If final results never downloaded, show "Incomplete results".'),
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
