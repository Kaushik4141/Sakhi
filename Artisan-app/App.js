import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Animated,
  StatusBar,
  Platform,
  NativeModules,
  Dimensions,
  Easing,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { WebView } from 'react-native-webview';
import { useSharedValue, withTiming, useDerivedValue, useFrameCallback } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import { Canvas, Path, Skia, LinearGradient, vec } from '@shopify/react-native-skia';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Translations Config ───────────────────────────────────────────────────────
const TRANSLATIONS = {
  en: {
    sakhi: 'Sakhi',
    menu: 'MENU',
    profile: 'PROFILE',
    rec: 'REC',
    back: '← BACK',
    photo: 'PHOTO',
    artisan_name: 'Artisan Name',
    analytics: 'Analytics',
    orders: 'Orders',
    news_updates: 'News & Updates',
    settings: 'Settings',
    language_settings: 'Language Settings',
    connecting: 'Connecting…',
    connected: 'Connected',
    sending: 'Sending…',
    sent: '✓ Sent',
    ws_error: 'WS Error',
    disconnected: 'Disconnected',
    choose_lang: 'Choose your language',
    select_pref_lang: 'Select your preferred language to get started with Sakhi',
    continue: 'Continue',
    loading: 'LOADING SAKHI…',
    close: '✕ Close',
    initializing_camera: 'Initializing camera…',
    sakhi_lens: 'Sakhi Lens',
    mic_needed_title: 'Microphone Access Needed',
    mic_needed_body: 'Sakhi needs your microphone for Push to Talk. Please grant Microphone permission in your device Settings.',
    cam_needed_title: 'Camera Access Needed',
    cam_needed_body: 'Sakhi needs your camera to show a live feed. Please grant Camera permission in your device Settings.',
    grant_perm: 'Grant Permission',
  },
  hi: {
    sakhi: 'सखी',
    menu: 'मेन्यू',
    profile: 'प्रोफाइल',
    rec: 'रिकॉर्ड',
    back: '← वापस',
    photo: 'फोटो',
    artisan_name: 'कारीगर का नाम',
    analytics: 'विश्लेषण',
    orders: 'आदेश',
    news_updates: 'समाचार और अपडेट',
    settings: 'सेटिंग्स',
    language_settings: 'भाषा सेटिंग्स',
    connecting: 'कनेक्ट हो रहा है…',
    connected: 'कनेक्टेड',
    sending: 'भेजा जा रहा है…',
    sent: '✓ भेजा गया',
    ws_error: 'कनेक्शन त्रुटि',
    disconnected: 'डिस्कनेक्टेड',
    choose_lang: 'अपनी भाषा चुनें',
    select_pref_lang: 'सखी के साथ शुरुआत करने के लिए अपनी पसंदीदा भाषा चुनें',
    continue: 'जारी रखें',
    loading: 'सखी लोड हो रही है…',
    close: '✕ बंद करें',
    initializing_camera: 'कैमरा शुरू किया जा रहा है…',
    sakhi_lens: 'सखी लेंस',
    mic_needed_title: 'माइक्रोफोन एक्सेस की आवश्यकता है',
    mic_needed_body: 'पुश टू टॉक के लिए सखी को आपके माइक्रोफ़ोन की आवश्यकता है। कृपया अपने डिवाइस सेटिंग्स में माइक्रोफ़ोन अनुमति दें।',
    cam_needed_title: 'कैमरा एक्सेस की आवश्यकता है',
    cam_needed_body: 'लाइव फीड दिखाने के लिए सखी को आपके कैमरे की आवश्यकता है। कृपया अपने डिवाइस सेटिंग्स में कैमरा अनुमति दें।',
    grant_perm: 'अनुमति दें',
  },
  kn: {
    sakhi: 'ಸಖಿ',
    menu: 'ಮೆನು',
    profile: 'ಪ್ರೊಫೈಲ್',
    rec: 'ರೆಕಾರ್ಡ್',
    back: '← ಹಿಂದೆ',
    photo: 'ಫೋಟೋ',
    artisan_name: 'ಕುಶಲಕರ್ಮಿ ಹೆಸರು',
    analytics: 'ವಿಶ್ಲೇಷಣೆ',
    orders: 'ಆದೇಶಗಳು',
    news_updates: 'ಸುದ್ದಿ ಮತ್ತು ನವೀಕರಣಗಳು',
    settings: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    language_settings: 'ಭಾಷಾ ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    connecting: 'ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ…',
    connected: 'ಸಂಪರ್ಕಗೊಂಡಿದೆ',
    sending: 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…',
    sent: '✓ ಕಳುಹಿಸಲಾಗಿದೆ',
    ws_error: 'ಸಂಪರ್ಕ ದೋಷ',
    disconnected: 'ಸಂಪರ್ಕ ಕಡಿತಗೊಂಡಿದೆ',
    choose_lang: 'ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    select_pref_lang: 'ಸಖಿಯೊಂದಿಗೆ ಪ್ರಾರಂಭಿಸಲು ನಿಮ್ಮ ಆದ್ಯತೆಯ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    continue: 'ಮುಂದುವರಿಯಿರಿ',
    loading: 'ಸಖಿ ಲೋಡ್ ಆಗುತ್ತಿದೆ…',
    close: '✕ ಮುಚ್ಚಿ',
    initializing_camera: 'ಕ್ಯಾಮೆರಾ ಪ್ರಾರಂಭಿಸಲಾಗುತ್ತಿದೆ…',
    sakhi_lens: 'ಸಖಿ ಲೆನ್ಸ್',
    mic_needed_title: 'ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ಅಗತ್ಯವಿದೆ',
    mic_needed_body: 'ಮಾತನಾಡಲು ಸಖಿಗೆ ನಿಮ್ಮ ಮೈಕ್ರೊಫೋನ್ ಅಗತ್ಯವಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸಾಧನದ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿ ನೀಡಿ.',
    cam_needed_title: 'ಕ್ಯಾಮೆರಾ ಅನುಮತಿ ಅಗತ್ಯವಿದೆ',
    cam_needed_body: 'ಲೈವ್ ಫೀಡ್ ತೋರಿಸಲು ಸಖಿಗೆ ನಿಮ್ಮ ಕ್ಯಾಮೆರಾ ಅಗತ್ಯವಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸಾಧನದ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಕ್ಯಾಮೆರಾ ಅನುಮತಿ ನೀಡಿ.',
    grant_perm: 'ಅನುಮತಿ ನೀಡಿ',
  },
  es: {
    sakhi: 'Sakhi',
    menu: 'MENÚ',
    profile: 'PERFIL',
    rec: 'GRABANDO',
    back: '← ATRÁS',
    photo: 'FOTO',
    artisan_name: 'Nombre del Artesano',
    analytics: 'Estadísticas',
    orders: 'Pedidos',
    news_updates: 'Noticias y Actualizaciones',
    settings: 'Ajustes',
    language_settings: 'Ajustes de Idioma',
    connecting: 'Conectando…',
    connected: 'Conectado',
    sending: 'Enviando…',
    sent: '✓ Enviado',
    ws_error: 'Error de WS',
    disconnected: 'Desconectado',
    choose_lang: 'Elige tu idioma',
    select_pref_lang: 'Selecciona tu idioma de preferencia para comenzar con Sakhi',
    continue: 'Continuar',
    loading: 'CARGANDO SAKHI…',
    close: '✕ Cerrar',
    initializing_camera: 'Inicializando cámara…',
    sakhi_lens: 'Lente Sakhi',
    mic_needed_title: 'Se requiere acceso al micrófono',
    mic_needed_body: 'Sakhi necesita su micrófono para hablar. Otorgue el permiso en la configuración de su dispositivo.',
    cam_needed_title: 'Se requiere acceso a la cámara',
    cam_needed_body: 'Sakhi necesita su cámara para mostrar la transmisión en vivo. Otorgue el permiso en la configuración de su dispositivo.',
    grant_perm: 'Otorgar Permiso',
  }
};


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

