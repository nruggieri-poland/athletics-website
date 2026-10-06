// Turns whatever an editor pastes into a "YouTube video" CMS field — a
// bare video ID, a bare playlist ID, a full link of any common shape, or
// the half-trimmed fragment you get copying out of the address bar — into
// something the hero embed can use. Exists so nobody has to know to dig the
// ID out of the URL by hand.
//
// When a paste carries both a video and a playlist (watch?v=X&list=Y — what
// you get copying the address bar while a playlist plays), the playlist
// wins: pasting that means "play this playlist," not "just that one video
// from inside it."
//
// Anything that doesn't parse to a plausibly real ID returns null, so the
// hero falls back to a plain background rather than rendering a pause
// button over a broken, invisible player.

export type YouTubeSource = { kind: "video" | "playlist"; id: string };

// Video IDs are always exactly 11 characters. Playlist IDs (PL…, UU…, OLAK5uy_…)
// are always much longer (18 at the shortest); 13+ keeps a real gap from 11
// so a bare ID can never be mistaken for the other kind.
const isVideoId = (s: string | null | undefined): s is string => !!s && /^[A-Za-z0-9_-]{11}$/.test(s);
const isPlaylistId = (s: string | null | undefined): s is string => !!s && /^[A-Za-z0-9_-]{13,}$/.test(s);

function fromParams(list: string | null, video: string | null): YouTubeSource | null {
  if (isPlaylistId(list)) return { kind: "playlist", id: list };
  if (isVideoId(video)) return { kind: "video", id: video };
  return null;
}

export function parseYouTubeSource(input: string | null | undefined): YouTubeSource | null {
  const raw = input?.trim();
  if (!raw) return null;

  // Full links, with or without the scheme.
  if (/^https?:\/\//i.test(raw) || /(^|\.)(youtube\.com|youtu\.be)\//i.test(raw)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      return null;
    }
    if (!/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i.test(url.hostname)) return null;

    const fromQuery = fromParams(url.searchParams.get("list"), url.searchParams.get("v"));
    if (fromQuery) return fromQuery;

    // youtu.be/ID, youtube.com/embed/ID, /shorts/ID, /live/ID
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    const idInPath = url.hostname.endsWith("youtu.be") || ["embed", "shorts", "live"].includes(segments[0]);
    return idInPath && isVideoId(last) ? { kind: "video", id: last } : null;
  }

  // Partial pastes: "VIDEOID&list=PLID&index=1", "v=VIDEOID&list=PLID", "?v=VIDEOID".
  if (/[&=]/.test(raw)) {
    const [first, ...rest] = raw.replace(/^\?/, "").split("&");
    const leadingIsParam = first.includes("=");
    const params = new URLSearchParams(leadingIsParam ? [first, ...rest].join("&") : rest.join("&"));
    return fromParams(params.get("list"), leadingIsParam ? params.get("v") : first);
  }

  // A bare ID. Length alone says which kind.
  if (isVideoId(raw)) return { kind: "video", id: raw };
  if (isPlaylistId(raw)) return { kind: "playlist", id: raw };
  return null;
}

// Muted, looping, no-controls background embed — the exact parameter set
// VideoHero has always used for a single video, extended to playlists.
// A single video loops by naming itself as its own one-item playlist; a
// real playlist loops by itself via loop=1.
export function heroEmbedSrc(source: YouTubeSource): string {
  const common = "autoplay=1&mute=1&loop=1&controls=0&showinfo=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1";
  const id = encodeURIComponent(source.id);
  return source.kind === "playlist"
    ? `https://www.youtube.com/embed/videoseries?list=${id}&${common}`
    : `https://www.youtube.com/embed/${id}?playlist=${id}&${common}`;
}
