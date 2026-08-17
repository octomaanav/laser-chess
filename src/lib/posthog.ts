// src/lib/posthog.ts
import posthog from 'posthog-js';

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
// Default to the same-origin Next.js reverse proxy (/ingest) which bypasses ad-blockers
export const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST && process.env.NEXT_PUBLIC_POSTHOG_HOST !== 'https://us.i.posthog.com'
    ? process.env.NEXT_PUBLIC_POSTHOG_HOST
    : '/ingest';

export function initPostHog() {
  if (typeof window === 'undefined') return;
  if (!POSTHOG_KEY) {
    if (process.env.NODE_ENV === 'development') {
      console.info('[PostHog] NEXT_PUBLIC_POSTHOG_KEY is not set. Analytics is in no-op mode.');
    }
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    ui_host: 'https://us.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: false, // We handle pageviews manually in Next.js App Router for accuracy
    capture_pageleave: true,
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: {
        password: true,
      },
    },
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') {
        ph.debug(false);
      }
    },
  });
}

export function captureEvent(eventName: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  if (POSTHOG_KEY) {
    posthog.capture(eventName, properties);
  }
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  if (POSTHOG_KEY) {
    posthog.identify(userId, traits);
  }
}

export function resetUser() {
  if (typeof window === 'undefined') return;
  if (POSTHOG_KEY) {
    posthog.reset();
  }
}

export { posthog };
