import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { query, apiKey } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const openrouter = createOpenRouter({
      apiKey: apiKey || process.env.OPENROUTER_API_KEY!,
    })

    const result = await generateText({
      model: openrouter('anthropic/claude-haiku-4.5'),
      messages: [
        {
          role: 'system',
          content: `You analyze research questions and generate 2-4 SPECIFIC clarifying questions that would significantly improve the research quality.

RULES:
1. Questions must be SPECIFIC to this exact query - no generic "what industry?" type questions
2. Focus on ambiguities, scope decisions, or important context missing from the query
3. If the query is already very clear and specific, return just 1-2 questions or empty array
4. Each question under 20 words
5. Ask about things that would change what information is relevant

EXAMPLES:

Query: "Best laptop for me"
Questions: ["Are you prioritizing portability or performance?", "What's your budget range?", "Any specific software you need to run?"]

Query: "How does photosynthesis work?"  
Questions: [] (already specific, no clarification needed)

Query: "Compare React and Vue for my project"
Questions: ["Is this a new project or migrating existing code?", "What's your team's current experience with JS frameworks?"]

Query: "I need a tart, dairy free dessert for thanksgiving"
Questions: ["How many people are you serving?", "Any nut allergies to consider?", "Do you have a preferred level of difficulty?"]

Respond ONLY with a JSON array of question strings. Empty array if no clarification needed.`
        },
        {
          role: 'user',
          content: query
        }
      ],
      maxTokens: 400,
    })

    let questions: string[] = []
    try {
      const match = result.text.match(/\[[\s\S]*\]/)
      if (match) {
        questions = JSON.parse(match[0])
      }
    } catch {
      // If parsing fails, no questions
      questions = []
    }

    return NextResponse.json({ questions: questions.slice(0, 4) })
  } catch (error) {
    console.error('Clarify API error:', error)
    // On error, just proceed without questions
    return NextResponse.json({ questions: [] })
  }
}
