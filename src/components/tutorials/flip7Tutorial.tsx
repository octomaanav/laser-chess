import Flip7Card from '../flip7/art/Flip7Card';
import type { Card } from '@/game/flip7/types';
import type { TutorialStep } from './TutorialModal';

function CardRow({ cards }: { cards: Card[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {cards.map((c, i) => (
        <Flip7Card key={i} card={c} />
      ))}
    </div>
  );
}

export const FLIP7_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Build a hand of unique numbers',
    body: (
      <>
        <p>
          Each round, players take turns drawing cards. Your goal is to collect as many{' '}
          <span className="font-semibold text-foreground">unique</span> number cards as you can without drawing the same
          number twice.
        </p>
        <p>
          Collect <span className="font-semibold text-foreground">7 unique numbers</span> and you &quot;Flip 7&quot; -
          the round ends instantly and you score a big bonus. Everyone else banks whatever they had.
        </p>
      </>
    ),
  },
  {
    title: 'Your turn: Hit or Stay',
    body: (
      <>
        <p>
          Play goes clockwise from the dealer&apos;s left. On your turn, choose to{' '}
          <span className="font-semibold text-foreground">Hit</span> (draw one card) or{' '}
          <span className="font-semibold text-foreground">Stay</span> (lock in your current score and sit out the rest
          of the round).
        </p>
        <p>Every hit passes the turn to the next player still in the round - there's no drawing twice in a row.</p>
      </>
    ),
  },
  {
    title: 'Busting',
    visual: <CardRow cards={[{ kind: 'number', value: 8 }]} />,
    body: (
      <>
        <p>
          Draw a number you already hold and you <span className="font-semibold text-foreground">bust</span> - your
          whole hand is discarded and you score 0 for the round.
        </p>
        <p>
          A <span className="font-semibold text-foreground">Second Chance</span> card in your hand saves you from
          exactly one bust - the duplicate and the Second Chance both get discarded, and you keep going.
        </p>
      </>
    ),
  },
  {
    title: 'Modifiers and the multiplier',
    visual: <CardRow cards={[{ kind: 'modifier', value: 6 }, { kind: 'multiplier' }]} />,
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <span className="font-semibold text-foreground">+2 / +4 / +6 / +8 / +10</span>: adds straight to your score,
          and can never cause a bust.
        </li>
        <li>
          <span className="font-semibold text-foreground">x2</span>: doubles the sum of your number cards (not your flat
          modifiers) when the round ends. Only one exists in the deck.
        </li>
      </ul>
    ),
  },
  {
    title: 'Action cards',
    visual: <CardRow cards={[{ kind: 'action', action: 'freeze' }, { kind: 'action', action: 'flip-three' }, { kind: 'action', action: 'second-chance' }]} />,
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <span className="font-semibold text-foreground">Freeze</span>: choose any player (including yourself) to stay
          immediately, banking their current score on the spot.
        </li>
        <li>
          <span className="font-semibold text-foreground">Flip Three</span>: choose any player to draw 3 cards in a row,
          right then - no choice to stop partway.
        </li>
        <li>
          <span className="font-semibold text-foreground">Second Chance</span>: keep it as insurance against one bust. If
          you draw a second one, you must hand it to another player who doesn&apos;t already have one.
        </li>
      </ul>
    ),
  },
  {
    title: 'Winning the game',
    body: (
      <>
        <p>
          When the round ends (everyone&apos;s busted, stayed, or someone flipped 7), every player&apos;s round score
          banks to their running total.
        </p>
        <p>
          The first player to reach <span className="font-semibold text-foreground">200 points</span> at the end of a
          round wins. If the top score is tied, play continues until someone breaks the tie.
        </p>
      </>
    ),
  },
];
