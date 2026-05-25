import { Hono } from 'hono'

type Bindings = {
  GEMINI_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  return c.text('Gemini Live API WebSocket Proxy is running!')
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
  geminiWs.addEventListener('message', (event) => {
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
              
              console.log(`MOCK DB WRITE: Created ${name} for ${price}`)
              
              const responsePayload = {
                toolResponse: {
                  functionResponses: [
                    {
                      id: id,
                      name: 'create_product',
                      response: {
                        output: {
                          success: true,
                          message: `Product '${name}' created successfully with price ${price}`
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
