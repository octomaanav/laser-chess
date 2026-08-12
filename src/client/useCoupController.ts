'use client';
import { useSyncExternalStore } from 'react';
import { CoupController, type CoupView } from './coupController';

// One controller instance for the app lifetime (survives React strict-mode
// remounts). On the server it is inert and only produces the initial snapshot.
let _controller: CoupController | null = null;
export function getCoupController(): CoupController {
  if (!_controller) _controller = new CoupController();
  return _controller;
}

export function useCoupController(): { controller: CoupController; view: CoupView } {
  const controller = getCoupController();
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  return { controller, view };
}
