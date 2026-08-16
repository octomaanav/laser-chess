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
          Each player secretly holds 2 face-down character cards representing your <span className="font-semibold">influence</span>,
          and starts with 2 coins.
        </p>
        <p>
          On your turn, you can claim any character&apos;s power regardless of whether you actually hold that card. Because your cards remain secret,
          bluffing is essential to winning.
        </p>
        <p>Lose both of your influence cards and you are out. The last player standing wins.</p>
      </>
    ),
  },
  {
    title: 'Your turn: one action, no passing',
    body: (
      <>
        <p>Turns proceed clockwise. You must take exactly one action on each turn because passing is not allowed.</p>
        <p>
          After you declare your action, other players can <span className="font-semibold text-foreground">challenge</span>{' '}
          (call your bluff) or <span className="font-semibold text-foreground">block</span> it before it resolves. If there are no
          objections, your action succeeds automatically.
        </p>
        <p>If you start your turn with 10 or more coins, you must launch a Coup because no other action is permitted.</p>
      </>
    ),
  },
  {
    title: 'General actions: always available',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <span className="font-semibold text-foreground">Income</span>: Take 1 coin from the treasury. This action cannot be blocked or challenged.
        </li>
        <li>
          <span className="font-semibold text-foreground">Foreign Aid</span>: Take 2 coins from the treasury. Any player can block this by claiming the Duke.
        </li>
        <li>
          <span className="font-semibold text-foreground">Coup</span>: Pay 7 coins to force an opponent to lose an influence. This action is guaranteed to succeed and cannot be blocked or challenged.
        </li>
      </ul>
    ),
  },
  {
    title: 'Character actions: claim a card to use it',
    visual: <CardRow characters={['duke', 'assassin', 'captain', 'ambassador']} />,
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <span className="font-semibold text-foreground">Duke</span>: Take 3 coins from the treasury (Tax).
        </li>
        <li>
          <span className="font-semibold text-foreground">Assassin</span>: Pay 3 coins to assassinate a chosen player, causing them to lose an influence.
        </li>
        <li>
          <span className="font-semibold text-foreground">Captain</span>: Steal 2 coins from another player (Extort).
        </li>
        <li>
          <span className="font-semibold text-foreground">Ambassador</span>: Draw 2 cards from the deck, exchange them with any in your hand, and return 2 cards to the deck.
        </li>
      </ul>
    ),
  },
  {
    title: 'Blocking: claim a card to stop an action',
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
    title: 'Challenges: calling a bluff',
    body: (
      <>
        <p>
          Anyone can challenge a claimed action or block. The claimer must then reveal a matching card or lose the challenge.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <span className="font-semibold text-foreground">They were bluffing:</span> They lose an influence and their action fails.
          </li>
          <li>
            <span className="font-semibold text-foreground">They were telling the truth:</span> They reveal the card,
            shuffle it back into the court deck for a fresh replacement, and the challenger loses an influence instead.
          </li>
        </ul>
        <p>Losing a challenge while also being successfully assassinated can cost you both influence cards in a single turn.</p>
      </>
    ),
  },
  {
    title: 'Quick reference',
    visual: <ReferenceGuide />,
    body: (
      <p>
        This cheat sheet is always accessible mid-game. You can hover or tap the card in the corner of the table whenever you need a quick reminder of roles and blocks.
      </p>
    ),
  },
];
