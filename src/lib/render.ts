// Canvas renderer + animations (browser-only; instantiated inside an effect).
// Flat "line-art" look: warm board, ink outlines, coral/teal pieces.
// Three stacked layers keep per-frame work tiny:
//   bg     — board surface, hatching & grid (redrawn only on resize)
//   pieces — the pieces (redrawn on state change / during move+rotate anims)
//   fx     — selection, move hints, laser beam, explosions (per-frame only
//            while something is animating)
import { COLS, ROWS } from '@/game/engine';
import type { Action, Board, Color, LaserPoint, MoveAction, Piece } from '@/game/types';

// The board palette follows the app theme. DARK = neon (near-black board, light
// ink, cyan accents); LIGHT = the original warm look (cream board, dark ink,
// coral/teal). Values are swapped into the mutable module vars by applyThemePalette.
type Beam = { core: string; halo: string; hot: string };
interface Palette {
  ink: string;
  boardFill: string;
  grid: string;
  hatch: Record<Color, string>;
  fill: Record<Color, string>;
  highlight: string;
  mirrorShine: string;
  beam: Record<Color, Beam>;
  boardShadow: string;
  boardOutline: string;
  selFill: string;
  dotFill: string;
  dotGlow: string;
  dotRing: string;
  handleBase: string;
  handleShadow: string;
  handleRing: string;
}

const DARK: Palette = {
  ink: '#f0ece3',
  boardFill: '#14100b',
  grid: 'rgba(240,236,227,0.10)',
  hatch: { red: 'rgba(199,84,64,0.14)', silver: 'rgba(24,148,124,0.14)' },
  fill: { red: '#c75440', silver: '#18947c' },
  highlight: '#f0b429',
  mirrorShine: 'rgba(255,255,255,0.85)',
  beam: {
    red: { core: '#e2725c', halo: 'rgba(199,84,64,0.30)', hot: '#fff2ed' },
    silver: { core: '#3dbfa0', halo: 'rgba(24,148,124,0.30)', hot: '#ecfffb' },
  },
  boardShadow: 'rgba(240,180,41,0.24)',
  boardOutline: 'rgba(240,180,41,0.42)',
  selFill: 'rgba(240,180,41,0.15)',
  dotFill: 'rgba(240,180,41,0.55)',
  dotGlow: 'rgba(240,180,41,0.7)',
  dotRing: 'rgba(240,236,227,0.9)',
  handleBase: '#1c1712',
  handleShadow: 'rgba(240,180,41,0.45)',
  handleRing: '#f0b429',
};

const LIGHT: Palette = {
  ink: '#23262e',
  boardFill: '#fffaf0',
  grid: 'rgba(35,38,46,0.42)',
  hatch: { red: 'rgba(233,90,66,0.16)', silver: 'rgba(43,176,170,0.18)' },
  fill: { red: '#ef5a40', silver: '#2fb0ab' },
  highlight: '#f5b73f',
  mirrorShine: 'rgba(255,255,255,0.7)',
  beam: {
    red: { core: '#ee4a30', halo: 'rgba(238,74,48,0.22)', hot: '#fff3ee' },
    silver: { core: '#14a8a2', halo: 'rgba(20,168,162,0.22)', hot: '#effffd' },
  },
  boardShadow: 'rgba(60,45,25,0.16)',
  boardOutline: '#23262e',
  selFill: 'rgba(245,183,63,0.18)',
  dotFill: 'rgba(35,38,46,0.5)',
  dotGlow: 'rgba(0,0,0,0)',
  dotRing: 'rgba(255,255,255,0.85)',
  handleBase: '#fffaf0',
  handleShadow: 'rgba(60,45,25,0.25)',
  handleRing: '#23262e',
};

// Mutable, theme-swapped at runtime; all draw code below reads these.
let INK = DARK.ink;
let BOARD_FILL = DARK.boardFill;
let GRID = DARK.grid;
let HATCH = DARK.hatch;
let FILL = DARK.fill;
let HIGHLIGHT = DARK.highlight;
let MIRROR_SHINE = DARK.mirrorShine;
let BEAM = DARK.beam;
let BOARD_SHADOW = DARK.boardShadow;
let BOARD_OUTLINE = DARK.boardOutline;
let SEL_FILL = DARK.selFill;
let DOT_FILL = DARK.dotFill;
let DOT_GLOW = DARK.dotGlow;
let DOT_RING = DARK.dotRing;
let HANDLE_BASE = DARK.handleBase;
let HANDLE_SHADOW = DARK.handleShadow;
let HANDLE_RING = DARK.handleRing;

