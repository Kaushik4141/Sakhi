const WebSocket = require('ws');
const apiKey = 'AIzaSyCpqsT1m5Uk5gALLR3_JVZOy7v4_GrNWEQ';
const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('Connected to Gemini');
  
  const setupPayload = {
    setup: {
      model: 'models/gemini-2.5-flash-native-audio-latest', // Let's try 2.5 flash
    }
  };
  ws.send(JSON.stringify(setupPayload));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('Received:', Object.keys(msg), JSON.stringify(msg).substring(0, 100));

  if (msg.setupComplete) {
    console.log('Setup complete, sending 3 seconds of silence...');
    
    let chunkCount = 0;
    const interval = setInterval(() => {
      // 0.1s of silence (16000 samples/sec * 0.1s = 1600 samples = 3200 bytes)
      const fakePcm = Buffer.alloc(3200).toString('base64');
      ws.send(JSON.stringify({
        realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: fakePcm }] }
      }));
      chunkCount++;
      if (chunkCount >= 30) { // 3 seconds
        clearInterval(interval);
        console.log('Finished sending silence.');
      }
    }, 100);
  }
});

ws.on('close', (code, reason) => {
  console.log(`Closed: ${code} ${reason}`);
  process.exit(0);
});

ws.on('error', (err) => console.error(err));
