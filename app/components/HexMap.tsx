import { useEffect, useRef } from 'react';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { useReducedMotion } from 'react-native-reanimated';
import type { Hex } from '@/lib/api';
import { C } from '@/lib/theme';
import { shader } from './hexStyle';

// Native: Apple/Google map with server-computed H3 rings. No H3 math on the phone.
// Opens pulled back and animates the camera in to the home cell, like a map settling on a place;
// reduced-motion users get the final framing immediately instead.
export default function HexMap({ hexes, center, home, label }: { hexes: Hex[]; center: [number, number]; home?: string; label: string }) {
  const fill = shader(hexes);
  const mapRef = useRef<MapView>(null);
  const reduced = useReducedMotion();
  const target = { latitude: center[0], longitude: center[1] };

  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => {
      mapRef.current?.animateCamera({ center: target, zoom: 15.5, pitch: 0 }, { duration: 900 });
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], reduced]);

  return (
    <MapView
      ref={mapRef}
      style={{ flex: 1 }}
      mapType="mutedStandard"
      initialCamera={reduced ? undefined : { center: target, zoom: 13.2, pitch: 0, heading: 0 }}
      initialRegion={reduced ? { ...target, latitudeDelta: 0.014, longitudeDelta: 0.014 } : undefined}
      showsPointsOfInterests={false}
      pitchEnabled={false}
      accessibilityLabel={label}
    >
      {hexes.map((h) => (
        <Polygon
          key={h.cell}
          coordinates={h.ring.map(([latitude, longitude]) => ({ latitude, longitude }))}
          fillColor={fill(h)}
          strokeColor={h.cell === home ? C.ink : 'rgba(54,119,131,0.55)'}
          strokeWidth={h.cell === home ? 2.5 : 0.8}
        />
      ))}
      <Marker coordinate={target} pinColor={C.rust} />
    </MapView>
  );
}
