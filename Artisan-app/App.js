import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  StatusBar,
  SafeAreaView,
  Platform,
  NativeModules,
  Dimensions,
  Easing,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { WebView } from 'react-native-webview';
import { useSharedValue, withTiming, useDerivedValue, useFrameCallback } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import { Canvas, Path, Skia, LinearGradient, vec } from '@shopify/react-native-skia';

// ─── WebSocket Config ──────────────────────────────────────────────────────────
function getDevServerHost() {
  const scriptURL = NativeModules.SourceCode?.scriptURL;
  const match = scriptURL?.match(/^[a-z]+:\/\/([^/:]+)/i);
  return match?.[1];
}

const WS_HOST =
  Platform.OS === 'android' && getDevServerHost() === 'localhost'
    ? '10.0.2.2'
    : getDevServerHost() || '172.25.9.169';
const WS_URL = `ws://${WS_HOST}:8787/ws`;
const DUMMY_ARTISAN_ID = 'artisan_demo_001';
const WS_RECONNECT_DELAY_MS = 3000;
const APP_DEBUG_BUILD = 'ws-debug-2026-05-25-01';

const PCM_RECORDER_HTML = `
<!DOCTYPE html>
<html>
  <body>
    <script>
      let audioContext;
      let processor;
      let source;
      let stream;
      let isRecording = false;

      function postMessage(payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }

      async function startRecording() {
        if (isRecording) return;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              sampleRate: 16000,
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });

          audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
          source = audioContext.createMediaStreamSource(stream);
          processor = audioContext.createScriptProcessor(4096, 1, 1);

          processor.onaudioprocess = function(event) {
            if (!isRecording) return;
            const float32 = event.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i += 1) {
              const sample = Math.max(-1, Math.min(1, float32[i]));
              int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
            }

            const bytes = new Uint8Array(int16.buffer);
            let binary = '';
            const chunkSize = 0x8000;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              const chunk = bytes.subarray(i, i + chunkSize);
              binary += String.fromCharCode.apply(null, chunk);
            }

            postMessage({ type: 'pcm_chunk', data: btoa(binary) });
          };

          source.connect(processor);
          processor.connect(audioContext.destination);
          isRecording = true;
          postMessage({ type: 'recording_started' });
        } catch (error) {
          postMessage({ type: 'recording_error', message: error && error.message ? error.message : String(error) });
          stopRecording();
        }
      }

      function stopRecording() {
        if (!isRecording && !stream && !audioContext) return;
        isRecording = false;
        if (processor) {
          processor.disconnect();
          processor.onaudioprocess = null;
          processor = null;
        }
        if (source) {
          source.disconnect();
          source = null;
        }
        if (stream) {
          stream.getTracks().forEach(function(track) { track.stop(); });
          stream = null;
        }
        if (audioContext) {
          audioContext.close();
          audioContext = null;
        }
        postMessage({ type: 'recording_stopped' });
      }

      function handleCommand(event) {
        try {
          const message = JSON.parse(event.data);
          if (message.command === 'start') startRecording();
          if (message.command === 'stop') stopRecording();
        } catch (error) {
          postMessage({ type: 'recording_error', message: error && error.message ? error.message : String(error) });
        }
      }

      document.addEventListener('message', handleCommand);
      window.addEventListener('message', handleCommand);
      postMessage({ type: 'recorder_ready' });
    </script>
  </body>
</html>
`;

// ─── WebSocket Status ──────────────────────────────────────────────────────────
const WS_STATUS = {
  CONNECTING: 'connecting',
  CONNECTED:  'connected',
  SENDING:    'sending',
  SENT:       'sent',
  ERROR:      'error',
  CLOSED:     'closed',
};

const WS_READY_STATE_LABELS = {
  [WebSocket.CONNECTING]: 'CONNECTING',
  [WebSocket.OPEN]: 'OPEN',
  [WebSocket.CLOSING]: 'CLOSING',
  [WebSocket.CLOSED]: 'CLOSED',
};

function getWsReadyStateLabel(ws) {
  if (!ws) return 'NO_SOCKET';
  return WS_READY_STATE_LABELS[ws.readyState] || `UNKNOWN(${ws.readyState})`;
}

function describeWsEvent(event) {
  if (!event) return 'no event object';
  const details = {
    type: event.type,
    message: event.message,
    code: event.code,
    reason: event.reason,
    wasClean: event.wasClean,
    readyState: event.target?.readyState,
  };
  return JSON.stringify(details);
}

