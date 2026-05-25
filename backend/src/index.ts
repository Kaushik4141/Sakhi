import { Hono } from 'hono'
import { Redis } from '@upstash/redis'
import { insertProduct, getDrizzle, getStorefrontData, getMarketplaceFeed, updateProductStock, createArtisanProfile, createProductListing, insertMarketInsight, getBusinessSnapshot } from './db/db-operations'
import { artisans } from './db/schema'
import { eq } from 'drizzle-orm'
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
  async set(key: string, value: any, options?: any) {
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

app.post('/api/market-insights', async (c) => {
  try {
    const { artisanId, rawMarketData, structuredJson, kannadaDigest, roadmapKannada } = await c.req.json()

    if (!artisanId) {
      return c.json({ success: false, error: 'artisanId is required' }, 400)
    }

    const result = await insertMarketInsight(
      c.env.DB,
      artisanId,
      rawMarketData,
      structuredJson,
      kannadaDigest,
      roadmapKannada
    )

    if (!result.success) {
      return c.json(result, 500)
    }

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
  const sessionMemory: string[] = []

  // Initialize Redis for Recent Turn Memory
  const redisUrl = c.env.UPSTASH_REDIS_REST_URL
  const redisToken = c.env.UPSTASH_REDIS_REST_TOKEN
  let redisClient: any = null
  if (redisUrl && redisToken) {
    redisClient = new Redis({ url: redisUrl, token: redisToken })
  } else {
    console.warn(`[WS:${requestId}] Redis credentials missing. Falling back to Mock In-Memory Redis.`)
    redisClient = new MockRedis()
  }

  // ── Language-aware system prompt builder ──────────────────────────────────
  function buildSystemPrompt(language: string, isNewUser: boolean, artisanProfile?: any, businessSnapshot?: any, recentMemory?: string[]): string {
    const langMap: Record<string, { name: string; greeting: string }> = {
      kannada:  { name: 'Kannada', greeting: 'ನಮಸ್ಕಾರ' },
      hindi:    { name: 'Hindi',   greeting: 'नमस्ते' },
      english:  { name: 'English', greeting: 'Hello' },
      kn:       { name: 'Kannada', greeting: 'ನಮಸ್ಕಾರ' },
      hi:       { name: 'Hindi',   greeting: 'नमस्ते' },
      en:       { name: 'English', greeting: 'Hello' },
      es:       { name: 'Spanish', greeting: 'Hola' },
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
      prompt += `2. Ask for her district\n`
      prompt += `3. Ask what she makes (her craft type — e.g., pottery, weaving, embroidery)\n`
      prompt += `4. Ask how long she has been making it (experience in years)\n\n`
      prompt += `After collecting ALL FOUR answers, confirm the details back to her in ${lang.name} and say "Your shop is being set up!" `
      prompt += `Then immediately call the "create_artisan_profile" tool with the collected data.\n\n`
      prompt += `Do NOT skip any question. Do NOT ask multiple questions at once.\n`
      prompt += `ONCE YOU HAVE CALLED 'create_artisan_profile' AND RECEIVED A SUCCESS MESSAGE, ONBOARDING IS COMPLETE. `
      prompt += `DO NOT ask the onboarding questions again. Immediately shift to helping them manage their business!\n`
    } else {
      prompt += `This user already has a profile! Here is their business context:\n`
      if (artisanProfile) {
        prompt += `- Name: ${artisanProfile.name}\n`
        prompt += `- Craft: ${artisanProfile.craftType || 'Artisan Craft'}\n`
        prompt += `- District: ${artisanProfile.region}\n`
      }
      if (businessSnapshot) {
        const snap = typeof businessSnapshot === 'string' ? JSON.parse(businessSnapshot) : businessSnapshot;
        prompt += `- 7-Day Revenue: ₹${snap.week_revenue_inr || 0}\n`
        prompt += `- Top Selling Item: ${snap.top_seller || 'None'}\n`
        prompt += `- Dead Stock Item: ${snap.dead_stock_item || 'None'}\n`
        prompt += `- Pending Payments: ₹${snap.pending_payment_inr || 0}\n\n`
      }
      prompt += `Help them manage their business — adding products, updating stock, checking orders, or answering business questions.\n\n`
    }

    if (recentMemory && recentMemory.length > 0) {
      prompt += `=========================================\n`
      prompt += `RECENT CONVERSATION HISTORY (From your last session):\n`
      for (const msg of recentMemory) {
        prompt += `- ${msg}\n`
      }
      prompt += `=========================================\n`
      prompt += `Continue the conversation naturally from here. Do not explicitly greet them again unless it makes sense.\n`
    }

    return prompt
  }

  // ── Build the Gemini setup payload ────────────────────────────────────────
  function buildSetupPayload(language: string, isNewUser: boolean, artisanProfile?: any, businessSnapshot?: any, recentMemory?: string[]) {
    return {
      setup: {
        model: 'models/gemini-2.5-flash-native-audio-latest',
        generationConfig: {
          responseModalities: ['AUDIO']
        },
        systemInstruction: {
          parts: [
            {
              text: buildSystemPrompt(language, isNewUser, artisanProfile, businessSnapshot, recentMemory)
            }
          ]
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'create_product_listing',
                description: 'Create a new product listing when the artisan describes something she made and its price.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    product_name_original: {
                      type: 'STRING',
                      description: 'The name of the product in the language she spoke.'
                    },
                    price_inr: {
                      type: 'INTEGER',
                      description: 'The price of the product in rupees.'
                    },
                    material: {
                      type: 'STRING',
                      description: 'The material used (e.g. silk, cotton, clay), if mentioned.'
                    },
                    color: {
                      type: 'STRING',
                      description: 'The color of the product, if mentioned.'
                    }
                  },
                  required: ['product_name_original', 'price_inr']
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
                description: 'Create a new artisan profile after onboarding. Called after collecting name, district, craft type, and experience.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    name: {
                      type: 'STRING',
                      description: 'The full name of the artisan.'
                    },
                    district: {
                      type: 'STRING',
                      description: 'The district where the artisan lives.'
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
                  required: ['name', 'district', 'craft_type', 'experience_years']
                }
              },
              {
                name: 'get_business_snapshot',
                description: 'Get the artisan\'s business summary: revenue, top seller, dead stock, pending payments. Call this when she greets you or asks how business is going.',
                parameters: {
                  type: 'OBJECT',
                  properties: {},
                  required: []
                }
              }
            ]
          }
        ]
      }
    }
  }

  // ── Helper for calling Gemini REST API ──────────────────────────────────────
  async function generateGeminiContent(prompt: string, apiKey: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[REST API] Gemini generateContent failed:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }
    const data = await response.json() as any;
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
    let isNewUser = true
    let artisanProfile = null
    let businessSnapshot = null
    let recentMemory: string[] = []
    
    try {
      if (artisanId && !artisanId.startsWith('guest_')) {
        const drizzleDb = getDrizzle(c.env.DB)
        // Properly check if this exact artisan ID exists
        const existing = await drizzleDb.select().from(artisans).where(eq(artisans.id, artisanId)).limit(1)
        if (existing.length > 0) {
          isNewUser = false
          artisanProfile = existing[0]
          businessSnapshot = await getBusinessSnapshot(c.env.DB, artisanId)
        }
        
        if (redisClient) {
          const memoryKey = `memory:${artisanId}`
          const storedMemory = await redisClient.get(memoryKey)
          if (storedMemory && Array.isArray(storedMemory)) {
             recentMemory = storedMemory
             console.log(`[WS:${requestId}] Loaded ${recentMemory.length} recent memory turns for ${artisanId}`)
          }
        }
      }
    } catch (err) {
      console.warn(`[WS:${requestId}] Could not check artisan existence or memory:`, err)
    }

    console.log(`[WS:${requestId}] Building setup. language=${language}, isNewUser=${isNewUser}, artisanId=${artisanId}`)
    const setupPayload = buildSetupPayload(language, isNewUser, artisanProfile, businessSnapshot, recentMemory)

    if (geminiReady && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(JSON.stringify(setupPayload))
      console.log(`[WS:${requestId}] Gemini setup sent with language=${language}`)
    } else {
      // Gemini hasn't connected yet — queue the setup as the first message
      clientMessageQueue.unshift(JSON.stringify(setupPayload))
      console.log(`[WS:${requestId}] Gemini not ready yet — setup queued`)
    }
    geminiSetupSent = true

    // Add a kickoff message to force Gemini to speak first
    const kickoffMessage = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: 'Hello! I have just opened the app. Please greet me.' }]
          }
        ],
        turnComplete: true
      }
    }
    
    if (geminiReady && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.send(JSON.stringify(kickoffMessage))
    } else {
      clientMessageQueue.push(JSON.stringify(kickoffMessage))
    }

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
              const district = args?.district
              const craftType = args?.craft_type
              const experienceYears = args?.experience_years
              
              let toolMessage = ''
              let success = false
              let shopSlug = ''
              let artisanId = ''
              
              try {
                const result = await createArtisanProfile(c.env.DB, name, district, craftType, experienceYears)
                
                if (result.success) {
                  artisanId = result.artisan?.id as string
                  shopSlug = result.artisan?.shopSlug as string
                  success = true
                  const shopUrl = `https://kalamitra.in/shop/${shopSlug}`
                  toolMessage = `Artisan profile for '${name}' created successfully! Shop URL: ${shopUrl}. SYSTEM OVERRIDE: Onboarding is 100% COMPLETE. Do not ask for name, district, craft, or experience anymore. Transition to business management mode. Acknowledge shop is ready and ask what product to list first.`
                  console.log(`[WS:${requestId}] ONBOARDING SUCCESS: Artisan ID = ${artisanId}, Shop = ${shopSlug}`)
                  sessionMemory.push(`Action: I just successfully created the artisan profile for ${name}. Onboarding is now complete.`)
                  
                  // Send the new artisan ID back to the client so they can store it
                  server.send(JSON.stringify({
                    type: 'artisan_created',
                    artisanId,
                    shopSlug,
                    shopUrl,
                  }))
                } else {
                  toolMessage = `Failed to create artisan profile: ${result.error}`
                  console.error(`[WS:${requestId}] ONBOARDING FAILED: ${result.error}`)
                }
              } catch (dbErr: any) {
                toolMessage = `Database transaction error: ${dbErr.message}`
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
                          message: toolMessage,
                          shop_url: success ? `https://kalamitra.in/shop/${shopSlug}` : undefined
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

          const createProductListingCalls = functionCalls.filter(call => call.name === 'create_product_listing')
          if (createProductListingCalls.length > 0) {
            for (const call of createProductListingCalls) {
              const { id, args } = call
              const originalName = args?.product_name_original
              const price = args?.price_inr
              const material = args?.material
              const color = args?.color
              
              let toolMessage = ''
              let success = false
              
              try {
                // 1. Translate product name to English
                const translatePrompt = `Translate this Indian handicraft product name to English, keeping it natural but descriptive. Just return the translated name, nothing else: "${originalName}"`
                const titleEn = await generateGeminiContent(translatePrompt, c.env.GEMINI_API_KEY)
                
                // 2. Generate 100-word SEO description
                const details = [
                  `Name: ${titleEn}`,
                  material ? `Material: ${material}` : '',
                  color ? `Color: ${color}` : '',
                  `Price: ₹${price}`
                ].filter(Boolean).join(', ')
                
                const seoPrompt = `Write a 100-word product description for an Indian handcraft marketplace for: [${details}]. Focus on authenticity, craftsmanship, and heritage. Do not include introductory phrases, just the description.`
                const descriptionSeo = await generateGeminiContent(seoPrompt, c.env.GEMINI_API_KEY)
                
                // 3. Insert into database
                // Note: The createProductListing function must exist in db-operations.ts
                const result = await createProductListing(
                  c.env.DB,
                  sessionArtisanId, // We get this from the init message earlier
                  originalName,
                  titleEn,
                  descriptionSeo,
                  price
                )
                
                if (result.success) {
                  success = true
                  const shopUrl = `https://kalamitra.in/shop/${result.shopSlug}#${result.product?.id}`
                  toolMessage = `Product listed successfully! Storefront URL: ${shopUrl}`
                  console.log(`[WS:${requestId}] PRODUCT LISTED: ${titleEn} for ₹${price}`)
                  sessionMemory.push(`Action: I just successfully created a product listing for ${titleEn} priced at ₹${price}.`)
                } else {
                  toolMessage = `Failed to list product: ${result.error}`
                  console.error(`[WS:${requestId}] LISTING FAILED: ${result.error}`)
                }
              } catch (err: any) {
                toolMessage = `Error processing listing: ${err.message}`
                console.error(`[WS:${requestId}] Error processing product listing:`, err)
              }
              
              const responsePayload = {
                toolResponse: {
                  functionResponses: [
                    {
                      id: id,
                      name: 'create_product_listing',
                      response: {
                        output: {
                          success,
                          message: toolMessage
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

          const getSnapshotCalls = functionCalls.filter(call => call.name === 'get_business_snapshot')
          if (getSnapshotCalls.length > 0) {
            for (const call of getSnapshotCalls) {
              const { id } = call
              let toolMessage = ''
              
              try {
                // We use sessionArtisanId that was set during init
                toolMessage = await getBusinessSnapshot(c.env.DB, sessionArtisanId)
                console.log(`[WS:${requestId}] GET SNAPSHOT for artisan: ${sessionArtisanId}`)
                sessionMemory.push(`Action: I just checked the business snapshot to see how they are doing.`)
              } catch (err: any) {
                toolMessage = JSON.stringify({ error: `Error fetching snapshot: ${err.message}` })
                console.error(`[WS:${requestId}] Error fetching snapshot:`, err)
              }
              
              const responsePayload = {
                toolResponse: {
                  functionResponses: [
                    {
                      id: id,
                      name: 'get_business_snapshot',
                      response: {
                        output: {
                          snapshot: toolMessage
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
              sessionMemory.push(`Sakhi: ${part.text}`)
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
  const saveMemoryOnClose = () => {
    if (redisClient && sessionArtisanId && !sessionArtisanId.startsWith('guest_') && sessionMemory.length > 0) {
      const memoryKey = `memory:${sessionArtisanId}`
      const memoryToSave = sessionMemory.slice(-5) // Keep last 5 turns
      redisClient.set(memoryKey, JSON.stringify(memoryToSave), { ex: 86400 }).catch((err: any) => {
        console.error(`[WS:${requestId}] Failed to save session memory to Redis:`, err)
      })
      console.log(`[WS:${requestId}] Saved ${memoryToSave.length} turns to Redis memory for ${sessionArtisanId}`)
    }
  }

  server.addEventListener('close', () => {
    console.log(`[WS:${requestId}] Client connection closed`)
    saveMemoryOnClose()
    if (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING) {
      geminiWs.close()
    }
  })

  geminiWs.addEventListener('close', (event: CloseEvent) => {
    console.log(`[WS:${requestId}] Gemini connection closed. code=${event.code}, reason="${event.reason}", wasClean=${event.wasClean}`)
    saveMemoryOnClose()
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
