import { Image } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
function Video({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      player={player}
      nativeControls
      style={{ width: "100%", height: 210, borderRadius: 12 }}
      contentFit="contain"
    />
  );
}
export function EvidenceMedia({
  uri,
  mime,
  label,
}: {
  uri: string;
  mime: string;
  label: string;
}) {
  return mime.startsWith("video/") ? (
    <Video uri={uri} />
  ) : (
    <Image
      source={{ uri }}
      accessibilityLabel={label}
      resizeMode="contain"
      style={{ width: "100%", height: 210, borderRadius: 12 }}
    />
  );
}
