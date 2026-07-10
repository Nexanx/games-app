import { describe, expect, it } from "vitest";

import { canSendChatMessage, CHATBOT_GENERIC_ERROR, getChatbotErrorMessage } from "../lib/chatbot";

describe("chatbot UI helpers", () => {
  it("allows sending only non-empty messages when chatbot is configured and idle", () => {
    expect(canSendChatMessage("Podsumuj 2026", true, false)).toBe(true);
    expect(canSendChatMessage("   ", true, false)).toBe(false);
    expect(canSendChatMessage("Podsumuj 2026", false, false)).toBe(false);
    expect(canSendChatMessage("Podsumuj 2026", true, true)).toBe(false);
  });

  it("shows a friendly fallback when an unknown chatbot error occurs", () => {
    expect(getChatbotErrorMessage(null)).toBe(CHATBOT_GENERIC_ERROR);
    expect(getChatbotErrorMessage(new Error("Brak konfiguracji chatbota."))).toBe("Brak konfiguracji chatbota.");
  });
});
