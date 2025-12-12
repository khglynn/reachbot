// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

// Initialize PostHog first (needed for Sentry integration)
// This runs before React, so we init here and the provider just wraps it
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  // Determine environment for PostHog
  const host = window.location.hostname
  let phEnvironment = 'development'
  if (host === 'eachie.ai' || host === 'eachie.me' || host === 'www.eachie.ai') phEnvironment = 'production'
  else if (host.includes('test.eachie')) phEnvironment = 'preview'

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
  });

  // Register environment as a super property
  posthog.register({ $environment: phEnvironment })
}

// Build integrations array
const integrations = [
  Sentry.replayIntegration({
    maskAllText: true,
    blockAllMedia: true,
  }),
];

// NOTE: PostHog-Sentry integration disabled - posthog.SentryIntegration is incompatible with Sentry v10
// To re-enable, need to use the new @posthog/sentry-integration package
// See: https://posthog.com/docs/libraries/sentry

// Determine environment based on Vercel's env or hostname
const getEnvironment = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'eachie.ai' || host === 'eachie.me' || host === 'www.eachie.ai') return 'production'
    if (host.includes('test.eachie')) return 'preview'
    if (host === 'localhost') return 'development'
  }
  return process.env.VERCEL_ENV || 'development'
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: getEnvironment(),

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 1,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature:
  replaysSessionSampleRate: 0.1,

  // If you don't want to use Session Replay, just remove the next line:
  replaysOnErrorSampleRate: 1.0,

  integrations,

  // Scrub request bodies to avoid storing user query content in error reports
  // This ensures BYOK/privacy-mode users don't have their queries leaked to Sentry
  beforeSend(event) {
    if (event.request?.data) {
      event.request.data = '[REDACTED]'
    }
    return event
  },
});

// Capture client-side navigation for Sentry tracing (Next.js 15+)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
