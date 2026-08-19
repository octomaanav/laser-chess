// Server-side registry of realtime games. Each game contributes one
// WebSocketServer keyed by its catalogue slug; the custom server routes
// /ws/<slug> upgrades to the matching handler. Adding a realtime game later =
// add one line here plus its own handler module.
import type { WebSocketServer } from 'ws';
import { createGameWss } from '../gameServer';
import { createCoupWss } from './coup/roomServer';
import { createFlip7Wss } from './flip7/roomServer';

export const GAME_WSS: Record<string, WebSocketServer> = {
  'laser-chess': createGameWss(),
  coup: createCoupWss(),
  flip7: createFlip7Wss(),
};
