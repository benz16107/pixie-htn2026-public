import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polygon, Rect } from 'react-native-svg';
import type { Hex } from '@/lib/api';
import { C } from '@/lib/theme';
import { shader } from './hexStyle';

// Web has no react-native-maps; draw the same server rings on an equirectangular SVG.
export default function HexMap({ hexes, center, home, label }: { hexes: Hex[]; center: [number, number]; home?: string; label: string }) {
  const fill = shader(hexes);
  const [box, setBox] = useState({ w: 350, h: 320 });
  const k = Math.cos((center[0] * Math.PI) / 180);
  const pts = hexes.flatMap((h) => h.ring);
  const span = Math.max(...pts.map(([la, ln]) => Math.max(Math.abs(la - center[0]), Math.abs(ln - center[1]) * k)), 0.001) * 1.08;
  const scale = Math.min(box.w, box.h) / 2 / span;
  const xy = ([la, ln]: [number, number]) => `${(box.w / 2 + (ln - center[1]) * k * scale).toFixed(1)},${(box.h / 2 - (la - center[0]) * scale).toFixed(1)}`;
  return (
    <View style={{ flex: 1 }} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} accessibilityLabel={label} role="img">
      <Svg width={box.w} height={box.h}>
        <Rect width={box.w} height={box.h} fill={C.land} />
        {hexes.map((h) => (
          <Polygon
            key={h.cell}
            points={h.ring.map(xy).join(' ')}
            fill={fill(h)}
            stroke={h.cell === home ? C.ink : 'rgba(54,119,131,0.55)'}
            strokeWidth={h.cell === home ? 2.5 : 0.8}
          />
        ))}
        <Circle cx={box.w / 2} cy={box.h / 2} r={7} fill={C.rust} stroke={C.paper} strokeWidth={2} />
      </Svg>
    </View>
  );
}
