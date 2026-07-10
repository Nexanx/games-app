import { describe, expect, it } from "vitest";

import { getGameCoverInitials, getGameCoverSource } from "../lib/game-cover";

describe("GameCover helpers", () => {
  it("uses a smaller RAWG derivative for card covers", () => {
    expect(getGameCoverSource("https://media.rawg.io/media/games/abc/cover.jpg", "card")).toBe(
      "https://media.rawg.io/media/resize/420/-/games/abc/cover.jpg"
    );
  });

  it("does not alter an existing derivative or another image host", () => {
    expect(getGameCoverSource("https://media.rawg.io/media/resize/640/-/games/abc/cover.jpg", "thumbnail")).toBe(
      "https://media.rawg.io/media/resize/640/-/games/abc/cover.jpg"
    );
    expect(getGameCoverSource("https://example.com/cover.jpg")).toBe("https://example.com/cover.jpg");
  });

  it("creates a useful fallback abbreviation", () => {
    expect(getGameCoverInitials("Baldur's Gate")).toBe("BG");
    expect(getGameCoverInitials("   ")).toBe("GR");
  });
});
