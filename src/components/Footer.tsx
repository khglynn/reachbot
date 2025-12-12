'use client'

/**
 * Footer
 *
 * Shared footer component for all pages.
 * Includes legal links, sign-in for guests, and feature request link.
 *
 * Created: December 2024
 */

import { SignedOut, SignInButton } from '@clerk/nextjs'

export function Footer() {
  return (
    <footer className="mt-6 text-xs text-paper-muted flex items-center justify-between">
      <div>
        <a href="/terms" className="hover:text-paper-accent">Terms</a>
        <span className="mx-2">·</span>
        <a href="/privacy" className="hover:text-paper-accent">Privacy</a>
      </div>
      <div className="flex items-center gap-4">
        <SignedOut>
          <SignInButton mode="modal">
            <button className="hover:text-paper-accent">Sign in</button>
          </SignInButton>
        </SignedOut>
        <a
          href="https://eachie.canny.io/feature-requests"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-paper-accent"
        >
          Request a Feature
        </a>
      </div>
    </footer>
  )
}
