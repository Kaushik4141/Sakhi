import { Hono } from 'hono'

import { insertProduct, getDrizzle } from './db/db-operations'
import { artisans } from './db/schema'

type Bindings = {
  GEMINI_API_KEY: string
  DB: D1Database
}



const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  return c.text('Gemini Live API WebSocket Proxy is running!')
})

app.get('/ws', async (c) => {
  const requestId = crypto.randomUUID()
  console.log(`[WS:${requestId}] Incoming /ws request`)

  const upgradeHeader = c.req.header('Upgrade')
  if (upgradeHeader !== 'websocket') {
    console.warn(`[WS:${requestId}] Rejected non-websocket request. Upgrade=${upgradeHeader}`)
    return c.text('Expected WebSocket connection', 400)
  }

  const apiKey = c.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error(`[WS:${requestId}] GEMINI_API_KEY is not defined`)
    return c.text('GEMINI_API_KEY environment variable is missing', 500)
  }

  const pair = new WebSocketPair()
  const client = pair[0]
  const server = pair[1]
  server.accept()

  // Connect to the Gemini Live API
  const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`
  const geminiWs = new WebSocket(geminiUrl)

  let geminiReady = false
  const clientMessageQueue: string[] = []

  geminiWs.addEventListener('open', () => {
    console.log(`[WS:${requestId}] Connected to Gemini Live API`)
    
    // Send initial setup payload
    const setupPayload = {
      setup: {
        model: 'models/gemini-2.5-flash-native-audio-latest',
        generationConfig: {
          responseModalities: ['AUDIO']
        },
        systemInstruction: {
          parts: [
            {
              text: 'You are Kala-Mitra, an empathetic business companion for a rural artisan. Speak in English and Kannada.'
            }
          ]
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'create_product',
                description: 'Create a new product with the specified name and price.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    name: {
                      type: 'STRING',
                      description: 'The name of the product.'
                    },
                    price: {
                      type: 'INTEGER',
                      description: 'The price of the product.'
                    }
                  },
                  required: ['name', 'price']
                }
              }
            ]
          }
        ]
      }
    }
    
    geminiWs.send(JSON.stringify(setupPayload))
    geminiReady = true

    // Flush any messages queued while waiting for Gemini to open
    while (clientMessageQueue.length > 0) {
      const msg = clientMessageQueue.shift()
      if (msg !== undefined) {
        geminiWs.send(msg)
      }
    }
  })

  // Listen for messages from the client and forward them to Gemini
  server.addEventListener('message', async (event: MessageEvent) => {
    try {
      const dataStr = typeof event.data === 'string'
        ? event.data
        : new TextDecoder().decode(
            event.data instanceof ArrayBuffer
              ? event.data
              : new Uint8Array(event.data as any)
          )

      let payload;
      try {
        payload = JSON.parse(dataStr)
        console.log(`[WS:${requestId}] Client message parsed. keys=${Object.keys(payload).join(',')}, bytes=${dataStr.length}`)
      } catch (e) {
        console.error(`[WS:${requestId}] Failed to parse client message as JSON:`, e)
        return // Drop invalid messages to prevent crashing
      }

      if (payload.realtimeInput?.mediaChunks) {
        const firstChunk = payload.realtimeInput.mediaChunks[0]
        console.log(`[WS:${requestId}] Passing through realtimeInput. media_type=${firstChunk?.mimeType || 'missing'}, base64Kb=${((firstChunk?.data?.length || 0) / 1024).toFixed(1)}`)
        if (geminiReady && geminiWs.readyState === WebSocket.OPEN) {
          geminiWs.send(dataStr)
        } else {
          console.warn(`[WS:${requestId}] Gemini not ready. Queueing realtimeInput. geminiReady=${geminiReady}, readyState=${geminiWs.readyState}`)
          clientMessageQueue.push(dataStr)
        }
        return
      }

      // Intercept the client's custom audio event
      if (payload.event === 'user_audio' && payload.data) {
        console.log(`[WS:${requestId}] Received user audio. media_type=${payload.media_type || payload.mime_type || 'missing'}, base64Kb=${(payload.data.length / 1024).toFixed(1)}`)

        // Send directly to the Live API session
        const realtimeInput = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: payload.media_type || "audio/wav",
                data: payload.data
              }
            ]
          }
        }

        const msgToSend = JSON.stringify(realtimeInput)
        if (geminiReady && geminiWs.readyState === WebSocket.OPEN) {
          console.log(`[WS:${requestId}] Forwarding audio to Gemini`)
          geminiWs.send(msgToSend)
        } else {
          console.warn(`[WS:${requestId}] Gemini not ready. Queueing audio. geminiReady=${geminiReady}, readyState=${geminiWs.readyState}`)
          clientMessageQueue.push(msgToSend)
        }
        return // Always return — don't fall back to forwarding raw event
      }

      // Fallback: forward non-audio messages directly
      if (geminiReady && geminiWs.readyState === WebSocket.OPEN) {
        geminiWs.send(dataStr)
      } else {
        clientMessageQueue.push(dataStr)
      }
    } catch (err) {
      console.error('[Backend] Error handling client message:', err)
    }
  })

  // Listen for messages from Gemini and forward them to the client
  geminiWs.addEventListener('message', async (event: MessageEvent) => {
    // ALWAYS decode to string first — never forward raw binary to the client.
    // React Native WebSocket cannot reliably handle binary frames.
    let dataStr: string
    if (typeof event.data === 'string') {
      dataStr = event.data
    } else if (event.data instanceof ArrayBuffer) {
      dataStr = new TextDecoder().decode(event.data)
    } else {
      dataStr = new TextDecoder().decode(new Uint8Array(event.data as any))
    }

    try {
      const payload = JSON.parse(dataStr)
      if (payload.toolCall) {
        const functionCalls = payload.toolCall.functionCalls
        if (functionCalls && Array.isArray(functionCalls)) {
          const createProductCalls = functionCalls.filter(call => call.name === 'create_product')
          if (createProductCalls.length > 0) {
            for (const call of createProductCalls) {
              const { id, args } = call
              const name = args?.name
              const price = args?.price
              
              let message = ''
              let success = false
              
              try {
                // Ensure a default artisan exists in DB
                const drizzleDb = getDrizzle(c.env.DB)
                const artisanList = await drizzleDb.select().from(artisans).limit(1)
                let artisanId: string

                if (artisanList.length === 0) {
                  const newArtisan = await drizzleDb
                    .insert(artisans)
                    .values({
                      name: 'Kala Mitra Artisan',
                      region: 'Karnataka',
                      shopSlug: 'kala-mitra-shop',
                    })
                    .returning()
                  artisanId = newArtisan[0].id
                } else {
                  artisanId = artisanList[0].id
                }

                // Insert the product using our operation function
                const stock = 10 // Default stock
                const result = await insertProduct(c.env.DB, artisanId, name, price, stock)
                
                if (result.success) {
                  success = true
                  message = `Product '${name}' created successfully with price ${price} INR in DB`
                  console.log(`DATABASE WRITE SUCCESS: Product ID = ${result.product?.id}`)
                } else {
                  message = `Failed to create product in DB: ${result.error}`
                  console.error(`DATABASE WRITE FAILED: ${result.error}`)
                }
              } catch (dbErr: any) {
                message = `Database transaction error: ${dbErr.message}`
                console.error('Database transaction error:', dbErr)
              }
              
              const responsePayload = {
                toolResponse: {
                  functionResponses: [
                    {
                      id: id,
                      name: 'create_product',
                      response: {
                        output: {
                          success,
                          message
                        }
                      }
                    }
                  ]
                }
              }
              geminiWs.send(JSON.stringify(responsePayload))
            }
            return // Intercept: do not forward this toolCall to client
          }
        }
      }
    } catch (e) {
      console.error(`[WS:${requestId}] Error parsing Gemini message:`, e)
    }

    // Forward the decoded TEXT string to client — guarantees a text frame
    server.send(dataStr)
  })

  // Manage clean disconnects
  server.addEventListener('close', () => {
    console.log(`[WS:${requestId}] Client connection closed`)
    if (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING) {
      geminiWs.close()
    }
  })

  geminiWs.addEventListener('close', (event: CloseEvent) => {
    console.log(`[WS:${requestId}] Gemini connection closed. code=${event.code}, reason="${event.reason}", wasClean=${event.wasClean}`)
    server.close()
  })

  server.addEventListener('error', (err: Event) => {
    console.error(`[WS:${requestId}] Client socket error:`, err)
  })

  geminiWs.addEventListener('error', (err: Event) => {
    console.error(`[WS:${requestId}] Gemini socket error:`, err)
  })

  return new Response(null, {
    status: 101,
    webSocket: client
  })
})

export default app
