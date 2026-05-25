import { Hono } from 'hono'

import { Redis } from '@upstash/redis'
import { insertProduct, getDrizzle, getStorefrontData, getMarketplaceFeed, updateProductStock, createArtisanProfile } from './db/db-operations'
import { artisans } from './db/schema'
import { runTestFlow } from './db/test-db'

type Bindings = {
  GEMINI_API_KEY: string
  DB: D1Database
  UPSTASH_REDIS_REST_URL: string
  UPSTASH_REDIS_REST_TOKEN: string
}



const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  return c.text('Gemini Live API WebSocket Proxy is running!')
})

class MockRedis {
  private store = new Map<string, any>()
  async get(key: string) {
    return this.store.get(key) || null
  }
  async set(key: string, value: any) {
    this.store.set(key, value)
    return 'OK'
  }
}

app.get('/test-db-flow', async (c) => {
  try {
    const url = c.env.UPSTASH_REDIS_REST_URL
    const token = c.env.UPSTASH_REDIS_REST_TOKEN

    let redis: any
    let usingMockRedis = false

    if (!url || !token) {
      console.warn("UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing. Using Mock In-Memory Redis fallback.")
      redis = new MockRedis()
      usingMockRedis = true
    } else {
      redis = new Redis({ url, token })
    }

    const result = await runTestFlow(c.env.DB, redis)
    return c.json({
      ...result,
      usingMockRedis
    })
  } catch (err: any) {
    return c.json({
      success: false,
      error: err.message
    }, 500)
  }
})

app.get('/storefront/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')
    const result = await getStorefrontData(c.env.DB, slug)
    if (!result.success) {
      return c.json(result, 404)
    }
    return c.json(result)
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
})

