import { Hono } from 'hono'

import { Redis } from '@upstash/redis'
import { insertProduct, getDrizzle, getStorefrontData, getMarketplaceFeed, updateProductStock } from './db/db-operations'
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
  const upgradeHeader = c.req.header('Upgrade')
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket connection', 400)
  }

  const apiKey = c.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not defined')
    return c.text('GEMINI_API_KEY environment variable is missing', 500)
  }

  const [client, server] = new WebSocketPair()
  server.accept()

  // Connect to the Gemini Live API
  const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`
  const geminiWs = new WebSocket(geminiUrl)

  let geminiReady = false
  const clientMessageQueue: string[] = []

  geminiWs.addEventListener('open', () => {
    console.log('Connected to Gemini Live API')
    
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
  server.addEventListener('message', (event) => {
    const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
    if (geminiReady) {
      geminiWs.send(data)
    } else {
      clientMessageQueue.push(data)
    }
  })

  // Listen for messages from Gemini and forward them to the client
  geminiWs.addEventListener('message', async (event) => {
    try {
      let dataStr: string
      if (typeof event.data === 'string') {
        dataStr = event.data
      } else if (event.data instanceof ArrayBuffer) {
        dataStr = new TextDecoder().decode(event.data)
      } else {
        dataStr = new TextDecoder().decode(new Uint8Array(event.data as any))
      }

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
        }
      }
    } catch (e) {
      console.error('Error parsing Gemini message:', e)
    }

    // Forward back to client
    server.send(event.data)
  })

  // Manage clean disconnects
  server.addEventListener('close', () => {
    console.log('Client connection closed')
    if (geminiWs.readyState === WebSocket.OPEN || geminiWs.readyState === WebSocket.CONNECTING) {
      geminiWs.close()
    }
  })

  geminiWs.addEventListener('close', (event) => {
    console.log(`Gemini connection closed. Code: ${event.code}, Reason: ${event.reason}`)
    server.close()
  })

  server.addEventListener('error', (err) => {
    console.error('Client socket error:', err)
  })

  geminiWs.addEventListener('error', (err) => {
    console.error('Gemini socket error:', err)
  })

  return new Response(null, {
    status: 101,
    webSocket: client
  })
})

export default app
