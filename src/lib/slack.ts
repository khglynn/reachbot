import { WebClient } from '@slack/web-api'
import crypto from 'crypto'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

// Verify Slack request signature
export function verifySlackRequest(
  signature: string | null,
  timestamp: string | null,
  body: string
): boolean {
  if (!signature || !timestamp) return false
  
  const signingSecret = process.env.SLACK_SIGNING_SECRET!
  const baseString = `v0:${timestamp}:${body}`
  const hmac = crypto.createHmac('sha256', signingSecret)
  hmac.update(baseString)
  const expectedSignature = `v0=${hmac.digest('hex')}`
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export { slack }
