import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canSendChatMessage,
  CHATBOT_GENERIC_ERROR,
  getChatbotErrorDetails,
  getChatbotErrorMessage
} from "../lib/chatbot";
import { api } from "../services/api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

  it.each([
    ["llm_not_configured", "Chatbot nie został jeszcze skonfigurowany."],
    ["llm_auth_error", "Dostawca modelu odrzucił konfigurację dostępu."],
    ["llm_timeout", "Model nie odpowiedział w wymaganym czasie. Spróbuj ponownie."],
    ["llm_rate_limited", "Dostawca modelu chwilowo ograniczył liczbę zapytań. Spróbuj później."],
    ["llm_provider_unavailable", "Usługa chatbota jest obecnie niedostępna."],
    ["llm_network_error", "Nie udało się połączyć z usługą chatbota. Spróbuj ponownie."],
    ["llm_invalid_response", "Dostawca modelu zwrócił nieprawidłową odpowiedź."],
    ["llm_internal_error", "Wystąpił wewnętrzny błąd chatbota. Spróbuj ponownie."]
  ])("maps %s to a safe Polish message", (code, message) => {
    expect(
      getChatbotErrorDetails({
        code,
        error_id: "llm-error-123",
        message: "Nie pokazuj technicznego komunikatu dostawcy"
      })
    ).toEqual({ code, errorId: "llm-error-123", message });
  });

  it("reads structured API details attached to an Error instance", () => {
    const error = Object.assign(new Error("API error 504"), {
      detail: { code: "llm_timeout", error_id: "timeout-42", message: "raw provider response" }
    });

    expect(getChatbotErrorDetails(error)).toEqual({
      code: "llm_timeout",
      errorId: "timeout-42",
      message: "Model nie odpowiedział w wymaganym czasie. Spróbuj ponownie."
    });
  });
});

describe("chatbot API", () => {
  it("allows the chatbot more time than regular API requests", async () => {
    const setTimeoutMock = vi.fn(() => 1);
    const clearTimeoutMock = vi.fn();
    vi.stubGlobal("window", { setTimeout: setTimeoutMock, clearTimeout: clearTimeoutMock });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      session_id: 7,
      answer: "Gotowe",
      message: {
        id: 11,
        session_id: 7,
        role: "assistant",
        content: "Gotowe",
        created_at: "2026-07-13T00:00:00Z"
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    await api.chat("Podsumuj moje gry");

    expect(setTimeoutMock).toHaveBeenCalledWith(expect.any(Function), 75_000);
    expect(clearTimeoutMock).toHaveBeenCalledWith(1);
  });
});