// ─── PLAYBACK ────────────────────────────────────────────────
      let playContext;
      const PLAYBACK_SAMPLE_RATE = 24000;
      let nextScheduledTime = 0;

      function receiveAudioChunk(base64) {
        if (!playContext) {
          playContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: PLAYBACK_SAMPLE_RATE });
        }
        
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        
        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
          float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF);
        }
        
        const audioBuffer = playContext.createBuffer(1, float32.length, PLAYBACK_SAMPLE_RATE);
        audioBuffer.copyToChannel(float32, 0);
        
        // Schedule playback for seamless audio
        if (nextScheduledTime < playContext.currentTime) {
          // Buffer underrun or first chunk - add 150ms jitter buffer
          nextScheduledTime = playContext.currentTime + 0.15;
        }

        const sourceNode = playContext.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(playContext.destination);
        sourceNode.start(nextScheduledTime);

        // Advance the schedule time
        nextScheduledTime += audioBuffer.duration;
      }

      function stopPlayback() {
        nextScheduledTime = 0;
        if (playContext) {
          playContext.close();
          playContext = null;
        }
      }

      function handleCommand(event) {
        try {
          const message = JSON.parse(event.data);
          if (message.command === 'start') startRecording();
          if (message.command === 'stop') stopRecording();
          if (message.command === 'play_chunk') receiveAudioChunk(message.data);
          if (message.command === 'stop_playback') stopPlayback();
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


// ─── Denied Screen ─────────────────────────────────────────────────────────────
function PermissionDeniedScreen({ type, onRetry, t }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const translate = t || ((key) => TRANSLATIONS['en'][key]);

  const icon = type === 'camera' ? '📷' : '🎙️';
  const title = type === 'camera' ? translate('cam_needed_title') : translate('mic_needed_title');
  const body = type === 'camera' ? translate('cam_needed_body') : translate('mic_needed_body');

  return (
    <Animated.View
      style={[styles.permissionScreen, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      <Text style={styles.permIcon}>{icon}</Text>
      <Text style={styles.permTitle}>{title}</Text>
      <Text style={styles.permBody}>{body}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
        <Text style={styles.retryButtonText}>{translate('grant_perm')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// WaveformBars replaced by SiriWaveform (see SiriWaveform.js)

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [appReady, setAppReady] = useState(false);
  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('en');

  const t = (key) => {
    return TRANSLATIONS[currentLanguage]?.[key] || TRANSLATIONS['en']?.[key] || key;
  };

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

  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakingTimeoutRef = useRef(null);

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

    ws.onopen = async () => {
      console.log(`[WS:${attemptId}] Connected. State:`, getWsReadyStateLabel(ws));
      setWsStatus(WS_STATUS.CONNECTED);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }

      // Send init message with language preference and artisan ID
      try {
        const savedLang = await AsyncStorage.getItem('user_language') || 'english';
        const savedArtisanId = await AsyncStorage.getItem('artisan_id') || `guest_${Date.now()}`;
        const initPayload = {
          type: 'init',
          language: savedLang,
          artisanId: savedArtisanId,
        };
        console.log('[WS] Sending init:', JSON.stringify(initPayload));
        ws.send(JSON.stringify(initPayload));
      } catch (err) {
        console.warn('[WS] Failed to send init message:', err);
        // Fallback: send with defaults
        ws.send(JSON.stringify({ type: 'init', language: 'english', artisanId: `guest_${Date.now()}` }));
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
        // console.log('[WS] Parsed message keys:', Object.keys(response));

        if (response.serverContent?.interrupted) {
          console.log('[GEMINI] Interrupted by user voice! Stopping playback.');
          recorderWebViewRef.current?.postMessage(JSON.stringify({ command: 'stop_playback' }));
        }

        // Handle artisan_created event from backend onboarding
        if (response.type === 'artisan_created' && response.artisanId) {
          console.log('[ONBOARDING] Artisan profile created! ID:', response.artisanId, 'Shop:', response.shopSlug);
          try {
            await AsyncStorage.setItem('artisan_id', response.artisanId);
            if (response.shopSlug) {
              await AsyncStorage.setItem('shop_slug', response.shopSlug);
            }
          } catch (storageErr) {
            console.warn('[ONBOARDING] Failed to save artisan ID:', storageErr);
          }
        }

        // Drill down to locate Gemini's audio output blocks
        const parts = response.serverContent?.modelTurn?.parts;
        if (parts) {
          for (const part of parts) {
            // Log any text response for debugging
            if (part.text) {
              console.log('[GEMINI TEXT]:', part.text);
            }

            if (part.inlineData && part.inlineData.mimeType.includes('audio/pcm')) {
              console.log('[GEMINI AUDIO] Received PCM chunk, bytes:', part.inlineData.data.length);
              const rawBase64Pcm = part.inlineData.data;
              
              // Play the voice slice instantly via the WebView's AudioContext
              recorderWebViewRef.current?.postMessage(JSON.stringify({ 
                command: 'play_chunk', 
                data: rawBase64Pcm 
              }));
              setIsSpeaking(true);
              if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
              speakingTimeoutRef.current = setTimeout(() => setIsSpeaking(false), 1500);
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
      
      // Send turnComplete to force Gemini to respond immediately without waiting for VAD
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('[PTT] Sending turnComplete to Gemini');
        wsRef.current.send(JSON.stringify({
          clientContent: {
            turnComplete: true
          }
        }));
      }
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

  // ── Check Language Selection on Mount ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const savedLang = await AsyncStorage.getItem('user_language');
        if (savedLang) {
          setCurrentLanguage(savedLang);
          setHasSelectedLanguage(true);
        }
      } catch (err) {
        console.warn('[Storage] Failed to read language:', err);
      } finally {
        setAppReady(true);
      }
    })();
  }, []);

  // ── Gemini Live Session Wrapper ──────────────────────────────────────────
  const geminiLiveSession = useRef({
    connect: () => {
      connectWebSocket();
    },
    disconnect: () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    }
  }).current;

  // ── On Mount: Permissions + WebSocket ─────────────────────────────────────
  useEffect(() => {
    if (!hasSelectedLanguage) return;

    (async () => {
      try {
        const granted = await requestMicPermission();
        // Configure audio session
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        if (granted) {
          await startRecording();
        }

        // Start Gemini Live Session
        connectWebSocket();
      } catch (err) {
        console.warn('[Init] Failed to initialize mic or socket:', err);
      }
    })();

    // Cleanup on unmount
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [hasSelectedLanguage, requestMicPermission, startRecording, connectWebSocket]);

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
    // Stop any ongoing playback
    recorderWebViewRef.current?.postMessage(JSON.stringify({ command: 'stop_playback' }));
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

  // ── Session Toggle ────────────────────────────────────────────────────────
  const toggleSession = useCallback(() => {
    if (isRecording || pttStateRef.current === 'recording' || pttStateRef.current === 'starting') {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // ── Derived Permission States ─────────────────────────────────────────────
  const cameraGranted = cameraPermission?.granted;
  const cameraLoading = cameraPermission === null;
  const cameraDenied = cameraPermission && !cameraPermission.granted && !cameraPermission.canAskAgain;

  const micGranted = micStatus === PERM_STATUS.GRANTED;
  const micDenied = micStatus === PERM_STATUS.DENIED;
  const isPttTransitioning = pttState === 'starting' || pttState === 'stopping';

  // ── WS Status Badge config ────────────────────────────────────────────────
  const wsStatusConfig = {
    [WS_STATUS.CONNECTING]: { label: t('connecting'), color: '#F59E0B', dot: '#F59E0B' },
    [WS_STATUS.CONNECTED]:  { label: t('connected'),   color: '#22C55E', dot: '#22C55E' },
    [WS_STATUS.SENDING]:    { label: t('sending'),    color: '#FFFFFF', dot: '#FFFFFF' },
    [WS_STATUS.SENT]:       { label: t('sent'),       color: '#34D399', dot: '#34D399' },
    [WS_STATUS.ERROR]:      { label: t('ws_error'),    color: '#EF4444', dot: '#EF4444' },
    [WS_STATUS.CLOSED]:     { label: t('disconnected'),color: '#555555', dot: '#555555' },
  };
  const wsBadge = wsStatusConfig[wsStatus];

  // ── State Pill Logic ──
  const [showPill, setShowPill] = useState(true);

  let pillState = 'disconnected';
  let pillLabel = '';
  let pillColor = '#555';
  let hasPulse = false;

  if (wsStatus === WS_STATUS.CONNECTING) {
    pillState = 'connecting';
    pillLabel = 'Connecting...';
    pillColor = '#6b7280'; // gray
  } else if (wsStatus === WS_STATUS.CONNECTED) {
    if (isRecording) {
      pillState = 'listening';
      pillLabel = 'Listening...';
      pillColor = '#f59e0b'; // amber
    } else if (isSpeaking) {
      pillState = 'speaking';
      pillLabel = 'Speaking...';
      pillColor = '#3b82f6'; // blue
    } else {
      pillState = 'connected';
      pillLabel = 'Connected';
      pillColor = '#22c55e'; // green
      hasPulse = true;
    }
  }

  useEffect(() => {
    setShowPill(true);
    if (pillState === 'connected') {
      const timer = setTimeout(() => setShowPill(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [pillState]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!appReady) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Text style={{ color: '#555', fontSize: 14, letterSpacing: 2 }}>{t('loading')}</Text>
      </SafeAreaView>
    );
  }

  if (!hasSelectedLanguage) {
    return (
      <LanguageSelectionScreen
        currentLanguage={currentLanguage}
        onSelect={(lang) => {
          setCurrentLanguage(lang);
          setHasSelectedLanguage(true);
        }}
      />
    );
  }

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

      {/* ── State Pill ── */}
      {showPill && pillState !== 'disconnected' && (
        <View style={{
          position: 'absolute',
          top: 60,
          alignSelf: 'center',
          backgroundColor: pillColor,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          zIndex: 9999,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 5,
        }}>
          {hasPulse && (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
          )}
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
            {pillLabel}
          </Text>
        </View>
      )}

      {/* ── Header ── */}
      <View style={styles.header}>
        {/* Hamburger Menu top-left */}
        <TouchableOpacity style={{ alignItems: 'center' }} activeOpacity={0.8} onPress={openProfile}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#1a1a1a', borderWidth: 0.5, borderColor: '#333', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '400' }}>☰</Text>
          </View>
          <Text style={{ fontSize: 9, color: '#555', letterSpacing: 1, marginTop: 3 }}>{t('menu')}</Text>
        </TouchableOpacity>

        {/* Right side container: Sakhi & Connection status pill */}
        <View style={{ alignItems: 'flex-end', gap: 4, marginLeft: 'auto' }}>
          <Text style={styles.headerTitle}>{t('sakhi')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isRecording && (
              <Animated.View style={[styles.recIndicator, { opacity: glowAnim }]}>
                <View style={styles.recDot} />
                <Text style={styles.recText}>{t('rec')}</Text>
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
              {isPttTransitioning ? 'Preparing audio' : isRecording ? 'Tap to end session' : 'Tap to start session'}
            </Text>

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

            {/* Live Session Toggle Button */}
            <Pressable
              onPress={toggleSession}
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
                <Text style={styles.pttIcon}>{isRecording ? '🛑' : '🎙️'}</Text>
                <Text style={styles.pttLabel}>
                  {micGranted ? (isRecording ? 'Live Session Active' : 'Connect') : 'Awaiting Permission'}
                </Text>
              </Animated.View>
            </Pressable>

            <Text style={styles.footerHint}>
              {wsStatus === WS_STATUS.SENDING
                ? 'Uploading audio…'
                : wsStatus === WS_STATUS.SENT
                ? 'Audio sent ✓'
                : isRecording
                ? 'Listening continuously… (Gemini Live)'
                : 'Tap to start a Live Session'}
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
          t={t}
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
            marginBottom: 10,
            opacity: profileContentProgress,
          }}>
            <TouchableOpacity onPress={closeProfile}>
              <Text style={{ color: '#fff', fontSize: 13, letterSpacing: 1 }}>{t('back')}</Text>
            </TouchableOpacity>
            <Text style={{
              color: '#fff',
              fontSize: 20,
              fontWeight: '800',
              letterSpacing: 4,
            }}>{t('sakhi').toUpperCase()}</Text>
          </Animated.View>

          {/* Scrollable menu content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Centered Profile Card */}
            <View style={{
              alignItems: 'center',
              marginTop: 20,
              marginBottom: 30,
              gap: 16,
            }}>
              {/* Profile picture circle */}
              <Animated.View style={{
                width: 100,
                height: 100,
                borderRadius: 50,
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
                <Text style={{ color: '#555', fontSize: 10, letterSpacing: 1 }}>{t('photo')}</Text>
              </Animated.View>

              {/* Name pill */}
              <Animated.View style={{
                borderWidth: 0.5,
                borderColor: '#333',
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 30,
                backgroundColor: '#0d0d0d',
                minWidth: 160,
                alignItems: 'center',
                opacity: profileContentProgress,
                transform: [{
                  translateY: profileContentProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  })
                }]
              }}>
                <Text style={{
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: '600',
                  letterSpacing: 1,
                }}>{t('artisan_name')}</Text>
              </Animated.View>
            </View>

            {/* Menu List Options */}
            <View style={{ paddingHorizontal: 8 }}>
              {[
                { key: 'analytics', title: t('analytics'), icon: '📊' },
                { key: 'orders', title: t('orders'), icon: '📦' },
                { key: 'news_updates', title: t('news_updates'), icon: '📢' },
                { key: 'language_settings', title: t('language_settings'), icon: '🌐' },
                { key: 'settings', title: t('settings'), icon: '⚙️' },
              ].map((item, index) => {
                const translateY = profileContentProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [40 + index * 15, 0],
                });
                return (
                  <Animated.View
                    key={item.key}
                    style={{
                      opacity: profileContentProgress,
                      transform: [{ translateY }],
                    }}
                  >
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 16,
                        paddingHorizontal: 20,
                        borderBottomWidth: 0.5,
                        borderBottomColor: '#222',
                      }}
                      activeOpacity={0.7}
                      onPress={async () => {
                        if (item.key === 'language_settings') {
                          try {
                            setHasSelectedLanguage(false);
                            closeProfile();
                          } catch (err) {
                            console.warn('[Storage] Failed to open language settings:', err);
                          }
                        }
                      }}
                    >
                      <View style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: '#111',
                        borderWidth: 0.5,
                        borderColor: '#333',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        <Text style={{ fontSize: 16 }}>{item.icon}</Text>
                      </View>
                      <Text style={{
                        color: '#fff',
                        fontSize: 15,
                        fontWeight: '500',
                        marginLeft: 16,
                        letterSpacing: 0.5,
                      }}>{item.title}</Text>
                      <Text style={{
                        color: '#444',
                        fontSize: 18,
                        marginLeft: 'auto',
                      }}>›</Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>

          </ScrollView>

        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ─── CameraOverlay Component ──────────────────────────────────────────────────
function CameraOverlay({ onClose, cameraGranted, cameraLoading, cameraDenied, requestCameraPermission, t }) {
  useEffect(() => {
    if (!cameraGranted && !cameraDenied && !cameraLoading) {
      requestCameraPermission();
    }
  }, [cameraGranted, cameraDenied, cameraLoading, requestCameraPermission]);

  return (
    <View style={styles.overlayContainer}>
      {cameraLoading ? (
        <View style={styles.cameraPlaceholder}>
          <Text style={styles.loadingText}>{t('initializing_camera')}</Text>
        </View>
      ) : cameraDenied ? (
        <PermissionDeniedScreen type="camera" onRetry={requestCameraPermission} t={t} />
      ) : cameraGranted ? (
        <CameraView style={StyleSheet.absoluteFillObject} facing="back">
          {/* Corner frame overlays */}
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />

          {/* Header overlay */}
          <View style={styles.overlayHeader}>
            <Text style={styles.overlayTitle}>{t('sakhi_lens')}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeButtonText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      ) : (
        <PermissionDeniedScreen type="camera" onRetry={requestCameraPermission} t={t} />
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

// ─── LanguageSelectionScreen Component ──────────────────────────────────────────
function LanguageSelectionScreen({ onSelect, currentLanguage }) {
  const languages = [
    { code: 'en', name: 'English', label: 'English' },
    { code: 'hi', name: 'Hindi', label: 'हिन्दी' },
    { code: 'kn', name: 'Kannada', label: 'ಕನ್ನಡ' },
    { code: 'es', name: 'Spanish', label: 'Español' },
  ];

  const confirmMessages = {
    en: "English selected",
    hi: "हिंदी चुना गया",
    kn: "ಕನ್ನಡ ಆಯ್ಕೆ ಮಾಡಲಾಗಿದೆ",
    es: "Español seleccionado"
  };

  const [selected, setSelected] = useState(currentLanguage || null);
  const [isConfirming, setIsConfirming] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const handleContinue = () => {
    if (!selected) return;
    // Persist language choice in background without blocking screen transition
    AsyncStorage.setItem('user_language', selected).catch((err) => {
      console.warn('[Storage] Failed to save language:', err);
    });
    
    setIsConfirming(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onSelect(selected);
      });
    }, 1700);
  };

  const activeLang = selected || currentLanguage || 'en';
  const localT = (key) => TRANSLATIONS[activeLang]?.[key] || TRANSLATIONS['en']?.[key] || key;

  return (
    <SafeAreaView style={langStyles.langContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={langStyles.langHeaderSection}>
        <Text style={langStyles.langTitle}>{localT('choose_lang')}</Text>
        <Text style={langStyles.langSubtitle}>{localT('select_pref_lang')}</Text>
      </View>

      <ScrollView contentContainerStyle={langStyles.langList} showsVerticalScrollIndicator={false}>
        {languages.map((lang) => {
          const isSelected = selected === lang.code;
          return (
            <TouchableOpacity
              key={lang.code}
              style={[
                langStyles.langCard,
                isSelected && langStyles.langCardSelected
              ]}
              activeOpacity={0.8}
              onPress={() => setSelected(lang.code)}
            >
              <View style={langStyles.langCardLeft}>
                <Text style={langStyles.langCardName}>{lang.name}</Text>
                <Text style={langStyles.langCardLabel}>{lang.label}</Text>
              </View>
              <View style={[
                langStyles.langCheckbox,
                isSelected && langStyles.langCheckboxSelected
              ]}>
                {isSelected && <Text style={langStyles.langCheckmark}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={langStyles.langFooter}>
        <TouchableOpacity
          style={[
            langStyles.langContinueButton,
            !selected && langStyles.langContinueButtonDisabled
          ]}
          disabled={!selected || isConfirming}
          activeOpacity={0.8}
          onPress={handleContinue}
        >
          <Text style={[
            langStyles.langContinueText,
            !selected && langStyles.langContinueTextDisabled
          ]}>{localT('continue')}</Text>
        </TouchableOpacity>
      </View>

      {isConfirming && (
        <Animated.View style={[langStyles.confirmOverlay, { opacity: fadeAnim }]}>
          <Text style={langStyles.confirmText}>{confirmMessages[selected]}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const langStyles = StyleSheet.create({
  langContainer: {
    flex: 1,
    backgroundColor: '#000000',
    paddingHorizontal: 24,
  },
  langHeaderSection: {
    marginTop: 40,
    marginBottom: 30,
  },
  langTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  langSubtitle: {
    fontSize: 14,
    color: '#555555',
    lineHeight: 20,
  },
  langList: {
    gap: 16,
    paddingBottom: 20,
  },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0d0d0d',
    borderWidth: 0.5,
    borderColor: '#222222',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  langCardSelected: {
    borderColor: '#ffffff',
    backgroundColor: '#111111',
  },
  langCardLeft: {
    gap: 4,
  },
  langCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  langCardLabel: {
    fontSize: 13,
    color: '#555555',
  },
  langCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  langCheckboxSelected: {
    borderColor: '#ffffff',
    backgroundColor: '#ffffff',
  },
  langCheckmark: {
    color: '#000000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  confirmOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  confirmText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  langFooter: {
    paddingVertical: 20,
    marginBottom: 10,
  },
  langContinueButton: {
    backgroundColor: '#ffffff',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langContinueButtonDisabled: {
    backgroundColor: '#111111',
    borderWidth: 0.5,
    borderColor: '#222222',
  },
  langContinueText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  langContinueTextDisabled: {
    color: '#333333',
  },
});