// ─── Permission Status Enum ────────────────────────────────────────────────────
const PERM_STATUS = {
  UNDETERMINED: 'undetermined',
  GRANTED: 'granted',
  DENIED: 'denied',
};

// ─── Recording Options ─────────────────────────────────────────────────────────
const recordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  web: {}
};

// Transforms raw 24kHz Mono PCM base64 data into a playable WAV data URI
function createWavDataUri(base64Pcm) {
  // Decode base64 to byte array
  let pcmBuffer;
  if (global.Buffer) {
    pcmBuffer = Buffer.from(base64Pcm, 'base64');
  } else {
    // Fallback: decode base64 using atob
    const binaryString = atob(base64Pcm);
    pcmBuffer = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      pcmBuffer[i] = binaryString.charCodeAt(i);
    }
  }

  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  /* RIFF identifier */
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + pcmBuffer.length, true); // file length
  view.setUint32(8, 0x57415645, false); // "WAVE"
  /* Format chunk identifier */
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true); // sample format length
  view.setUint16(20, 1, true); // PCM format = 1
  view.setUint16(22, 1, true); // Channels = 1 (Mono)
  view.setUint32(24, 24000, true); // Sample Rate = 24kHz
  view.setUint32(28, 24000 * 2, true); // Byte Rate
  view.setUint16(32, 2, true); // Block Align
  view.setUint16(34, 16, true); // Bits per Sample = 16
  /* Data chunk identifier */
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, pcmBuffer.length, true); // chunk length

  // Merge header and PCM bytes into a single payload
  const wavBytes = new Uint8Array(44 + pcmBuffer.length);
  wavBytes.set(new Uint8Array(header), 0);
  wavBytes.set(pcmBuffer, 44);

  // Encode merged bytes back to base64
  let base64Wav;
  if (global.Buffer) {
    base64Wav = Buffer.from(wavBytes).toString('base64');
  } else {
    // Fallback: encode using btoa
    let binary = '';
    const len = wavBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(wavBytes[i]);
    }
    base64Wav = btoa(binary);
  }

  // Return the playable data URI string
  return `data:audio/wav;base64,${base64Wav}`;
}

