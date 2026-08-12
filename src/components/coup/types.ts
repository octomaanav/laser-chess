// Shared UI-only types for the Coup component tree.
import type { ClientCoupState } from '@/game/coup/redact';

// CoupGamePlay.tsx synthesizes a countdown (in whole seconds) from
// CoupView.responseDeadline (epoch ms) + a local render tick. It isn't part
// of the ClientCoupState wire payload, so components that need it (CoupTable,
// ResponseModal) accept this widened type instead of the bare ClientCoupState.
export type StateWithCountdown = ClientCoupState & { responseSecondsRemaining: number };
