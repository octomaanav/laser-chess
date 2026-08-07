'use client';
import { useSyncExternalStore } from 'react';
import { GameController, type ViewState } from './controller';

// One controller instance for the app lifetime (survives React strict-mode
// remounts). On the server it is inert and only produces the INITIAL snapshot.
let _controller: GameController | null = null;
export function getController(): GameController {
  if (!_controller) _controller = new GameController();
  return _controller;
}

export function useController(): { controller: GameController; view: ViewState } {
  const controller = getController();
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  return { controller, view };
}
