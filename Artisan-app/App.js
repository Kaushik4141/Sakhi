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
  Dimensions,
  Easing,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { useSharedValue, withTiming, useDerivedValue, useFrameCallback } from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system/legacy';
import { Canvas, Path, Skia, LinearGradient, vec } from '@shopify/react-native-skia';

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

// WaveformBars replaced by SiriWaveform (see SiriWaveform.js)

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  // Camera permissions (expo-camera hook)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Microphone permission state
  const [micStatus, setMicStatus] = useState(PERM_STATUS.UNDETERMINED);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef(null);

  // Reanimated shared value for live microphone volume metering
  const volumeLevel = useSharedValue(0);

  // Camera overlay visibility state
  const [showCamera, setShowCamera] = useState(false);

  // WebSocket
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const [wsStatus, setWsStatus] = useState(WS_STATUS.CLOSED);

  // Button animation
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

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

  // ── Push to Talk: Start ───────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      // Check permission directly to avoid closure race conditions
      const { granted } = await Audio.getPermissionsAsync();
      if (!granted) return;

      // If already recording, don't start a new one
      if (recordingRef.current) return;

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      recording.setOnRecordingStatusUpdate((status) => {
        console.log('raw metering:', status.metering);
        if (status.isRecording && status.metering !== undefined) {
          const db = status.metering;
          const minDb = -60;
          const maxDb = -10;
          let val = (db - minDb) / (maxDb - minDb);
          val = Math.max(0, Math.min(1, val));
          volumeLevel.value = val;
          const normalized = val * 28;
          amplitudeRef.value = normalized;
          console.log('normalized amp:', normalized);
        } else {
          amplitudeRef.value = 0;
        }
      });
      await recording.startAsync();
      await recording.setProgressUpdateInterval(80);
      recordingRef.current = recording;
      setIsRecording(true);
      Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: true }).start();
    } catch (err) {
      console.warn('[PTT] Failed to start recording:', err);
    }
  }, [scaleAnim, volumeLevel]);

  // ── WebSocket: Send Audio Payload ─────────────────────────────────────────
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

    const payload = JSON.stringify({
      event: 'user_audio',
      data: base64Audio,
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
  }, []);

  // ── Push to Talk: Stop ────────────────────────────────────────────────────
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
      amplitudeRef.value = 0;
      volumeLevel.value = withTiming(0, { duration: 300 });
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    }
    // Read file + send via WebSocket (runs after UI updates)
    if (uri) {
      await sendAudioPayload(uri);
    }
  }, [scaleAnim, sendAudioPayload, volumeLevel]);

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
      // Start recording on connection (Bypassed for local/offline testing)
      // startRecording();
    };

    ws.onmessage = (event) => {
      console.log('[WS] Message received:', event.data);
      try {
        const msg = JSON.parse(event.data);
        
        let isToolCall = false;
        if (msg.toolCall?.functionCalls) {
          isToolCall = msg.toolCall.functionCalls.some(fc => fc.name === 'request_visual_input');
        } else if (msg.serverContent?.modelTurn?.parts) {
          isToolCall = msg.serverContent.modelTurn.parts.some(
            part => part.functionCall?.name === 'request_visual_input'
          );
        } else if (msg.type === 'function_call' && msg.name === 'request_visual_input') {
          isToolCall = true;
        } else if (typeof event.data === 'string' && event.data.includes('request_visual_input')) {
          isToolCall = true;
        }
        
        if (isToolCall) {
          console.log('[Gemini] Model requested visual input. Opening camera overlay…');
          setShowCamera(true);
        }
      } catch (err) {
        console.warn('[WS] Failed to parse message:', err);
      }
    };

    ws.onerror = (err) => {
      console.warn('[WS] Error:', err.message);
      setWsStatus(WS_STATUS.ERROR);
    };

    ws.onclose = (event) => {
      console.log('[WS] Closed. Code:', event.code);
      setWsStatus(WS_STATUS.CLOSED);
      // Stop recording on close (Bypassed for local/offline testing)
      // stopRecording();
      // Auto-reconnect after delay
      reconnectTimer.current = setTimeout(() => {
        console.log('[WS] Attempting reconnect…');
        connectWebSocket();
      }, WS_RECONNECT_DELAY_MS);
    };

    wsRef.current = ws;
  }, [startRecording, stopRecording, setShowCamera]);

  // ── Gemini Live Session Wrapper ──────────────────────────────────────────
  const geminiLiveSession = useRef({
    connect: () => {
      connectWebSocket();
    },
    disconnect: () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      stopRecording();
    }
  }).current;

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

      // Start Gemini Live Session
      geminiLiveSession.connect();
    })();

    // Cleanup on unmount
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      geminiLiveSession.disconnect();
    };
  }, [geminiLiveSession, requestMicPermission, startRecording]);

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
    [WS_STATUS.SENDING]:    { label: 'Sending…',    color: '#FFFFFF', dot: '#FFFFFF' },
    [WS_STATUS.SENT]:       { label: '✓ Sent',      color: '#34D399', dot: '#34D399' },
    [WS_STATUS.ERROR]:      { label: 'WS Error',    color: '#EF4444', dot: '#EF4444' },
    [WS_STATUS.CLOSED]:     { label: 'Disconnected',color: '#555555', dot: '#555555' },
  };
  const wsBadge = wsStatusConfig[wsStatus];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

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
        {micDenied && (
          <PermissionDeniedScreen type="microphone" onRetry={requestMicPermission} />
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
