import CharacterCard from '../coup/CharacterCard';
import ReferenceGuide from '../coup/ReferenceGuide';
import type { Character } from '@/game/coup/types';
import type { TutorialStep } from './TutorialModal';

function CardRow({ characters }: { characters: Character[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {characters.map((c) => (
        <CharacterCard key={c} character={c} size="sm" />
      ))}
    </div>
  );
}

export const COUP_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Bluff your way to the last influence',
    body: (
      <>
        <p>
          Each player secretly holds 2 face-down character cards — your <span className="font-semibold">influence</span>{' '}
          — and starts with 2 coins.
        </p>
        <p>
          On your turn, claim any character&apos;s power to use it — whether you actually hold that card or not. Nobody
          can see your cards, so bluffing is the whole game.
        </p>
        <p>Lose both your influence cards and you&apos;re out. Last player standing wins.</p>
      </>
    ),
  },
  {
    title: 'Your turn: one action, no passing',
    body: (
      <>
        <p>Turns go clockwise. Each turn you take exactly one action — you can&apos;t skip.</p>
        <p>
          After you declare it, other players get a chance to <span className="font-semibold text-foreground">challenge</span>{' '}
          (call your bluff) or <span className="font-semibold text-foreground">block</span> it before it resolves. No
          objections, and it just happens.
        </p>
        <p>Starting your turn with 10+ coins? You must Coup — no other action is legal.</p>
      </>
    ),
  },
  {
    title: 'General actions — always available',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <span className="font-semibold text-foreground">Income</span> — take 1 coin. Can&apos;t be blocked or
          challenged.
        </li>
        <li>
          <span className="font-semibold text-foreground">Foreign Aid</span> — take 2 coins. Any player can block it by
          claiming the Duke.
        </li>
        <li>
          <span className="font-semibold text-foreground">Coup</span> — pay 7 coins to force an opponent to lose an
          influence. Always works, can&apos;t be blocked or challenged.
        </li>
      </ul>
    ),
  },
  {
    title: 'Character actions — claim a card to use it',
    visual: <CardRow characters={['duke', 'assassin', 'captain', 'ambassador']} />,
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <span className="font-semibold text-foreground">Duke</span> — take 3 coins from the treasury.
        </li>
        <li>
          <span className="font-semibold text-foreground">Assassin</span> — pay 3 coins to assassinate: a target loses an
          influence if it goes through.
        </li>
        <li>
          <span className="font-semibold text-foreground">Captain</span> — steal 2 coins from another player.
        </li>
        <li>
          <span className="font-semibold text-foreground">Ambassador</span> — draw 2 cards from the deck, swap into your
          hand any you like, return the rest.
        </li>
      </ul>
    ),
  },
  {
    title: 'Blocking — claim a card to stop one',
    visual: <CardRow characters={['contessa']} />,
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <span className="font-semibold text-foreground">Duke</span> blocks Foreign Aid.
        </li>
        <li>
          <span className="font-semibold text-foreground">Contessa</span> blocks an Assassination.
        </li>
        <li>
          <span className="font-semibold text-foreground">Ambassador</span> or <span className="font-semibold text-foreground">Captain</span> blocks a Steal.
        </li>
      </ul>
    ),
  },
  {
    title: 'Challenges — calling a bluff',
    body: (
      <>
        <p>
          Anyone can challenge a claimed action or block. The claimer must then reveal a matching card, or lose the
          challenge.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <span className="font-semibold text-foreground">They were bluffing:</span> they lose an influence, and their
            action fails.
          </li>
          <li>
            <span className="font-semibold text-foreground">They were telling the truth:</span> they reveal the card,
            shuffle it back for a fresh random one, and the challenger loses an influence instead.
          </li>
        </ul>
        <p>Losing a challenge while also being successfully assassinated can cost you both influence in one turn.</p>
      </>
    ),
  },
  {
    title: 'Quick reference',
    visual: <ReferenceGuide />,
    body: (
      <p>
        The same cheat sheet is available anytime mid-game — hover the card in the corner of the table if you need a
        reminder of who blocks what.
      </p>
    ),
  },
];
