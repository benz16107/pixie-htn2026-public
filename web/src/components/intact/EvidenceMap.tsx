"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { roadMapPosition } from "../../../../shared/road-map";
import a from "../../../../shared/road-map/0-0.png";
import b from "../../../../shared/road-map/0-1.png";
import c from "../../../../shared/road-map/0-2.png";
import d from "../../../../shared/road-map/1-0.png";
import e from "../../../../shared/road-map/1-1.png";
import f from "../../../../shared/road-map/1-2.png";
import g from "../../../../shared/road-map/2-0.png";
import h from "../../../../shared/road-map/2-1.png";
import i from "../../../../shared/road-map/2-2.png";
const tiles = [a, b, c, d, e, f, g, h, i];
export function EvidenceMap({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);
  const p = roadMapPosition(lat, lng);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div
        ref={ref}
        role="img"
        aria-label={`Reported scene at ${lat}, ${lng}`}
        style={{
          height: 200,
          borderRadius: 10,
          overflow: "hidden",
          position: "relative",
          background: "#edf2f3",
        }}
      >
        {p.available ? (
          <>
            {tiles.map((tile, index) => (
              <Image unoptimized
                key={index}
                src={tile.src}
                alt=""
                width={256}
                height={256}
                style={{
                  position: "absolute",
                  maxWidth: "none",
                  left: (index % 3) * 256 - p.x + width / 2,
                  top: Math.floor(index / 3) * 256 - p.y + 100,
                }}
              />
            ))}
            <span
              style={{
                position: "absolute",
                left: width / 2 - 10,
                top: 90,
                width: 20,
                height: 20,
                background: "#1e5b69",
                border: "4px solid white",
                borderRadius: "50%",
              }}
            />
          </>
        ) : (
          <p style={{ padding: 24 }}>
            No bundled street map for this location. Use the reported
            coordinates below.
          </p>
        )}
      </div>
      <small style={{ fontSize: 10, color: "#526a6e" }}>
        ©{" "}
        <a href="https://www.openstreetmap.org/copyright">
          OpenStreetMap contributors
        </a>{" "}
        · Cached map
      </small>
    </>
  );
}