function applyThemePalette(dark: boolean) {
  const p = dark ? DARK : LIGHT;
  INK = p.ink;
  BOARD_FILL = p.boardFill;
  GRID = p.grid;
  HATCH = p.hatch;
  FILL = p.fill;
  HIGHLIGHT = p.highlight;
  MIRROR_SHINE = p.mirrorShine;
  BEAM = p.beam;
  BOARD_SHADOW = p.boardShadow;
  BOARD_OUTLINE = p.boardOutline;
  SEL_FILL = p.selFill;
  DOT_FILL = p.dotFill;
  DOT_GLOW = p.dotGlow;
  DOT_RING = p.dotRing;
  HANDLE_BASE = p.handleBase;
  HANDLE_SHADOW = p.handleShadow;
  HANDLE_RING = p.handleRing;
}
const isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
const TAU = Math.PI * 2;
const SQ2 = Math.SQRT2;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
// smoothstep: eases in AND out, so a piece clearly starts at rest on its old square
const easeInOut = (t: number) => t * t * (3 - 2 * t);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// Mixes a #rrggbb color toward white by `amt` (0..1) — used to build the
// piece sheen gradient without hand-picking a second color per palette.
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}
// Mixes a #rrggbb color toward black by `amt` (0..1).
function darken(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const mix = (c: number) => Math.round(c * (1 - amt));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

type Ctx = CanvasRenderingContext2D;
type Pt = { x: number; y: number };

type Target = MoveAction & { px: number; py: number; r: number };
interface Handle {
  type: 'rotate';
  x: number;
  y: number;
  orient: number;
  spin?: 1 | -1;
  px: number;
  py: number;
  r: number;
  dir: number;
}
export type Pick = { kind: 'action'; action: Action } | { kind: 'cell'; x: number; y: number } | null;

interface PieceAnim {
  endBoard: Board;
  resolve?: () => void;
  hidden: { x: number; y: number }[];
  update: (t: number) => boolean;
  draw: (ctx: Ctx, t: number) => void;
}
interface FxAnim {
  resolve?: () => void;
  update: (t: number) => boolean;
  draw: (ctx: Ctx, t: number) => void;
}

export class Renderer {
  root: HTMLElement;
  dpr: number;
  flip = false;
  board: Board | null = null;
  selection: { x: number; y: number } | null = null;
  selectedActions: Action[] = [];
  targets: Target[] = [];
  handles: Handle[] = [];
  reviewMark: { x: number; y: number }[] = [];
  geom = { ox: 0, oy: 0, cell: 40, w: 0, h: 0 };
  private _pieceAnim: PieceAnim | null = null;
  private _fx: FxAnim[] = [];
  private _running = false;
  private layers: Record<string, { canvas: HTMLCanvasElement; ctx: Ctx }> = {};
  fxCanvas!: HTMLCanvasElement;
  private _themeObserver: MutationObserver | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.dpr = Math.max(1, window.devicePixelRatio || 1);
    for (const name of ['bg', 'pieces', 'fx']) {
      const c = document.createElement('canvas');
      c.className = 'layer';
      c.style.position = 'absolute';
      c.style.inset = '0';
      c.style.pointerEvents = name === 'fx' ? 'auto' : 'none';
      if (name === 'fx') c.style.touchAction = 'none';
      root.appendChild(c);
      this.layers[name] = { canvas: c, ctx: c.getContext('2d')! };
    }
    this.fxCanvas = this.layers.fx.canvas;
    this._loop = this._loop.bind(this);

    // Follow the app theme (light/dark): pick the palette now, and redraw the
    // board whenever the theme class on <html> changes.
    applyThemePalette(isDarkTheme());
    this._themeObserver = new MutationObserver(() => {
      applyThemePalette(isDarkTheme());
      this.drawBg();
      this.drawPieces();
      this.drawFx();
    });
    this._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  destroy() {
    this._themeObserver?.disconnect();
    this._themeObserver = null;
    for (const { canvas } of Object.values(this.layers)) canvas.remove();
    this.layers = {};
    this._pieceAnim = null;
    this._fx = [];
  }

  // ---- geometry ------------------------------------------------------------
  resize() {
    const rect = this.root.getBoundingClientRect();
    const W = Math.max(100, rect.width),
      H = Math.max(100, rect.height);
    const cell = Math.max(10, Math.floor(Math.min((W - 16) / COLS, (H - 16) / ROWS)));
    const w = cell * COLS,
      h = cell * ROWS;
    this.geom = { ox: Math.round((W - w) / 2), oy: Math.round((H - h) / 2), cell, w, h };
    for (const { canvas, ctx } of Object.values(this.layers)) {
      canvas.width = W * this.dpr;
      canvas.height = H * this.dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    this.rebuildFxElements();
    this.drawBg();
    this.drawPieces();
    this.drawFx();
  }

  toPx(fx: number, fy: number): Pt {
    const { ox, oy, cell } = this.geom;
    const gx = this.flip ? COLS - fx : fx;
    const gy = this.flip ? ROWS - fy : fy;
    return { x: ox + gx * cell, y: oy + gy * cell };
  }
  cellCenterPx(x: number, y: number): Pt {
    return this.toPx(x + 0.5, y + 0.5);
  }

  cellFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
    const r = this.fxCanvas.getBoundingClientRect();
    const { ox, oy, cell } = this.geom;
    let gx = Math.floor((clientX - r.left - ox) / cell);
    let gy = Math.floor((clientY - r.top - oy) / cell);
    if (this.flip) {
      gx = COLS - 1 - gx;
      gy = ROWS - 1 - gy;
    }
    if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return null;
    return { x: gx, y: gy };
  }

  // ---- background layer ----------------------------------------------------
  drawBg() {
    const layer = this.layers.bg;
    if (!layer) return;
    const { ctx } = layer;
    const { ox, oy, cell, w, h } = this.geom;
    const radius = cell * 0.42;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // soft glow/shadow beneath the board so it lifts off the backdrop
    ctx.save();
    ctx.shadowColor = BOARD_SHADOW;
    ctx.shadowBlur = cell * 0.9;
    ctx.shadowOffsetY = cell * 0.1;
    ctx.fillStyle = BOARD_FILL;
    roundRect(ctx, ox, oy, w, h, radius);
    ctx.fill();
    ctx.restore();

    // clip everything else to the rounded board
    ctx.save();
    roundRect(ctx, ox, oy, w, h, radius);
    ctx.clip();

    // decorative hatching on each sphinx's home column — one continuous
    // diagonal band per column, so the stripe phase never resets at row
    // boundaries (a per-cell reset here would visibly stagger the stripes).
    for (const x of [0, COLS - 1]) {
      const p = this.toPx(x, 0);
      const sx = this.flip ? p.x - cell : p.x;
      this.hatchColumn(ctx, sx, oy, cell, h, HATCH[x === 0 ? 'red' : 'silver']);
    }

    // grid lines
    ctx.strokeStyle = GRID;
    ctx.lineWidth = Math.max(1, cell * 0.018);
    ctx.beginPath();
    for (let i = 1; i < COLS; i++) {
      ctx.moveTo(ox + i * cell, oy);
      ctx.lineTo(ox + i * cell, oy + h);
    }
    for (let j = 1; j < ROWS; j++) {
      ctx.moveTo(ox, oy + j * cell);
      ctx.lineTo(ox + w, oy + j * cell);
    }
    ctx.stroke();
    ctx.restore();

    // board outline (a thin laser frame in dark, dark ink in light)
    ctx.strokeStyle = BOARD_OUTLINE;
    ctx.lineWidth = Math.max(2, cell * 0.05);
    roundRect(ctx, ox, oy, w, h, radius);
    ctx.stroke();
  }

  private hatchColumn(ctx: Ctx, sx: number, top: number, cell: number, height: number, color: string) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, top, cell, height);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, cell * 0.05);
    ctx.beginPath();
    for (let d = -height; d < cell + height; d += cell * 0.3) {
      ctx.moveTo(sx + d, top);
      ctx.lineTo(sx + d + height, top + height);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---- pieces layer --------------------------------------------------------
  setBoard(board: Board, opts: { flip?: boolean } = {}) {
    this.board = board;
    if (opts.flip !== undefined) this.flip = opts.flip;
    this.drawBg();
    this.drawPieces();
    this.drawFx();
  }

  setBoardQuiet(board: Board) {
    this.board = board;
    this.drawPieces();
  }

  drawPieces(now?: number) {
    const layer = this.layers.pieces;
    if (!layer) return;
    const { ctx } = layer;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!this.board) return;
    const anim = this._pieceAnim;

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const p = this.board[y][x];
        if (!p) continue;
        if (anim && anim.hidden.some((c) => c.x === x && c.y === y)) continue;
        const c = this.cellCenterPx(x, y);
        this.drawPiece(ctx, p, c.x, c.y, this.orientAngle(p.orient));
      }
    }
    if (anim) anim.draw(ctx, now ?? performance.now());
  }

  orientAngle(orient: number) {
    return orient * (Math.PI / 2) + (this.flip ? Math.PI : 0);
  }

  drawPiece(ctx: Ctx, p: Piece, cx: number, cy: number, angle: number) {
    const s = this.geom.cell;
    ctx.save();
    ctx.translate(cx, cy);
    // Fixed screen-space light (not rotated with the piece) so orientation
    // changes don't flip the highlight — subtle sheen instead of flat fill.
    const fill = this.pieceFill(ctx, s, FILL[p.color]);
    ctx.rotate(p.type === 'pharaoh' ? 0 : angle); // crown always upright
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (p.type === 'pharaoh') this._pharaoh(ctx, s, fill);
    else if (p.type === 'pyramid') this._pyramid(ctx, s, fill);
    else if (p.type === 'scarab') this._scarab(ctx, s, fill);
    else if (p.type === 'anubis') this._anubis(ctx, s, fill);
    else if (p.type === 'sphinx') this._sphinx(ctx, s, fill);
    ctx.restore();
  }

  private lw(s: number) {
    return Math.max(2, s * 0.05);
  }
  // Subtle top-left → bottom-right sheen instead of a flat fill, so pieces
  // read with a bit of depth. Gradient is built in screen space (before the
  // piece's own rotate), so the highlight stays fixed as pieces turn.
  private pieceFill(ctx: Ctx, s: number, base: string): CanvasGradient {
    const g = ctx.createLinearGradient(-s * 0.36, -s * 0.36, s * 0.36, s * 0.36);
    g.addColorStop(0, lighten(base, 0.22));
    g.addColorStop(0.55, base);
    g.addColorStop(1, darken(base, 0.14));
    return g;
  }
  private line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  private _pyramid(ctx: Ctx, s: number, fill: CanvasGradient) {
    const h = s * 0.38;
    ctx.beginPath();
    ctx.moveTo(-h, -h);
    ctx.lineTo(-h, h);
    ctx.lineTo(h, h);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = this.lw(s);
    ctx.strokeStyle = INK;
    ctx.stroke();
    // mirror shine parallel to the hypotenuse
    const o = s * 0.11 / SQ2;
    ctx.strokeStyle = MIRROR_SHINE;
    ctx.lineWidth = Math.max(1.5, s * 0.045);
    this.line(ctx, -h * 0.7 - o, -h * 0.7 + o, h * 0.7 - o, h * 0.7 + o);
  }

  private _scarab(ctx: Ctx, s: number, fill: CanvasGradient) {
    const a = s * 0.32,
      t = s * 0.26;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = t + this.lw(s) * 2;
    this.line(ctx, -a, -a, a, a);
    ctx.strokeStyle = fill;
    ctx.lineWidth = t;
    this.line(ctx, -a, -a, a, a);
    const o = t * 0.24;
    ctx.strokeStyle = MIRROR_SHINE;
    ctx.lineWidth = Math.max(1.5, s * 0.035);
    this.line(ctx, -a * 0.66 + o / SQ2, -a * 0.66 - o / SQ2, a * 0.66 + o / SQ2, a * 0.66 - o / SQ2);
  }

  private _anubis(ctx: Ctx, s: number, fill: CanvasGradient) {
    const w = s * 0.32,
      top = -s * 0.34,
      bot = s * 0.34,
      r = s * 0.14;
    const h = bot - top;
    // coloured body
    roundRect(ctx, -w, top, w * 2, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    // black armoured shield on the FRONT (local top = the `orient` direction the
    // engine treats as protected). A laser hitting this black face is blocked.
    ctx.save();
    roundRect(ctx, -w, top, w * 2, h, r);
    ctx.clip();
    ctx.fillStyle = INK;
    ctx.fillRect(-w, top, w * 2, h * 0.46);
    ctx.restore();
    // outline
    roundRect(ctx, -w, top, w * 2, h, r);
    ctx.lineWidth = this.lw(s);
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  private _pharaoh(ctx: Ctx, s: number, fill: CanvasGradient) {
    const W = s * 0.34,
      base = s * 0.16,
      midTop = -s * 0.3,
      sideTop = -s * 0.13,
      dip = -s * 0.01;
    ctx.beginPath();
    ctx.moveTo(-W, base);
    ctx.lineTo(-W, sideTop);
    ctx.lineTo(-W * 0.5, dip);
    ctx.lineTo(0, midTop);
    ctx.lineTo(W * 0.5, dip);
    ctx.lineTo(W, sideTop);
    ctx.lineTo(W, base);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = this.lw(s);
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = INK;
    for (const [px, py] of [[-W, sideTop], [0, midTop], [W, sideTop]] as const) {
      ctx.beginPath();
      ctx.arc(px, py, s * 0.05, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = this.lw(s);
    this.line(ctx, -W * 0.85, base + s * 0.11, W * 0.85, base + s * 0.11);
  }

  private _sphinx(ctx: Ctx, s: number, fill: CanvasGradient) {
    const R = s * 0.3;
    roundRect(ctx, -R, -R, R * 2, R * 2, R * 0.55);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = this.lw(s);
    ctx.strokeStyle = INK;
    ctx.stroke();
    // black barrel pointing to the firing edge (up in local space)
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.lineWidth = s * 0.16;
    this.line(ctx, 0, R * 0.15, 0, -R * 1.25);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(0, -R * 1.25, s * 0.055, 0, TAU);
    ctx.fill();
  }

  // ---- selection / hints (static fx) ---------------------------------------
  // Move targets (dots) are drawn inside the center of destination boxes.
  // Rotation handles are shown directly on the piece for larger resolution screens (desktop/laptop),
  // while smaller screens utilize the Action Panel below the board.
  select(cell: { x: number; y: number }, actions: Action[]) {
    this.selection = cell;
    this.selectedActions = actions;
    this.rebuildFxElements();
    this.drawFx();
  }

  clearSelection() {
    this.selection = null;
    this.selectedActions = [];
    this.targets = [];
    this.handles = [];
    this.drawFx();
  }

  rebuildFxElements() {
    this.targets = [];
    this.handles = [];
    if (!this.selection) return;

    const s = this.geom.cell;
    const isLargeScreen = typeof window !== 'undefined' && window.innerWidth >= 1024;
    const c = this.cellCenterPx(this.selection.x, this.selection.y);

    const rotateActions = this.selectedActions.filter((a): a is Action & { type: 'rotate' } => a.type === 'rotate');

    for (const a of this.selectedActions) {
      if (a.type === 'move') {
        const tc = this.cellCenterPx(a.tx, a.ty);
        this.targets.push({ ...a, px: tc.x, py: tc.y, r: s * 0.42 });
      } else if (a.type === 'rotate' && isLargeScreen) {
        let spin: 1 | -1 = 1;
        if (a.spin !== undefined) {
          spin = a.spin;
        } else if (this.board && this.board[this.selection.y]?.[this.selection.x]) {
          const piece = this.board[this.selection.y][this.selection.x]!;
          spin = (a.orient - piece.orient + 4) % 4 === 1 ? 1 : -1;
        }
        // Position rotation arrows at the top-left and top-right of the box
        const hasBothSpins = rotateActions.length > 1;
        const xOffset = hasBothSpins ? (spin === -1 ? -0.40 : 0.40) : 0;
        const yOffset = -0.40;

        this.handles.push({
          type: 'rotate',
          x: a.x,
          y: a.y,
          orient: a.orient,
          spin,
          px: c.x + s * xOffset,
          py: c.y + s * yOffset,
          r: Math.max(9, s * 0.16),
          dir: spin,
        });
      }
    }
  }

  // Highlight the from/to squares of a reviewed move (history view).
  setReviewMark(action: Action | null) {
    this.reviewMark = [];
    if (action) {
      this.reviewMark.push({ x: action.x, y: action.y });
      if (action.type === 'move') this.reviewMark.push({ x: action.tx, y: action.ty });
    }
    this.drawFx();
  }

  pick(clientX: number, clientY: number): Pick {
    const r = this.fxCanvas.getBoundingClientRect();
    const px = clientX - r.left,
      py = clientY - r.top;
    for (const h of this.handles)
      if (Math.hypot(px - h.px, py - h.py) <= Math.max(14, h.r * 1.5))
        return { kind: 'action', action: { type: 'rotate', x: h.x, y: h.y, orient: h.orient, spin: h.spin } };
    for (const t of this.targets)
      if (Math.hypot(px - t.px, py - t.py) <= t.r)
        return { kind: 'action', action: { type: 'move', x: t.x, y: t.y, tx: t.tx, ty: t.ty, swap: t.swap } };
    const cell = this.cellFromClient(clientX, clientY);
    if (cell) {
      const matchingTarget = this.targets.find((t) => t.tx === cell.x && t.ty === cell.y);
      if (matchingTarget) {
        return {
          kind: 'action',
          action: { type: 'move', x: matchingTarget.x, y: matchingTarget.y, tx: matchingTarget.tx, ty: matchingTarget.ty, swap: matchingTarget.swap },
        };
      }
      return { kind: 'cell', x: cell.x, y: cell.y };
    }
    return null;
  }

  drawFx(now?: number) {
    const layer = this.layers.fx;
    if (!layer) return;
    const { ctx } = layer;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const s = this.geom.cell;

    for (const t of this.targets) {
      ctx.save();
      if (t.swap) {
        ctx.strokeStyle = FILL.silver;
        ctx.lineWidth = 3;
        roundRect(ctx, t.px - s * 0.36, t.py - s * 0.36, s * 0.72, s * 0.72, 9);
        ctx.stroke();
      } else {
        ctx.fillStyle = DOT_FILL;
        ctx.shadowColor = DOT_GLOW;
        ctx.shadowBlur = s * 0.16;
        ctx.beginPath();
        ctx.arc(t.px, t.py, s * 0.14, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = DOT_RING;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }
    for (const h of this.handles) this._drawHandle(ctx, h);

    if (this._fx.length) {
      const t = now ?? performance.now();
      for (const fx of this._fx) fx.draw(ctx, t);
    }
  }

  private _drawHandle(ctx: Ctx, h: Handle) {
    // button base — a glowing disc so it reads as a tappable control
    ctx.save();
    ctx.translate(h.px, h.py);
    ctx.shadowColor = HANDLE_SHADOW;
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = HANDLE_BASE;
    ctx.beginPath();
    ctx.arc(0, 0, h.r, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(h.px, h.py);
    ctx.strokeStyle = HANDLE_RING;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, h.r, 0, TAU);
    ctx.stroke();
    // circular-arrow glyph: drawn clockwise, mirrored for counter-clockwise
    if (h.dir < 0) ctx.scale(-1, 1);
    this._rotateGlyph(ctx, h.r);
    ctx.restore();
  }

  // A clean "rotate" icon: a ~270° arc with a filled triangular arrowhead at
  // its leading tip. Drawn clockwise; the caller mirrors it for CCW handles.
  private _rotateGlyph(ctx: Ctx, R: number) {
    const rr = R * 0.5;
    const start = Math.PI * 0.72; // 130°
    const end = start + Math.PI * 1.5; // sweep 270° clockwise (canvas y-down)
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineWidth = Math.max(1.2, R * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, rr, start, end, false);
    ctx.stroke();

    const cos = Math.cos(end),
      sin = Math.sin(end);
    const tx = -sin, ty = cos; // forward tangent (direction of travel)
    const px = cos, py = sin; // radial (perpendicular to the tangent)
    const bx = cos * rr, by = sin * rr; // tip location on the arc
    const hl = R * 0.5, hw = R * 0.34;
    ctx.beginPath();
    ctx.moveTo(bx + tx * hl * 0.6, by + ty * hl * 0.6); // apex, ahead of the tip
    ctx.lineTo(bx - tx * hl * 0.4 + px * hw, by - ty * hl * 0.4 + py * hw);
    ctx.lineTo(bx - tx * hl * 0.4 - px * hw, by - ty * hl * 0.4 - py * hw);
    ctx.closePath();
    ctx.fill();
  }

  // ---- animation loop ------------------------------------------------------
  private _ensureLoop() {
    if (!this._running) {
      this._running = true;
      requestAnimationFrame(this._loop);
    }
  }
  private _loop(t: number) {
    if (this._pieceAnim) {
      if (this._pieceAnim.update(t)) {
        const a = this._pieceAnim;
        this._pieceAnim = null;
        this.board = a.endBoard;
        this.drawPieces();
        a.resolve && a.resolve();
      } else {
        this.drawPieces(t);
      }
    }
    if (this._fx.length) {
      for (let i = this._fx.length - 1; i >= 0; i--) {
        if (this._fx[i].update(t)) {
          const f = this._fx[i];
          this._fx.splice(i, 1);
          f.resolve && f.resolve();
        }
      }
      this.drawFx(t);
    }
    if (this._pieceAnim || this._fx.length) requestAnimationFrame(this._loop);
    else {
      this._running = false;
      this.drawFx();
    }
  }

  // Immediately stop any running piece/laser/explosion animations and resolve their
  // promises (so awaiting callers proceed). Used when jumping around move history.
  cancelAnimations() {
    if (this._pieceAnim) {
      const a = this._pieceAnim;
      this._pieceAnim = null;
      a.resolve && a.resolve();
    }
    if (this._fx.length) {
      const fx = this._fx;
      this._fx = [];
      for (const f of fx) f.resolve && f.resolve();
    }
  }

  animatePieceAction(action: Action, startBoard: Board, endBoard: Board, durationMs?: number): Promise<void> {
    this.board = startBoard;
    return new Promise((resolve) => {
      const dur = durationMs ?? (action.type === 'rotate' ? 200 : 220);
      const start = performance.now();
      let anim: PieceAnim;
      if (action.type === 'move') {
        const piece = startBoard[action.y][action.x]!;
        const other = startBoard[action.ty][action.tx];
        anim = {
          endBoard,
          resolve,
          hidden: [{ x: action.x, y: action.y }, ...(other ? [{ x: action.tx, y: action.ty }] : [])],
          update: (t) => t - start >= dur,
          draw: (ctx, t) => {
            const from = this.cellCenterPx(action.x, action.y);
            const to = this.cellCenterPx(action.tx, action.ty);
            const k = easeInOut(clamp((t - start) / dur, 0, 1));
            const x = from.x + (to.x - from.x) * k,
              y = from.y + (to.y - from.y) * k;
            this.drawPiece(ctx, piece, x, y, this.orientAngle(piece.orient));
            if (other) {
              const ox = to.x + (from.x - to.x) * k,
                oy = to.y + (from.y - to.y) * k;
              this.drawPiece(ctx, other, ox, oy, this.orientAngle(other.orient));
            }
          },
        };
      } else {
        const piece = startBoard[action.y][action.x]!;
        const a0 = this.orientAngle(piece.orient);
        let delta = action.orient - piece.orient;
        if (action.spin) delta = action.spin;
        else {
          if (delta > 2) delta -= 4;
          if (delta < -2) delta += 4;
        }
        const a1 = a0 + delta * (Math.PI / 2);
        anim = {
          endBoard,
          resolve,
          hidden: [{ x: action.x, y: action.y }],
          update: (t) => t - start >= dur,
          draw: (ctx, t) => {
            const c = this.cellCenterPx(action.x, action.y);
            const k = easeInOut(clamp((t - start) / dur, 0, 1));
            this.drawPiece(ctx, piece, c.x, c.y, a0 + (a1 - a0) * k);
          },
        };
      }
      this._pieceAnim = anim;
      this._ensureLoop();
    });
  }

  animateLaser(path: LaserPoint[], color: Color, onHit?: () => void): Promise<void> {
    const pts = path.map((p) => this.toPx(p.x, p.y));
    const seg: number[] = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      seg.push(d);
      total += d;
    }
    const beam = BEAM[color];
    const travel = clamp(total * 0.85, 320, 1500);
    const fade = 260;
    const start = performance.now();
    let hitFired = false;

    return new Promise((resolve) => {
      this._fx.push({
        resolve,
        update: (t) => {
          if (!hitFired && t - start >= travel) {
            hitFired = true;
            onHit && onHit();
          }
          return t - start >= travel + fade;
        },
        draw: (ctx, t) => {
          const p = clamp((t - start) / travel, 0, 1);
          const alpha = t - start <= travel ? 1 : clamp(1 - (t - start - travel) / fade, 0, 1);
          this._drawBeam(ctx, pts, seg, total, p, beam, alpha);
        },
      });
      this._ensureLoop();
    });
  }

  private _drawBeam(ctx: Ctx, pts: Pt[], seg: number[], total: number, p: number, beam: (typeof BEAM)[Color], alpha: number) {
    if (pts.length < 2) return;
    const want = total * p;
    const path: Pt[] = [pts[0]];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      if (acc + seg[i - 1] <= want) {
        path.push(pts[i]);
        acc += seg[i - 1];
      } else {
        const k = seg[i - 1] === 0 ? 0 : (want - acc) / seg[i - 1];
        path.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k });
        break;
      }
    }
    const s = this.geom.cell;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const stroke = (w: number, style: string, a: number) => {
      ctx.globalAlpha = a * alpha;
      ctx.strokeStyle = style;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
    };
    stroke(s * 0.4, beam.halo, 1);
    stroke(s * 0.14, beam.core, 1);
    stroke(s * 0.05, beam.hot, 0.9);
    const head = path[path.length - 1];
    ctx.globalAlpha = alpha;
    ctx.fillStyle = beam.core;
    ctx.beginPath();
    ctx.arc(head.x, head.y, s * 0.16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = beam.hot;
    ctx.beginPath();
    ctx.arc(head.x, head.y, s * 0.07, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  explode(x: number, y: number, color: Color): Promise<void> {
    const c = this.cellCenterPx(x, y);
    const beam = BEAM[color] || BEAM.red;
    const start = performance.now();
    const dur = 620;
    const N = 14;
    const parts = Array.from({ length: N }, (_, i) => {
      const a = (i / N) * TAU + Math.random() * 0.4;
      const v = this.geom.cell * (0.8 + Math.random() * 1.1);
      return { a, v, r: 1.5 + Math.random() * 2 };
    });
    return new Promise((resolve) => {
      this._fx.push({
        resolve,
        update: (t) => t - start >= dur,
        draw: (ctx, t) => {
          const k = clamp((t - start) / dur, 0, 1);
          const s = this.geom.cell;
          ctx.save();
          ctx.globalAlpha = (1 - k) * 0.9;
          ctx.strokeStyle = beam.core;
          ctx.lineWidth = Math.max(1.5, s * 0.07 * (1 - k));
          ctx.beginPath();
          ctx.arc(c.x, c.y, s * (0.2 + k * 0.7), 0, TAU);
          ctx.stroke();
          for (const pt of parts) {
            const dist = pt.v * easeOut(k);
            const px = c.x + Math.cos(pt.a) * dist,
              py = c.y + Math.sin(pt.a) * dist;
            ctx.globalAlpha = 1 - k;
            ctx.fillStyle = beam.core;
            ctx.beginPath();
            ctx.arc(px, py, pt.r * (1 - k * 0.5), 0, TAU);
            ctx.fill();
          }
          ctx.restore();
          ctx.globalAlpha = 1;
        },
      });
      this._ensureLoop();
    });
  }
}

// ---- canvas helpers --------------------------------------------------------
function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
