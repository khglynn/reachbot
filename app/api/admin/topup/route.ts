/**
 * Admin Top-Up API
 *
 * Top up admin credits to $48 (capped at $56 max).
 *
 * Supports:
 * - GET with ?email= query param (for Slack link buttons)
 * - POST with JSON body { email: "..." }
 *
 * Created: December 2024
 */

import { NextRequest, NextResponse } from 'next/server'
import { topUpAdmin } from '@/server/queries/usage'

/**
 * Handle GET request (Slack link button clicks).
 * Returns HTML page showing result.
 */
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email')

  if (!email) {
    return new NextResponse(
      '<html><body><h1>❌ Missing email parameter</h1></body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

  try {
    const result = await topUpAdmin(email)

    const html = result.success
      ? `<html><body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>✅ Top-Up Complete</h1>
          <p>${result.message}</p>
          <p style="color: #666; margin-top: 20px;">You can close this tab.</p>
        </body></html>`
      : `<html><body style="font-family: system-ui; padding: 40px; text-align: center;">
          <h1>❌ Top-Up Failed</h1>
          <p>${result.message}</p>
        </body></html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (error) {
    console.error('[Admin Top-Up] Error:', error)
    return new NextResponse(
      '<html><body><h1>❌ Error</h1><p>Failed to top up admin. Check logs.</p></body></html>',
      { headers: { 'Content-Type': 'text/html' }, status: 500 }
    )
  }
}

/**
 * Handle POST request (direct API calls).
 */
export async function POST(request: NextRequest) {
  const body = await request.json()
  const email = body.email

  if (!email) {
    return NextResponse.json(
      { error: 'Missing email parameter' },
      { status: 400 }
    )
  }

  try {
    const result = await topUpAdmin(email)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[Admin Top-Up] Error:', error)
    return NextResponse.json(
      { error: 'Failed to top up admin' },
      { status: 500 }
    )
  }
}
