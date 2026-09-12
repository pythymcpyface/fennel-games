import { describe, it, expect } from "vitest";
import { isSpeechSupported, audioEnabled, setAudioEnabled, speak } from "../src/kit/speech.ts";

// jsdom has no speechSynthesis -> everything must degrade gracefully (REQ-012, NFR-006).

describe("speech helper", () => {
  it("reports unsupported under jsdom and speak() no-ops to 'none'", () => {
    expect(isSpeechSupported()).toBe(false);
    expect(speak("hello", true)).toBe("none");
  });

  it("never speaks when disabled", () => {
    expect(speak("hello", false)).toBe("none");
  });

  it("audioEnabled defaults false and round-trips via storage", () => {
    const m = new Map<string, string>();
    const read = (k: string) => (m.has(k) ? m.get(k)! : null);
    const write = (k: string, v: string) => void m.set(k, v);
    expect(audioEnabled(read)).toBe(false);
    setAudioEnabled(write, true);
    expect(audioEnabled(read)).toBe(true);
    setAudioEnabled(write, false);
    expect(audioEnabled(read)).toBe(false);
  });
});