// ─── Denied Screen ─────────────────────────────────────────────────────────────
function PermissionDeniedScreen({ type, onRetry }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const icon = type === 'camera' ? '📷' : '🎙️';
  const title = type === 'camera' ? 'Camera Access Needed' : 'Microphone Access Needed';
  const body =
    type === 'camera'
      ? "Sakhi needs your camera to show a live feed. Please grant Camera permission in your device Settings."
      : "Sakhi needs your microphone for Push to Talk. Please grant Microphone permission in your device Settings.";

  return (
    <Animated.View
      style={[styles.permissionScreen, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      <Text style={styles.permIcon}>{icon}</Text>
      <Text style={styles.permTitle}>{title}</Text>
      <Text style={styles.permBody}>{body}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
        <Text style={styles.retryButtonText}>Grant Permission</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// WaveformBars replaced by SiriWaveform (see SiriWaveform.js)

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  // Camera permissions (expo-camera hook)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Microphone permission state
  const [micStatus, setMicStatus] = useState(PERM_STATUS.UNDETERMINED);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [pttState, setPttState] = useState('idle');
  const pttStateRef = useRef('idle');
  const recorderWebViewRef = useRef(null);
  const recorderReadyRef = useRef(false);
  const pcmChunkCountRef = useRef(0);
  const stopRequestedDuringStartRef = useRef(false);

  // Reanimated shared value for live microphone volume metering
  const volumeLevel = useSharedValue(0);

  // Camera overlay visibility state
  const [showCamera, setShowCamera] = useState(false);

  // WebSocket
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const wsAttemptRef = useRef(0);
  const [wsStatus, setWsStatus] = useState(WS_STATUS.CLOSED);

  // Button animation
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const updatePttState = useCallback((nextState) => {
    pttStateRef.current = nextState;
    setPttState(nextState);
  }, []);

  // ── WebSocket: Connect ────────────────────────────────────────────────────
  const connectWebSocket = useCallback(() => {
    // Don't open a second socket if one is already live
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) {
      console.log('[WS] Connect skipped; existing socket state:', getWsReadyStateLabel(wsRef.current));
      return;
    }
    const attemptId = wsAttemptRef.current + 1;
    wsAttemptRef.current = attemptId;
    console.log(`[APP] Debug build: ${APP_DEBUG_BUILD}`);
    console.log(`[WS:${attemptId}] Connecting to ${WS_URL}`);
    setWsStatus(WS_STATUS.CONNECTING);

    const ws = new WebSocket(WS_URL);
    // Force binary messages to arrive as ArrayBuffer, not Blob
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log(`[WS:${attemptId}] Connected. State:`, getWsReadyStateLabel(ws));
      setWsStatus(WS_STATUS.CONNECTED);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onmessage = async (event) => {
      try {
        const dataType = typeof event.data;
        const dataSize =
          dataType === 'string'
            ? event.data.length
            : event.data?.byteLength || event.data?.size || 'unknown';
        console.log(`[WS:${attemptId}] Message received. type=${dataType}, size=${dataSize}`);
        // Decode to string — handle both text frames and any residual binary frames
        let rawData;
        if (typeof event.data === 'string') {
          rawData = event.data;
        } else if (event.data instanceof ArrayBuffer) {
          rawData = new TextDecoder().decode(event.data);
        } else {
          // Last resort: Blob or unknown type
          rawData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(event.data);
          });
        }

        const response = JSON.parse(rawData);
        console.log('[WS] Parsed message keys:', Object.keys(response));

        // Drill down to locate Gemini's audio output blocks
        const parts = response.serverContent?.modelTurn?.parts;
        if (parts) {
          for (const part of parts) {
            if (part.inlineData && part.inlineData.mimeType.includes('audio/pcm')) {
              const rawBase64Pcm = part.inlineData.data;
              
              // Generate the playable asset
              const wavUri = createWavDataUri(rawBase64Pcm);
              
              // Play the voice slice instantly through expo-av
              const { sound } = await Audio.Sound.createAsync(
                { uri: wavUri },
                { shouldPlay: true }
              );
              
              // Automatically clean up memory when the chunk finishes playing
              sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                  sound.unloadAsync();
                }
              });
            }
          }
        }
      } catch (err) {
        console.log('[WS] Non-audio message or parse error:', err?.message || err);
      }
    };

    ws.onerror = (err) => {
      console.warn(`[WS:${attemptId}] Error event:`, describeWsEvent(err));
      console.warn(`[WS:${attemptId}] State after error:`, getWsReadyStateLabel(ws));
      setWsStatus(WS_STATUS.ERROR);
    };

    ws.onclose = (event) => {
      console.log(
        `[WS:${attemptId}] Closed. code=${event.code}, reason="${event.reason}", wasClean=${event.wasClean}, state=${getWsReadyStateLabel(ws)}`
      );
      setWsStatus(WS_STATUS.CLOSED);
      // Auto-reconnect after delay
      reconnectTimer.current = setTimeout(() => {
        console.log('[WS] Attempting reconnect…');
        connectWebSocket();
      }, WS_RECONNECT_DELAY_MS);
    };

    wsRef.current = ws;
  }, []);

  // ── Waveform setup ──
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // ── Profile slide animation state ──
  const profileSlide = useRef(new Animated.Value(-screenWidth)).current;
  const profileContentProgress = useRef(new Animated.Value(0)).current;
  const [profileVisible, setProfileVisible] = useState(false);

  const openProfile = () => {
    setProfileVisible(true);
    Animated.parallel([
      Animated.spring(profileSlide, {
        toValue: 0,
        damping: 20,
        stiffness: 150,
        useNativeDriver: true,
      }),
      Animated.timing(profileContentProgress, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      })
    ]).start();
  };

  const closeProfile = () => {
    Animated.parallel([
      Animated.timing(profileSlide, {
        toValue: -screenWidth,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(profileContentProgress, {
        toValue: 0,
        duration: 220,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ]).start(() => setProfileVisible(false));
  };

  const amplitudeRef = useSharedValue(0);
  const renderAmp = useSharedValue(0);

  const time = useSharedValue(0);
  useFrameCallback((frameInfo) => {
    time.value = frameInfo.timeSinceFirstFrame / 1000;
    renderAmp.value = renderAmp.value + (amplitudeRef.value - renderAmp.value) * 0.12;
    console.log('renderAmp:', renderAmp.value);
  });

  const wave1 = useDerivedValue(() => {
    const strokePath = Skia.Path.Make();
    const fillPath = Skia.Path.Make();
    const baseline = 60;
    const phaseOffset = 0;
    const freq = 1.8;
    const speed = 2.5;

    const startY = baseline + renderAmp.value * Math.sin(phaseOffset + time.value * speed);
    strokePath.moveTo(0, startY);
    fillPath.moveTo(0, startY);

    for (let x = 1.5; x <= screenWidth; x += 1.5) {
      const angle = (x / screenWidth) * freq * 2 * Math.PI + phaseOffset + time.value * speed;
      const y = baseline + renderAmp.value * Math.sin(angle);
      strokePath.lineTo(x, y);
      fillPath.lineTo(x, y);
    }
    fillPath.lineTo(screenWidth, 120);
    fillPath.lineTo(0, 120);
    fillPath.close();

    return { stroke: strokePath, fill: fillPath };
  });

  const wave2 = useDerivedValue(() => {
    const strokePath = Skia.Path.Make();
    const fillPath = Skia.Path.Make();
    const baseline = 60;
    const phaseOffset = 2.2;
    const freq = 2.4;
    const speed = -1.8;

    const startY = baseline + renderAmp.value * Math.sin(phaseOffset + time.value * speed);
    strokePath.moveTo(0, startY);
    fillPath.moveTo(0, startY);

    for (let x = 1.5; x <= screenWidth; x += 1.5) {
      const angle = (x / screenWidth) * freq * 2 * Math.PI + phaseOffset + time.value * speed;
      const y = baseline + renderAmp.value * Math.sin(angle);
      strokePath.lineTo(x, y);
      fillPath.lineTo(x, y);
    }
    fillPath.lineTo(screenWidth, 120);
    fillPath.lineTo(0, 120);
    fillPath.close();

    return { stroke: strokePath, fill: fillPath };
  });

  const wave3 = useDerivedValue(() => {
    const strokePath = Skia.Path.Make();
    const fillPath = Skia.Path.Make();
    const baseline = 60;
    const phaseOffset = 4.5;
    const freq = 1.3;
    const speed = 1.2;

    const startY = baseline + renderAmp.value * Math.sin(phaseOffset + time.value * speed);
    strokePath.moveTo(0, startY);
    fillPath.moveTo(0, startY);

    for (let x = 1.5; x <= screenWidth; x += 1.5) {
      const angle = (x / screenWidth) * freq * 2 * Math.PI + phaseOffset + time.value * speed;
      const y = baseline + renderAmp.value * Math.sin(angle);
      strokePath.lineTo(x, y);
      fillPath.lineTo(x, y);
    }
    fillPath.lineTo(screenWidth, 120);
    fillPath.lineTo(0, 120);
    fillPath.close();

    return { stroke: strokePath, fill: fillPath };
  });

  const wave4 = useDerivedValue(() => {
    const strokePath = Skia.Path.Make();
    const fillPath = Skia.Path.Make();
    const baseline = 60;
    const phaseOffset = 1.1;
    const freq = 3.0;
    const speed = -3.0;

    const startY = baseline + renderAmp.value * Math.sin(phaseOffset + time.value * speed);
    strokePath.moveTo(0, startY);
    fillPath.moveTo(0, startY);

    for (let x = 1.5; x <= screenWidth; x += 1.5) {
      const angle = (x / screenWidth) * freq * 2 * Math.PI + phaseOffset + time.value * speed;
      const y = baseline + renderAmp.value * Math.sin(angle);
      strokePath.lineTo(x, y);
      fillPath.lineTo(x, y);
    }
    fillPath.lineTo(screenWidth, 120);
    fillPath.lineTo(0, 120);
    fillPath.close();

    return { stroke: strokePath, fill: fillPath };
  });

  const wave1Fill = useDerivedValue(() => wave1.value.fill);
  const wave1Stroke = useDerivedValue(() => wave1.value.stroke);
  const wave2Fill = useDerivedValue(() => wave2.value.fill);
  const wave2Stroke = useDerivedValue(() => wave2.value.stroke);
  const wave3Fill = useDerivedValue(() => wave3.value.fill);
  const wave3Stroke = useDerivedValue(() => wave3.value.stroke);
  const wave4Fill = useDerivedValue(() => wave4.value.fill);
  const wave4Stroke = useDerivedValue(() => wave4.value.stroke);

  // ── Request Microphone Permission ──────────────────────────────────────────
  const requestMicPermission = useCallback(async () => {
    const { status } = await Audio.requestPermissionsAsync();
    setMicStatus(status === 'granted' ? PERM_STATUS.GRANTED : PERM_STATUS.DENIED);
    return status === 'granted';
  }, []);


  // ── WebSocket: Send Audio Payload ─────────────────────────────────────────
  /**
   * Reads the recorded file as base64, then sends a JSON message over the
   * WebSocket with the following shape:
   *
   *   {
   *     type:        "audio_input",
   *     artisan_id:  "artisan_demo_001",
   *     audio_base64: "<base64 encoded audio data>",
   *     mime_type:   "audio/m4a" | "audio/wav",
   *     timestamp:   "<ISO 8601>"
   *   }
   */
  const sendPcmChunk = useCallback((base64PCM) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn(
        `[WS] Socket not open. state=${getWsReadyStateLabel(ws)}, pcmChunkKb=${(base64PCM.length / 1024).toFixed(1)}. Chunk dropped.`
      );
      setWsStatus(WS_STATUS.ERROR);
      connectWebSocket();
      return;
    }

    try {
      ws.send(JSON.stringify({
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: 'audio/pcm;rate=16000',
              data: base64PCM,
            },
          ],
        },
      }));

      pcmChunkCountRef.current += 1;
      if (pcmChunkCountRef.current === 1 || pcmChunkCountRef.current % 25 === 0) {
        console.log(
          `[WS] Sent PCM chunk #${pcmChunkCountRef.current} (${(base64PCM.length / 1024).toFixed(1)} KB, audio/pcm;rate=16000)`
        );
      }
    } catch (sendErr) {
      console.error('[WS] Failed to send PCM chunk:', sendErr);
      setWsStatus(WS_STATUS.ERROR);
    }
  }, [connectWebSocket]);

  const handleRecorderMessage = useCallback((event) => {
    let message;
    try {
      message = JSON.parse(event.nativeEvent.data);
    } catch (err) {
      console.warn('[PTT] Invalid recorder message:', event.nativeEvent.data);
      return;
    }

    if (message.type === 'recorder_ready') {
      recorderReadyRef.current = true;
      console.log('[PTT] WebView PCM recorder ready');
      return;
    }

    if (message.type === 'recording_started') {
      updatePttState('recording');
      setIsRecording(true);
      console.log('[PTT] WebView PCM recording started');
      Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true }).start();
      if (stopRequestedDuringStartRef.current) {
        recorderWebViewRef.current?.postMessage(JSON.stringify({ command: 'stop' }));
      }
      return;
    }

    if (message.type === 'recording_stopped') {
      console.log(`[PTT] WebView PCM recording stopped after ${pcmChunkCountRef.current} chunks`);
      stopRequestedDuringStartRef.current = false;
      updatePttState('idle');
      setIsRecording(false);
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
      return;
    }

    if (message.type === 'recording_error') {
      console.warn('[PTT] WebView PCM recorder error:', message.message);
      stopRequestedDuringStartRef.current = false;
      updatePttState('idle');
      setIsRecording(false);
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
      return;
    }

    if (message.type === 'pcm_chunk') {
      sendPcmChunk(message.data);
    }
  }, [scaleAnim, sendPcmChunk, updatePttState]);

  // ── On Mount: Permissions + WebSocket ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      const granted = await requestMicPermission();
      // Configure audio session
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      if (granted) {
        startRecording();
      }
    })();

    // Open WebSocket connection
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      recorderWebViewRef.current?.postMessage(JSON.stringify({ command: 'stop' }));
      if (wsRef.current) wsRef.current.close();
    };
  }, [requestMicPermission, startRecording, connectWebSocket]);

  // ── Glow Loop While Recording ─────────────────────────────────────────────
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      glowAnim.setValue(0);
    }
  }, [isRecording]);

  // ── Push to Talk: Start ───────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    console.log('[PTT] Start requested. micStatus:', micStatus, 'state:', pttStateRef.current);
    if (micStatus !== PERM_STATUS.GRANTED) return;
    if (pttStateRef.current !== 'idle') {
      console.warn('[PTT] Start ignored because recorder is not idle.');
      return;
    }

    stopRequestedDuringStartRef.current = false;
    pcmChunkCountRef.current = 0;
    updatePttState('starting');
    recorderWebViewRef.current?.postMessage(JSON.stringify({ command: 'start' }));
    if (!recorderReadyRef.current) {
      console.warn('[PTT] Start sent before WebView recorder reported ready.');
    }
  }, [micStatus, updatePttState]);

  // ── Push to Talk: Stop → Read → Send ─────────────────────────────────────
  const stopRecording = useCallback(async () => {
    console.log('[PTT] Stop requested. state:', pttStateRef.current);
    if (pttStateRef.current === 'starting') {
      stopRequestedDuringStartRef.current = true;
      return;
    }
    if (pttStateRef.current !== 'recording') return;

    updatePttState('stopping');
    recorderWebViewRef.current?.postMessage(JSON.stringify({ command: 'stop' }));
  }, [updatePttState]);

  // ── Derived Permission States ─────────────────────────────────────────────
  const cameraGranted = cameraPermission?.granted;
  const cameraLoading = cameraPermission === null;
  const cameraDenied = cameraPermission && !cameraPermission.granted && !cameraPermission.canAskAgain;

  const micGranted = micStatus === PERM_STATUS.GRANTED;
  const micDenied = micStatus === PERM_STATUS.DENIED;
  const isPttTransitioning = pttState === 'starting' || pttState === 'stopping';

  // ── WS Status Badge config ────────────────────────────────────────────────
  const wsStatusConfig = {
    [WS_STATUS.CONNECTING]: { label: 'Connecting…', color: '#F59E0B', dot: '#F59E0B' },
    [WS_STATUS.CONNECTED]:  { label: 'Connected',   color: '#22C55E', dot: '#22C55E' },
    [WS_STATUS.SENDING]:    { label: 'Sending…',    color: '#FFFFFF', dot: '#FFFFFF' },
    [WS_STATUS.SENT]:       { label: '✓ Sent',      color: '#34D399', dot: '#34D399' },
    [WS_STATUS.ERROR]:      { label: 'WS Error',    color: '#EF4444', dot: '#EF4444' },
    [WS_STATUS.CLOSED]:     { label: 'Disconnected',color: '#555555', dot: '#555555' },
  };
  const wsBadge = wsStatusConfig[wsStatus];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A14" />
      <WebView
        ref={recorderWebViewRef}
        source={{ html: PCM_RECORDER_HTML, baseUrl: 'https://localhost' }}
        onMessage={handleRecorderMessage}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        style={styles.recorderWebView}
        androidLayerType="software"
        mediaCapturePermissionGrantType="grant"
      />

      {/* ── Header ── */}
      <View style={styles.header}>
        {/* Profile section top-left */}
        <TouchableOpacity style={{ alignItems: 'center' }} activeOpacity={0.8} onPress={openProfile}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 0.5, borderColor: '#333', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>A</Text>
          </View>
          <Text style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginTop: 3 }}>PROFILE</Text>
        </TouchableOpacity>

        {/* Right side container: Sakhi & Connection status pill */}
        <View style={{ alignItems: 'flex-end', gap: 4, marginLeft: 'auto' }}>
          <Text style={styles.headerTitle}>Sakhi</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isRecording && (
              <Animated.View style={[styles.recIndicator, { opacity: glowAnim }]}>
                <View style={styles.recDot} />
                <Text style={styles.recText}>REC</Text>
              </Animated.View>
            )}
            {/* WebSocket status badge */}
            <View style={styles.wsBadge}>
              <View style={[styles.wsDot, { backgroundColor: wsBadge.dot }]} />
              <Text style={[styles.wsLabel, { color: wsBadge.color }]}>{wsBadge.label}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Top Half: Camera Feed Placeholder ── */}
      <View style={{ flex: 1, backgroundColor: '#000' }} />

      {/* ── Bottom Half: Push to Talk ── */}
      <View style={styles.bottomSection}>
        {micDenied ? (
          <PermissionDeniedScreen type="microphone" onRetry={requestMicPermission} />
        ) : (
          <>
            <Text style={styles.hint}>
              {isPttTransitioning ? 'Preparing audio' : isRecording ? 'Release to stop' : 'Hold to speak'}
            </Text>

            <WaveformBars isRecording={isRecording} />

            {/* Outer glow ring */}
            <Animated.View
              style={[
                styles.glowRing,
                {
                  opacity: glowAnim,
                  transform: [{ scale: isRecording ? 1.15 : 1 }],
                },
              ]}
            />

            {/* Push-to-Talk Button */}
            <Pressable
              onPressIn={startRecording}
              onPressOut={stopRecording}
              disabled={!micGranted || isPttTransitioning}
              style={({ pressed }) => [styles.pttButtonWrapper]}
            >
              <Animated.View
                style={[
                  styles.pttButton,
                  isRecording && styles.pttButtonActive,
                  isPttTransitioning && styles.pttButtonTransitioning,
                  { transform: [{ scale: scaleAnim }] },
                ]}
              >
                <Text style={styles.pttIcon}>{isRecording ? '🔴' : '🎙️'}</Text>
                <Text style={styles.pttLabel}>
                  {micGranted ? (isRecording ? 'Listening…' : 'Push to Talk') : 'Awaiting Permission'}
                </Text>
              </Animated.View>
            </Pressable>

            <Text style={styles.footerHint}>
              {wsStatus === WS_STATUS.SENDING
                ? 'Uploading audio…'
                : wsStatus === WS_STATUS.SENT
                ? 'Audio sent ✓'
                : isRecording
                ? 'Audio is being captured'
                : 'Press and hold the button to record'}
            </Text>
          </>
        )}
      </View>

      {/* ── Persistent Skia Waveform Canvas ── */}
      <Canvas style={{ width: '100%', height: 120, position: 'absolute', bottom: 0, left: 0 }}>
        {/* Layer 4: #444, opacity 0.15, strokeWidth 0.6 */}
        <Path path={wave4Fill} style="fill">
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, 120)}
            colors={['rgba(68, 68, 68, 0.07)', 'rgba(68, 68, 68, 0)']}
          />
        </Path>
        <Path path={wave4Stroke} style="stroke" strokeWidth={0.6} color="#444" opacity={0.15} />

        {/* Layer 3: #777, opacity 0.28, strokeWidth 0.8 */}
        <Path path={wave3Fill} style="fill">
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, 120)}
            colors={['rgba(119, 119, 119, 0.07)', 'rgba(119, 119, 119, 0)']}
          />
        </Path>
        <Path path={wave3Stroke} style="stroke" strokeWidth={0.8} color="#777" opacity={0.28} />

        {/* Layer 2: #bbb, opacity 0.5, strokeWidth 1.2 */}
        <Path path={wave2Fill} style="fill">
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, 120)}
            colors={['rgba(187, 187, 187, 0.07)', 'rgba(187, 187, 187, 0)']}
          />
        </Path>
        <Path path={wave2Stroke} style="stroke" strokeWidth={1.2} color="#bbb" opacity={0.5} />

        {/* Layer 1: #fff, opacity 1, strokeWidth 2 */}
        <Path path={wave1Fill} style="fill">
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, 120)}
            colors={['rgba(255, 255, 255, 0.07)', 'rgba(255, 255, 255, 0)']}
          />
        </Path>
        <Path path={wave1Stroke} style="stroke" strokeWidth={2} color="#fff" opacity={1} />
      </Canvas>

      {/* ── Camera Floating Action Button ── */}
      <TouchableOpacity
        style={styles.camFab}
        onPress={() => setShowCamera(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.camFabText}>📷</Text>
      </TouchableOpacity>

      {/* ── Conditional Camera Overlay ── */}
      {showCamera && (
        <CameraOverlay
          onClose={() => setShowCamera(false)}
          cameraGranted={cameraGranted}
          cameraLoading={cameraLoading}
          cameraDenied={cameraDenied}
          requestCameraPermission={requestCameraPermission}
        />
      )}

      {/* ── Profile Overlay ── */}
      {profileVisible && (
        <Animated.View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: '#000',
          transform: [{ translateX: profileSlide }],
          zIndex: 1001,
          paddingTop: 60,
        }}>

          {/* Header row */}
          <Animated.View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 24,
            marginBottom: 0,
            opacity: profileContentProgress,
          }}>
            <TouchableOpacity onPress={closeProfile}>
              <Text style={{ color: '#fff', fontSize: 13, letterSpacing: 1 }}>← BACK</Text>
            </TouchableOpacity>
            <Text style={{
              color: '#fff',
              fontSize: 20,
              fontWeight: '800',
              letterSpacing: 4,
            }}>SAKHI</Text>
          </Animated.View>

          {/* Center content — matches sketch */}
          <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 24,
          }}>

            {/* Profile picture circle */}
            <Animated.View style={{
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: '#111',
              borderWidth: 0.5,
              borderColor: '#333',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
              opacity: profileContentProgress,
              transform: [{
                scale: profileContentProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                })
              }]
            }}>
              {/* Replace with <Image source={profileImage} style={{ width: 180, height: 180 }} /> when available */}
              <Text style={{ color: '#555', fontSize: 12, letterSpacing: 1.5 }}>PHOTO</Text>
            </Animated.View>

            {/* Name pill — matches sketch rectangle */}
            <Animated.View style={{
              borderWidth: 0.5,
              borderColor: '#333',
              borderRadius: 10,
              paddingVertical: 14,
              paddingHorizontal: 40,
              backgroundColor: '#0d0d0d',
              minWidth: 200,
              alignItems: 'center',
              opacity: profileContentProgress,
              transform: [{
                translateY: profileContentProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [25, 0],
                })
              }]
            }}>
              <Text style={{
                color: '#fff',
                fontSize: 18,
                fontWeight: '600',
                letterSpacing: 1,
              }}>Artisan Name</Text>
            </Animated.View>

            {/* Leave blank space below for future additions */}
            <View style={{ height: 120 }} />

          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ─── CameraOverlay Component ──────────────────────────────────────────────────
