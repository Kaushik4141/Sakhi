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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { WebView } from 'react-native-webview';

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

// ─── Waveform Visualiser (decorative) ─────────────────────────────────────────
function WaveformBars({ isRecording }) {
  const bars = useRef(Array.from({ length: 5 }, () => new Animated.Value(0.3))).current;

  useEffect(() => {
    let animations = [];
    if (isRecording) {
      animations = bars.map((bar, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(bar, {
              toValue: 0.2 + Math.random() * 0.8,
              duration: 200 + i * 80,
              useNativeDriver: true,
            }),
            Animated.timing(bar, {
              toValue: 0.2 + Math.random() * 0.5,
              duration: 200 + i * 80,
              useNativeDriver: true,
            }),
          ])
        )
      );
      animations.forEach((a) => a.start());
    } else {
      bars.forEach((bar) => {
        Animated.timing(bar, { toValue: 0.3, duration: 200, useNativeDriver: true }).start();
      });
    }
    return () => animations.forEach((a) => a.stop());
  }, [isRecording]);

  return (
    <View style={styles.waveformContainer}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            styles.waveformBar,
            {
              transform: [{ scaleY: bar }],
              backgroundColor: isRecording ? '#A78BFA' : 'rgba(167,139,250,0.3)',
            },
          ]}
        />
      ))}
    </View>
  );
}

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

  const requestMicPermission = useCallback(async () => {
    const { status } = await Audio.requestPermissionsAsync();
    setMicStatus(status === 'granted' ? PERM_STATUS.GRANTED : PERM_STATUS.DENIED);
    return status === 'granted';
  }, []);

  // ── On Mount: Permissions + WebSocket ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      await requestCameraPermission();
      await requestMicPermission();
      // Configure audio session
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    })();

    // Open WebSocket connection
    connectWebSocket();

    // Cleanup on unmount
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      recorderWebViewRef.current?.postMessage(JSON.stringify({ command: 'stop' }));
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

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
    [WS_STATUS.SENDING]:    { label: 'Sending…',    color: '#A78BFA', dot: '#A78BFA' },
    [WS_STATUS.SENT]:       { label: '✓ Sent',      color: '#34D399', dot: '#34D399' },
    [WS_STATUS.ERROR]:      { label: 'WS Error',    color: '#EF4444', dot: '#EF4444' },
    [WS_STATUS.CLOSED]:     { label: 'Disconnected',color: '#6B7280', dot: '#6B7280' },
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
        <View style={styles.headerDot} />
        <Text style={styles.headerTitle}>Sakhi</Text>
        {/* WebSocket status badge */}
        <View style={[styles.wsBadge, { borderColor: wsBadge.color + '55' }]}>
          <View style={[styles.wsDot, { backgroundColor: wsBadge.dot }]} />
          <Text style={[styles.wsLabel, { color: wsBadge.color }]}>{wsBadge.label}</Text>
        </View>
        {/* REC indicator */}
        {isRecording && (
          <Animated.View style={[styles.recIndicator, { opacity: glowAnim }]}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>REC</Text>
          </Animated.View>
        )}
      </View>

      {/* ── Top Half: Camera Feed ── */}
      <View style={styles.cameraSection}>
        {cameraLoading ? (
          <View style={styles.cameraPlaceholder}>
            <Text style={styles.loadingText}>Initializing camera…</Text>
          </View>
        ) : cameraDenied ? (
          <PermissionDeniedScreen type="camera" onRetry={requestCameraPermission} />
        ) : cameraGranted ? (
          <CameraView style={styles.camera} facing="back">
            {/* Corner frame overlays */}
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />
            {/* Live badge */}
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </CameraView>
        ) : (
          <PermissionDeniedScreen type="camera" onRetry={requestCameraPermission} />
        )}
      </View>

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
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const PURPLE = '#A78BFA';
const PURPLE_DARK = '#7C3AED';
const PINK = '#F472B6';
const BG = '#0A0A14';
const SURFACE = '#13131F';
const BORDER = '#1E1E30';

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
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: BG,
    gap: 8,
    flexWrap: 'nowrap',
  },

  // WebSocket badge
  wsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
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
    backgroundColor: PURPLE,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  recIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(239,68,68,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.5)',
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
    backgroundColor: '#050508',
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050508',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
  },

  // Camera overlay corners
  cornerTL: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 28,
    height: 28,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: PURPLE,
    borderRadius: 2,
  },
  cornerTR: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: PURPLE,
    borderRadius: 2,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    width: 28,
    height: 28,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: PURPLE,
    borderRadius: 2,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 28,
    height: 28,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: PURPLE,
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  // Bottom Section
  bottomSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    paddingHorizontal: 28,
    paddingVertical: 24,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },

  hint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Waveform
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
  },
  waveformBar: {
    width: 5,
    height: 32,
    borderRadius: 3,
  },

  // Glow Ring
  glowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: PURPLE,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 30,
    elevation: 20,
  },

  // PTT Button
  pttButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pttButton: {
    width: 170,
    height: 170,
    borderRadius: 85,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PURPLE_DARK,
    borderWidth: 3,
    borderColor: PURPLE,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
    gap: 10,
  },
  pttButtonActive: {
    backgroundColor: '#6D28D9',
    borderColor: PINK,
    shadowColor: PINK,
    shadowOpacity: 0.9,
    shadowRadius: 30,
  },
  pttButtonTransitioning: {
    opacity: 0.7,
  },
  pttIcon: {
    fontSize: 42,
  },
  pttLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
  },

  footerHint: {
    color: 'rgba(255,255,255,0.25)',
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
    color: '#FFFFFF',
    textAlign: 'center',
  },
  permBody: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: PURPLE_DARK,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: PURPLE,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
