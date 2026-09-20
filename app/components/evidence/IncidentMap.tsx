import CachedIncidentMap from "./CachedIncidentMap";
import { roadMapPosition } from "../../../shared/road-map";
import MapView, { Marker } from "react-native-maps";
export default function IncidentMap({
  lat,
  lng,
  onPick,
}: {
  lat: number;
  lng: number;
  onPick?: (lat: number, lng: number) => void;
}) {
  if (!onPick && roadMapPosition(lat, lng).available)
    return <CachedIncidentMap lat={lat} lng={lng} />;
  return (
    <MapView
      style={{ height: 190, borderRadius: 14, marginVertical: 10 }}
      region={{
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.009,
        longitudeDelta: 0.009,
      }}
      onPress={
        onPick
          ? (e) =>
              onPick(
                e.nativeEvent.coordinate.latitude,
                e.nativeEvent.coordinate.longitude,
              )
          : undefined
      }
      accessibilityLabel="Incident location"
    >
      <Marker coordinate={{ latitude: lat, longitude: lng }} />
    </MapView>
  );
}
