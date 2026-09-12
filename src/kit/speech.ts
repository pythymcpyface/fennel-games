// Optional speech flourish — REQ-011/012, NFR-006. Off by default, muteable, uses the
// Web Speech API only (no network, graceful absence). Never throws.

const AUDIO_KEY = "fennel-games:v1:audioEnabled";

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Persisted global opt-in (default false). */
export function audioEnabled(read: (k: string) => string | null): boolean {
  return read(AUDIO_KEY) === "1";
}
export function setAudioEnabled(write: (k: string, v: string) => void, on: boolean): void {
  write(AUDIO_KEY, on ? "1" : "0");
}

/**
 * Speak `text` if speech is supported AND the player has opted in. Returns the mode
 * actually used so callers can log/telemetry without PII. Silent, non-throwing no-op
 * otherwise.
 */
export function speak(text: string, enabled: boolean): "web_speech" | "none" {
  if (!enabled || !isSpeechSupported() || !text.trim()) return "none";
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    return "web_speech";
  } catch {
    return "none";
  }
}
