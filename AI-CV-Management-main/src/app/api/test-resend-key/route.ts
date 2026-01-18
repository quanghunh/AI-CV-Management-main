// src/app/api/test-resend-key/route.ts
import { Resend } from 'resend'

export async function POST(request: Request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_SITE_URL || '*',
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ message: 'Invalid JSON body' }), { status: 400, headers })
  }

  const { apiKey } = body

  if (!apiKey) {
    return new Response(JSON.stringify({ message: 'API Key is required' }), { status: 400, headers })
  }

  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.apiKeys.list()

    if (error) {
      return new Response(JSON.stringify({ message: error.message || 'Invalid API Key' }), { status: 401, headers })
    }

    return new Response(JSON.stringify({ message: 'API Key is valid' }), { status: 200, headers })
  } catch (err: any) {
    return new Response(JSON.stringify({ message: err.message || 'Error validating API Key' }), { status: 500, headers })
  }
}