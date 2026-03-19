// Album art component — drop-in replacement for VinylDisc.
// Fetches real album cover art via iTunes Search API, falls back to VinylDisc while loading or on error.
import { useState, useEffect } from 'react';
import VinylDisc from './VinylDisc';
import { getCoverUrl } from '../../utils/coverArt';

export default function AlbumArt({ album, artist, size = 72, accent = "#555" }) {
  const [url, setUrl] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setErrored(false);
    setUrl(null);

    if (album || artist) {
      getCoverUrl(album, artist).then(result => {
        if (!cancelled) setUrl(result);
      });
    }
    return () => { cancelled = true; };
  }, [album, artist]);

  // Show VinylDisc as fallback while loading, on error, or if no art found
  if (!url || errored) {
    return <VinylDisc accent={accent} size={size} />;
  }

  const radius = Math.round(size * 0.18);

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: radius,
      overflow: "hidden",
      flexShrink: 0,
      background: "#1a1a1a",
      border: "1px solid #2a2a2a",
      position: "relative",
    }}>
      {/* VinylDisc shows while image is loading */}
      {!loaded && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <VinylDisc accent={accent} size={size} />
        </div>
      )}
      <img
        src={url}
        alt={`${album || "Album"} cover`}
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: loaded ? "block" : "block",
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.25s ease",
        }}
      />
    </div>
  );
}