app.get('/marketplace', async (c) => {
  try {
    const result = await getMarketplaceFeed(c.env.DB)
    return c.json(result)
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500)
  }
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
  let geminiSetupSent = false
  let sessionLanguage = 'english'
  let sessionArtisanId = ''
  const clientMessageQueue: string[] = []

  // ── Language-aware system prompt builder ──────────────────────────────────
  function buildSystemPrompt(language: string, isNewUser: boolean): string {
    const langMap: Record<string, { name: string; greeting: string }> = {
      kannada:  { name: 'Kannada', greeting: 'ನಮಸ್ಕಾರ' },
      hindi:    { name: 'Hindi',   greeting: 'नमस्ते' },
      english:  { name: 'English', greeting: 'Hello' },
    }
    const lang = langMap[language.toLowerCase()] || langMap.english

    let prompt = `You are Sakhi (सखी / ಸಖಿ), a warm and empathetic AI business companion for rural Indian artisans. `
    prompt += `You MUST speak ONLY in ${lang.name}. Every single word of your response must be in ${lang.name}. `
    prompt += `Never switch to another language unless the user explicitly asks you to. `
    prompt += `Be conversational, supportive, and encouraging — like a trusted friend who understands small business.\n\n`

    if (isNewUser) {
      prompt += `IMPORTANT: This is a NEW user who has not set up their profile yet. `
      prompt += `You must run a structured onboarding conversation. `
      prompt += `Start by greeting them warmly ("${lang.greeting}!") and explain that you will help them set up their shop.\n\n`
      prompt += `Ask these questions ONE AT A TIME, waiting for the user's answer before moving to the next:\n`
      prompt += `1. Ask for her name\n`
      prompt += `2. Ask for her village or district\n`
      prompt += `3. Ask what she makes (her craft type — e.g., pottery, weaving, embroidery)\n`
      prompt += `4. Ask how long she has been making it (experience in years)\n\n`
      prompt += `After collecting ALL FOUR answers, confirm the details back to her in ${lang.name} and say "Your shop is being set up!" `
      prompt += `Then immediately call the "create_artisan_profile" tool with the collected data.\n\n`
      prompt += `Do NOT skip any question. Do NOT ask multiple questions at once.\n`
    } else {
      prompt += `This user already has a profile. Help them manage their business — `
      prompt += `adding products, updating stock, checking orders, or answering business questions.\n`
    }

    return prompt
  }

  // ── Build the Gemini setup payload ────────────────────────────────────────
  function buildSetupPayload(language: string, isNewUser: boolean) {
    return {
      setup: {
        model: 'models/gemini-2.5-flash-native-audio-latest',
        generationConfig: {
          responseModalities: ['AUDIO']
        },
        systemInstruction: {
          parts: [
            {
              text: buildSystemPrompt(language, isNewUser)
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
              },
              {
                name: 'update_stock',
                description: 'Update the manual stock of a product belonging to the artisan by its name.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    name: {
                      type: 'STRING',
                      description: 'The name of the product (exact or part of the name).'
                    },
                    additional_stock: {
                      type: 'INTEGER',
                      description: 'The quantity of stock to add/increment.'
                    }
                  },
                  required: ['name', 'additional_stock']
                }
              },
              {
                name: 'create_artisan_profile',
                description: 'Create a new artisan profile after onboarding. Called after collecting name, village, craft type, and experience.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    name: {
                      type: 'STRING',
                      description: 'The full name of the artisan.'
                    },
                    village: {
                      type: 'STRING',
                      description: 'The village or district where the artisan lives.'
                    },
                    craft_type: {
                      type: 'STRING',
                      description: 'The type of craft the artisan makes (e.g., pottery, weaving, embroidery).'
                    },
                    experience_years: {
                      type: 'STRING',
                      description: 'How long the artisan has been practicing their craft (e.g., "5 years", "10 years").'
                    }
                  },
                  required: ['name', 'village', 'craft_type', 'experience_years']
                }
              }
            ]
          }
        ]
      }
    }
  }

  geminiWs.addEventListener('open', () => {
    console.log(`[WS:${requestId}] Connected to Gemini Live API`)
    geminiReady = true

    // If we already received the init message before Gemini opened, send setup now
    if (geminiSetupSent) {
      console.log(`[WS:${requestId}] Gemini opened after init received — flushing queue`)
      while (clientMessageQueue.length > 0) {
        const msg = clientMessageQueue.shift()
        if (msg !== undefined) {
          geminiWs.send(msg)
        }
      }
    }
    // Otherwise, we wait for the client's init message to arrive
  })

  // ── Send setup to Gemini once we know the language ─────────────────────
  async function sendGeminiSetup(language: string, artisanId: string) {
    // Check if this artisan already exists in the DB
    let isNewUser = true
    try {
      if (artisanId && !artisanId.startsWith('guest_')) {
        const drizzleDb = getDrizzle(c.env.DB)
        const existing = await drizzleDb.select().from(artisans).limit(1)
        if (existing.length > 0) {
          isNewUser = false
        }
      }
    } catch (err) {
      console.warn(`[WS:${requestId}] Could not check artisan existence:`, err)
    }

    console.log(`[WS:${requestId}] Building setup. language=${language}, isNewUser=${isNewUser}, artisanId=${artisanId}`)
    const setupPayload = buildSetupPayload(language, isNewUser)

    if (geminiReady && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(JSON.stringify(setupPayload))
      console.log(`[WS:${requestId}] Gemini setup sent with language=${language}`)
    } else {
      // Gemini hasn't connected yet — queue the setup as the first message
      clientMessageQueue.unshift(JSON.stringify(setupPayload))
      console.log(`[WS:${requestId}] Gemini not ready yet — setup queued`)
    }
    geminiSetupSent = true

    // Flush any audio messages that were queued while waiting
    if (geminiReady && geminiWs.readyState === WebSocket.OPEN) {
      while (clientMessageQueue.length > 0) {
        const msg = clientMessageQueue.shift()
        if (msg !== undefined) {
          geminiWs.send(msg)
        }
      }
    }
  }

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

      // ── Handle init message from client ──────────────────────────────
      if (payload.type === 'init') {
        sessionLanguage = payload.language || 'english'
        sessionArtisanId = payload.artisanId || ''
        console.log(`[WS:${requestId}] Init received. language=${sessionLanguage}, artisanId=${sessionArtisanId}`)
        await sendGeminiSetup(sessionLanguage, sessionArtisanId)
        return
      }

      // ── Don't forward anything until setup is sent ───────────────────
      if (!geminiSetupSent) {
        console.warn(`[WS:${requestId}] Message received before init — queueing`)
        clientMessageQueue.push(dataStr)
        return
      }

      if (payload.realtimeInput?.mediaChunks) {
        const firstChunk = payload.realtimeInput.mediaChunks[0]
        if (geminiReady && geminiWs.readyState === WebSocket.OPEN) {
          geminiWs.send(dataStr)
        } else {
          clientMessageQueue.push(dataStr)
        }
        return
      }

      // Intercept the client's custom audio event
      if (payload.event === 'user_audio' && payload.data) {
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
          geminiWs.send(msgToSend)
        } else {
          clientMessageQueue.push(msgToSend)
        }
        return
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

          const updateStockCalls = functionCalls.filter(call => call.name === 'update_stock')
          if (updateStockCalls.length > 0) {
            for (const call of updateStockCalls) {
              const { id, args } = call
              const name = args?.name
              const additionalStock = args?.additional_stock
              
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

                // Update product stock
                const result = await updateProductStock(c.env.DB, artisanId, name, additionalStock)
                
                if (result.success) {
                  success = true
                  message = `Product '${result.productName}' stock updated successfully in DB. New total stock: ${result.newStock}`
                  console.log(`DATABASE STOCK UPDATE SUCCESS: Product '${result.productName}', Stock: ${result.newStock}`)
                } else {
                  message = `Failed to update product stock in DB: ${result.error}`
                  console.error(`DATABASE STOCK UPDATE FAILED: ${result.error}`)
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
                      name: 'update_stock',
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

          const createProfileCalls = functionCalls.filter(call => call.name === 'create_artisan_profile')
          if (createProfileCalls.length > 0) {
            for (const call of createProfileCalls) {
              const { id, args } = call
              const name = args?.name
              const village = args?.village
              const craftType = args?.craft_type
              const experienceYears = args?.experience_years
              
              let message = ''
              let success = false
              
              try {
                const result = await createArtisanProfile(c.env.DB, name, village, craftType, experienceYears)
                
                if (result.success) {
                  success = true
                  message = `Artisan profile for '${name}' created successfully! Shop slug: ${result.artisan?.shopSlug}`
                  console.log(`[WS:${requestId}] ONBOARDING SUCCESS: Artisan ID = ${result.artisan?.id}, Shop = ${result.artisan?.shopSlug}`)
                  
                  // Send the new artisan ID back to the client so they can store it
                  server.send(JSON.stringify({
                    type: 'artisan_created',
                    artisanId: result.artisan?.id,
                    shopSlug: result.artisan?.shopSlug,
                  }))
                } else {
                  message = `Failed to create artisan profile: ${result.error}`
                  console.error(`[WS:${requestId}] ONBOARDING FAILED: ${result.error}`)
                }
              } catch (dbErr: any) {
                message = `Database transaction error: ${dbErr.message}`
                console.error(`[WS:${requestId}] Database error during onboarding:`, dbErr)
              }
              
              const responsePayload = {
                toolResponse: {
                  functionResponses: [
                    {
                      id: id,
                      name: 'create_artisan_profile',
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

        // Log Gemini Text and Audio responses
        if (payload.serverContent?.modelTurn?.parts) {
          for (const part of payload.serverContent.modelTurn.parts) {
            if (part.text) {
              const preview = part.text.length > 50 ? part.text.substring(0, 50) + '...' : part.text
              console.log(`[WS:${requestId}] Gemini sent TEXT: ${preview}`)
            }
            if (part.inlineData && part.inlineData.mimeType?.includes('audio/pcm')) {
              console.log(`[WS:${requestId}] Gemini sent AUDIO chunk: ${part.inlineData.data?.length} bytes`)
            }
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
