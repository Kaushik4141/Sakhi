/**
 * SiriWaveform.js
 *
 * A glowing capsule-shaped fluid waveform visualizer styled after the Gemini AI voice interface.
 * Uses @shopify/react-native-skia for hardware-accelerated rendering and blur masks,
 * and react-native-reanimated to perform smooth continuous phase shifting and microphone
 * metering animations on the UI thread.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  Canvas,
  Path,
  Skia,
  LinearGradient,
  BlurMask,
  Group,
  Rect,
  vec,
} from '@shopify/react-native-skia';

// Layout size of the capsule matching the design
const WIDTH = 320;
const HEIGHT = 160;
const RADIUS = 80;

const clipRRect = {
  rect: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  rx: RADIUS,
  ry: RADIUS,
};

export default function SiriWaveform({ isActive = false, volumeLevel }) {
  // Reanimated shared values for phase shifting
  const phase1 = useSharedValue(0);
  const phase2 = useSharedValue(0);
  const phase3 = useSharedValue(0);

  // Smoothly interpolate active state (0 when idle, 1 when recording)
  const activeProgress = useSharedValue(0);

  // Default volume shared value if none is passed
  const defaultVolume = useSharedValue(0);
  const currentVolume = volumeLevel || defaultVolume;

  useEffect(() => {
    // Start continuous smooth phase shifting on UI thread
    phase1.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 5500, easing: Easing.linear }),
      -1,
      false
    );
    phase2.value = withRepeat(
      withTiming(-2 * Math.PI, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
    phase3.value = withRepeat(
      withTiming(2 * Math.PI, { duration: 2600, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  useEffect(() => {
    activeProgress.value = withTiming(isActive ? 1 : 0, { duration: 400 });
  }, [isActive]);

  // Derived Paths for the three organic fluid waves
  const path1 = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const baseline = HEIGHT * 0.72;
    // Base amplitude (gentle breathing) + volume-driven scaling
    const amplitude = activeProgress.value * (12 + currentVolume.value * 45);

    p.moveTo(0, HEIGHT);
    for (let x = 0; x <= WIDTH; x += 4) {
      const angle = (x / WIDTH) * 1.8 * Math.PI + phase1.value;
      const y = baseline - amplitude * Math.sin(angle);
      p.lineTo(x, y);
    }
    p.lineTo(WIDTH, HEIGHT);
    p.close();
    return p;
  });

  const path2 = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const baseline = HEIGHT * 0.75;
    const amplitude = activeProgress.value * (10 + currentVolume.value * 55);

    p.moveTo(0, HEIGHT);
    for (let x = 0; x <= WIDTH; x += 4) {
      const angle = (x / WIDTH) * 2.5 * Math.PI + phase2.value;
      const y = baseline - amplitude * Math.cos(angle);
      p.lineTo(x, y);
    }
    p.lineTo(WIDTH, HEIGHT);
    p.close();
    return p;
  });

  const path3 = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const baseline = HEIGHT * 0.78;
    const amplitude = activeProgress.value * (8 + currentVolume.value * 65);

    p.moveTo(0, HEIGHT);
    for (let x = 0; x <= WIDTH; x += 4) {
      const angle1 = (x / WIDTH) * 3.2 * Math.PI + phase3.value;
      const angle2 = (x / WIDTH) * 1.5 * Math.PI - phase1.value;
      const y = baseline - amplitude * (Math.sin(angle1) * 0.65 + Math.cos(angle2) * 0.35);
      p.lineTo(x, y);
    }
    p.lineTo(WIDTH, HEIGHT);
    p.close();
    return p;
  });

  // Animated style for the capsule container to fade/slide smoothly
  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isActive ? 1 : 0, { duration: 350 }),
      transform: [
        { translateY: withTiming(isActive ? 0 : 30, { duration: 350 }) },
        { scale: withTiming(isActive ? 1 : 0.9, { duration: 350 }) }
      ],
    };
  });

  return (
    <View style={styles.outerContainer} pointerEvents="none">
      <Animated.View style={[styles.capsuleContainer, containerStyle]}>
        <Canvas style={styles.canvas}>
          <Group clip={clipRRect}>
            {/* Background Rect with dark gradient */}
            <Rect x={0} y={0} width={WIDTH} height={HEIGHT}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, HEIGHT)}
                colors={['#0d0d0d', '#000000']}
              />
            </Rect>

            {/* Back Wave: Deep Blue */}
            <Path path={path1} opacity={0.65}>
              <LinearGradient
                start={vec(0, HEIGHT)}
                end={vec(WIDTH, HEIGHT * 0.3)}
                colors={['#1E3A8A', '#0D5CDE', '#0d0d0d']}
                positions={[0, 0.45, 1]}
              />
              <BlurMask radius={22} style="normal" />
            </Path>

            {/* Middle Wave: Light Blue */}
            <Path path={path2} opacity={0.8}>
              <LinearGradient
                start={vec(0, HEIGHT)}
                end={vec(WIDTH, HEIGHT * 0.25)}
                colors={['#3B82F6', '#1E40AF', '#0d0d0d']}
                positions={[0, 0.4, 1]}
              />
              <BlurMask radius={16} style="normal" />
            </Path>

            {/* Foreground Wave: Bright White/Cyan */}
            <Path path={path3} opacity={0.95}>
              <LinearGradient
                start={vec(0, HEIGHT)}
                end={vec(WIDTH * 0.85, HEIGHT * 0.2)}
                colors={['#FFFFFF', '#93C5FD', '#2563EB', '#0d0d0d']}
                positions={[0, 0.25, 0.6, 1]}
              />
              <BlurMask radius={10} style="normal" />
            </Path>
          </Group>
        </Canvas>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  capsuleContainer: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: RADIUS,
    borderWidth: 0.5,
    borderColor: '#222222',
    backgroundColor: '#0d0d0d',
    overflow: 'hidden',
    // Shadow to make the capsule pop off the dark background
    shadowColor: '#222222',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  canvas: {
    flex: 1,
  },
});
