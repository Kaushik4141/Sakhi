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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// ─── WebSocket Config ──────────────────────────────────────────────────────────
const WS_URL = 'ws://localhost:8787/ws';
const DUMMY_ARTISAN_ID = 'artisan_demo_001';
const WS_RECONNECT_DELAY_MS = 3000;

// ─── WebSocket Status ──────────────────────────────────────────────────────────
const WS_STATUS = {
  CONNECTING: 'connecting',
  CONNECTED:  'connected',
  SENDING:    'sending',
  SENT:       'sent',
  ERROR:      'error',
  CLOSED:     'closed',
};

// ─── Permission Status Enum ────────────────────────────────────────────────────
const PERM_STATUS = {
  UNDETERMINED: 'undetermined',
  GRANTED: 'granted',
  DENIED: 'denied',
};

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
  const recordingRef = useRef(null);

  // WebSocket
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const [wsStatus, setWsStatus] = useState(WS_STATUS.CLOSED);

  // Button animation
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // ── WebSocket: Connect ────────────────────────────────────────────────────
  const connectWebSocket = useCallback(() => {
    // Don't open a second socket if one is already live
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

    console.log('[WS] Connecting to', WS_URL);
    setWsStatus(WS_STATUS.CONNECTING);

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[WS] Connected');
      setWsStatus(WS_STATUS.CONNECTED);
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    ws.onmessage = (event) => {
      console.log('[WS] Message received:', event.data);
    };

    ws.onerror = (err) => {
      console.warn('[WS] Error:', err.message);
      setWsStatus(WS_STATUS.ERROR);
    };

    ws.onclose = (event) => {
      console.log('[WS] Closed. Code:', event.code);
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
  const sendAudioPayload = useCallback(async (uri) => {
    if (!uri) {
      console.warn('[WS] No URI provided — skipping send');
      return;
    }

    // Read file as base64
    let base64Audio;
    try {
      base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch (fsErr) {
      console.error('[FS] Failed to read audio file:', fsErr);
      setWsStatus(WS_STATUS.ERROR);
      return;
    }

    // Infer MIME type from file extension
    const ext = uri.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'wav' ? 'audio/wav' : 'audio/m4a';

    const payload = JSON.stringify({
      type:         'audio_input',
      artisan_id:   DUMMY_ARTISAN_ID,
      audio_base64: base64Audio,
      mime_type:    mimeType,
      timestamp:    new Date().toISOString(),
    });

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Socket not open — payload dropped. Will reconnect.');
      setWsStatus(WS_STATUS.ERROR);
      connectWebSocket();
      return;
    }

    try {
      setWsStatus(WS_STATUS.SENDING);
      ws.send(payload);
      console.log(`[WS] Sent audio payload (${(base64Audio.length / 1024).toFixed(1)} KB base64)`);
      setWsStatus(WS_STATUS.SENT);
      // Reset to CONNECTED after brief visual feedback
      setTimeout(() => setWsStatus(WS_STATUS.CONNECTED), 1500);
    } catch (sendErr) {
      console.error('[WS] Failed to send:', sendErr);
      setWsStatus(WS_STATUS.ERROR);
    }
  }, [connectWebSocket]);

  // ── Request Microphone Permission ──────────────────────────────────────────
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
    if (micStatus !== PERM_STATUS.GRANTED) return;
    try {
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true }).start();
    } catch (err) {
      console.warn('[PTT] Failed to start recording:', err);
    }
  }, [micStatus, scaleAnim]);

  // ── Push to Talk: Stop → Read → Send ─────────────────────────────────────
  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    let uri = null;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      uri = recordingRef.current.getURI();
      console.log('[PTT] Recording saved to:', uri);
      recordingRef.current = null;
    } catch (err) {
      console.warn('[PTT] Failed to stop recording:', err);
      recordingRef.current = null;
    } finally {
      setIsRecording(false);
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    }
    // Read file + send via WebSocket (runs after UI updates)
    if (uri) {
      await sendAudioPayload(uri);
    }
  }, [scaleAnim, sendAudioPayload]);

  // ── Derived Permission States ─────────────────────────────────────────────
  const cameraGranted = cameraPermission?.granted;
  const cameraLoading = cameraPermission === null;
  const cameraDenied = cameraPermission && !cameraPermission.granted && !cameraPermission.canAskAgain;

  const micGranted = micStatus === PERM_STATUS.GRANTED;
  const micDenied = micStatus === PERM_STATUS.DENIED;

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
              {isRecording ? 'Release to stop' : 'Hold to speak'}
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
              disabled={!micGranted}
              style={({ pressed }) => [styles.pttButtonWrapper]}
            >
              <Animated.View
                style={[
                  styles.pttButton,
                  isRecording && styles.pttButtonActive,
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
