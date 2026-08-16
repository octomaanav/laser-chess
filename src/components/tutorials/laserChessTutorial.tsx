import BoardDemo, { emptyBoard, piece, place, type DemoStep } from './BoardDemo';
import GamePieceIcon from './GamePieceIcon';
import type { TutorialStep } from './TutorialModal';

function Tile({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="grid size-16 place-items-center rounded-lg border border-border bg-muted/60">{children}</div>
      {label && <span className="text-[11px] font-medium text-muted-foreground">{label}</span>}
    </div>
  );
}

// ---- Intro: the silver Sphinx fires east, bounces off a Pyramid (turns
// south), bounces off a Scarab (turns east again), and burns the red
// Pharaoh - a single real fireLaser() trace showing both deflection types
// and the win condition in one shot. ----------------------------------------
function introSteps(): DemoStep[] {
  let b0 = place(emptyBoard(), 1, 1, piece('sphinx', 'silver', 1));
  b0 = place(b0, 5, 1, piece('pyramid', 'silver', 2));
  b0 = place(b0, 5, 4, piece('scarab', 'silver', 0));
  b0 = place(b0, 8, 4, piece('pharaoh', 'red', 0));
  return [{ board: b0, fireColor: 'silver', holdMs: 1800 }];
}

// ---- Move & rotate: a pyramid slides one square, then rotates in place,
// then reverses both so the loop reads cleanly. -----------------------------
function moveRotateSteps(): DemoStep[] {
  const p = piece('pyramid', 'silver', 0);
  const b0 = place(emptyBoard(), 2, 2, p);
  const b1 = place(emptyBoard(), 3, 2, { ...p, orient: 0 });
  const b2 = place(emptyBoard(), 3, 2, { ...p, orient: 1 });
  const b3 = place(emptyBoard(), 3, 2, { ...p, orient: 0 });
  const b4 = place(emptyBoard(), 2, 2, { ...p, orient: 0 });
  return [
    { board: b0, holdMs: 650 },
    { board: b1, action: { type: 'move', x: 2, y: 2, tx: 3, ty: 2 }, holdMs: 550 },
    { board: b2, action: { type: 'rotate', x: 3, y: 2, orient: 1, spin: 1 }, holdMs: 700 },
    { board: b3, action: { type: 'rotate', x: 3, y: 2, orient: 0, spin: -1 }, holdMs: 400 },
    { board: b4, action: { type: 'move', x: 3, y: 2, tx: 2, ty: 2 }, holdMs: 650 },
  ];
}

// ---- Scarab swap: a Scarab and a Pyramid trade places without rotating,
// then swap back. --------------------------------------------------------
function scarabSwapSteps(): DemoStep[] {
  const scarab = piece('scarab', 'silver', 0);
  const pyramid = piece('pyramid', 'silver', 2);
  const b0 = place(place(emptyBoard(), 3, 3, scarab), 4, 3, pyramid);
  const b1 = place(place(emptyBoard(), 4, 3, scarab), 3, 3, pyramid);
  return [
    { board: b0, holdMs: 700 },
    { board: b1, action: { type: 'move', x: 3, y: 3, tx: 4, ty: 3, swap: true }, holdMs: 900 },
    { board: b0, action: { type: 'move', x: 4, y: 3, tx: 3, ty: 3, swap: true }, holdMs: 700 },
  ];
}

// ---- Winning: the silver Sphinx fires straight down an open row and
// illuminates the red Pharaoh - the real fireLaser() traces this path. -----
function winningSteps(): DemoStep[] {
  const b0 = place(place(emptyBoard(), 9, 4, piece('sphinx', 'silver', 3)), 1, 4, piece('pharaoh', 'red', 0));
  return [{ board: b0, fireColor: 'silver', holdMs: 1700 }];
}

export const LASER_CHESS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Burn the enemy Pharaoh',
    visual: <BoardDemo steps={introSteps()} />,
    body: (
      <>
        <p>
          Laser Chess (based on <span className="font-semibold text-foreground">Khet</span>) is a head-to-head duel
          fought with mirrors and a laser instead of captures.
        </p>
        <p>
          Every turn ends with your laser firing automatically from your <span className="font-semibold text-foreground">Sphinx</span>.
          As shown in the demo above, it bounces off angled pieces on the board by deflecting off a Pyramid, then a Scarab, before landing on
          the enemy <span className="font-semibold text-foreground">Pharaoh</span> for an instant win.
        </p>
      </>
    ),
  },
  {
    title: 'The pieces',
    visual: (
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
        <Tile label="Pharaoh"><GamePieceIcon type="pharaoh" color="silver" /></Tile>
        <Tile label="Pyramid"><GamePieceIcon type="pyramid" color="silver" /></Tile>
        <Tile label="Scarab"><GamePieceIcon type="scarab" color="silver" /></Tile>
        <Tile label="Anubis"><GamePieceIcon type="anubis" color="silver" orient={1} /></Tile>
        <Tile label="Sphinx"><GamePieceIcon type="sphinx" color="silver" /></Tile>
      </div>
    ),
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          <span className="font-semibold text-foreground">Pharaoh</span>: Your king. You lose immediately if it is hit by the laser.
        </li>
        <li>
          <span className="font-semibold text-foreground">Pyramid</span>: Features a single mirror face that deflects the beam 90°.
          It is destroyed if hit on its flat non-mirrored side.
        </li>
        <li>
          <span className="font-semibold text-foreground">Scarab</span>: Features a double mirror that reflects from either side and can
          never be destroyed.
        </li>
        <li>
          <span className="font-semibold text-foreground">Anubis</span>: Shielded on its front face to stop incoming beams,
          but destroyed if hit from the side or back.
        </li>
        <li>
          <span className="font-semibold text-foreground">Sphinx</span>: Sits in your corner and holds your laser cannon.
          It can rotate but cannot move, and it cannot be destroyed.
        </li>
      </ul>
    ),
  },
  {
    title: 'Each turn: move or rotate, once',
    visual: <BoardDemo steps={moveRotateSteps()} />,
    body: (
      <>
        <p>On your turn, choose exactly one of the following actions:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <span className="font-semibold text-foreground">Move</span> one of your pieces one square, in any direction
            (including diagonally).
          </li>
          <li>
            <span className="font-semibold text-foreground">Rotate</span> one piece a quarter turn (90°), in place.
          </li>
        </ul>
        <p>Choose one action per turn. Your laser will then fire automatically and the turn will pass to your opponent.</p>
      </>
    ),
  },
  {
    title: 'Special rules',
    visual: <BoardDemo steps={scarabSwapSteps()} />,
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          A <span className="font-semibold text-foreground">Scarab</span> can swap places with an adjacent Pyramid or
          Anubis of either color instead of moving normally. As demonstrated above, neither piece rotates during the swap.
        </li>
        <li>
          The tinted columns on the board&apos;s left and right edges are reserved for one color only. You cannot
          move any piece, including a Scarab, into a square reserved for your opponent.
        </li>
        <li>Rotating the Sphinx to fire down a different row or column counts as your whole turn, just like moving a piece.</li>
      </ul>
    ),
  },
  {
    title: 'Winning',
    visual: <BoardDemo steps={winningSteps()} />,
    body: (
      <>
        <p>
          The game ends the instant a laser beam illuminates a Pharaoh. The player whose Pharaoh was hit loses, even
          if you hit your own by mistake.
        </p>
        <p>
          If the exact same board position repeats a third time, the player about to move can call it a draw.
        </p>
      </>
    ),
  },
];
