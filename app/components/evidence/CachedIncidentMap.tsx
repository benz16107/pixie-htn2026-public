import { C } from '@/lib/theme';
import { Image, Text, View } from "react-native";
import { useState } from "react";
import { roadMapPosition } from "../../../shared/road-map";
import { es } from "./styles";
const tiles = [
  require("../../../shared/road-map/0-0.png"),
  require("../../../shared/road-map/0-1.png"),
  require("../../../shared/road-map/0-2.png"),
  require("../../../shared/road-map/1-0.png"),
  require("../../../shared/road-map/1-1.png"),
  require("../../../shared/road-map/1-2.png"),
  require("../../../shared/road-map/2-0.png"),
  require("../../../shared/road-map/2-1.png"),
  require("../../../shared/road-map/2-2.png"),
];
export default function IncidentMap({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
  onPick?: (lat: number, lng: number) => void;
}) {
  const [width, setWidth] = useState(300);
  const p = roadMapPosition(lat, lng);
  return (
    <View style={{ marginVertical: 10 }}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityLabel={`Reported scene map at ${lat}, ${lng}`}
        style={{
          height: 180,
          borderRadius: 12,
          overflow: "hidden",
          backgroundColor: C.land,
        }}
      >
        {p.available ? (
          <>
            {tiles.map((source, i) => (
              <Image
                key={i}
                source={source}
                style={{
                  position: "absolute",
                  left: (i % 3) * 256 - p.x + width / 2,
                  top: Math.floor(i / 3) * 256 - p.y + 90,
                  width: 256,
                  height: 256,
                }}
              />
            ))}
            <View
              style={{
                position: "absolute",
                top: 80,
                left: width / 2 - 10,
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 4,
                borderColor: "white",
                backgroundColor: C.ochre,
              }}
            />
          </>
        ) : (
          <Text style={[es.note, { padding: 20 }]}>
            No bundled street map for this location. Use the coordinates below.
          </Text>
        )}
      </View>
      <Text style={[es.note, { fontSize: 10 }]}>
        © OpenStreetMap contributors · Cached map
      </Text>
      <Text style={es.note}>
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </Text>
    </View>
  );
}