function CameraOverlay({ onClose, cameraGranted, cameraLoading, cameraDenied, requestCameraPermission }) {
  useEffect(() => {
    if (!cameraGranted && !cameraDenied && !cameraLoading) {
      requestCameraPermission();
    }
  }, [cameraGranted, cameraDenied, cameraLoading, requestCameraPermission]);

  return (
    <View style={styles.overlayContainer}>
      {cameraLoading ? (
        <View style={styles.cameraPlaceholder}>
          <Text style={styles.loadingText}>Initializing camera…</Text>
        </View>
      ) : cameraDenied ? (
        <PermissionDeniedScreen type="camera" onRetry={requestCameraPermission} />
      ) : cameraGranted ? (
        <CameraView style={StyleSheet.absoluteFillObject} facing="back">
          {/* Corner frame overlays */}
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />

          {/* Header overlay */}
          <View style={styles.overlayHeader}>
            <Text style={styles.overlayTitle}>Sakhi Lens</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeButtonText}>✕ Close</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      ) : (
        <PermissionDeniedScreen type="camera" onRetry={requestCameraPermission} />
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const BG = '#000000';
const SURFACE = '#0d0d0d';
const BORDER = '#222222';
const TEXT_PRIMARY = '#ffffff';
const TEXT_SECONDARY = '#555555';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  recorderWebView: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    backgroundColor: BG,
  },

  // WebSocket badge (styled as Card)
  wsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  wsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  wsLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  headerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: TEXT_PRIMARY,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    letterSpacing: 1.5,
  },
  recIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: '#EF4444',
  },
  recDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Camera Section
  cameraSection: {
    flex: 1,
    backgroundColor: BG,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
  },
  loadingText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },

  // Camera overlay corners
  cornerTL: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 28,
    height: 28,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderColor: TEXT_SECONDARY,
    borderRadius: 2,
  },
  cornerTR: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: TEXT_SECONDARY,
    borderRadius: 2,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 28,
    height: 28,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: TEXT_SECONDARY,
    borderRadius: 2,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 28,
    height: 28,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: TEXT_SECONDARY,
    borderRadius: 2,
  },

  // Live badge
  liveBadge: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  liveText: {
    color: TEXT_PRIMARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // Bottom Section (styled as Card container)
  bottomSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 130, // Pushes button up to avoid overlap with bottom-positioned waveform
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
  },

  hint: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },


  // PTT Button (styled as Card/Grey Button)
  pttButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pttButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG,
    borderWidth: 0.5,
    borderColor: BORDER,
    shadowColor: BORDER,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  pttButtonActive: {
    backgroundColor: SURFACE,
    borderColor: TEXT_SECONDARY,
    shadowColor: TEXT_SECONDARY,
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  pttButtonTransitioning: {
    opacity: 0.7,
  },
  pttIcon: {
    fontSize: 42,
  },
  pttLabel: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
  },

  footerHint: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    textAlign: 'center',
  },

  // Permission Denied Screen
  permissionScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  permIcon: {
    fontSize: 56,
  },
  permTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  permBody: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: BG,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  retryButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  camFab: {
    position: 'absolute',
    bottom: 130,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0d0d0d',
    borderWidth: 0.5,
    borderColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    zIndex: 998,
  },
  camFabText: {
    fontSize: 22,
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 1000,
  },
  overlayHeader: {
    position: 'absolute',
    top: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: '#222222',
  },
  overlayTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: '#1C1C1C',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 0.5,
    borderColor: '#222222',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
