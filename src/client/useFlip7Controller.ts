'use client';
import { useSyncExternalStore } from 'react';
import { Flip7Controller, type Flip7View } from './flip7Controller';

// One controller instance for the app lifetime (survives React strict-mode
// remounts). On the server it is inert and only produces the initial snapshot.
let _controller: Flip7Controller | null = null;
export function getFlip7Controller(): Flip7Controller {
  if (!_controller) _controller = new Flip7Controller();
  return _controller;
}

export function useFlip7Controller(): { controller: Flip7Controller; view: Flip7View } {
  const controller = getFlip7Controller();
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getServerSnapshot);
  return { controller, view };
}
