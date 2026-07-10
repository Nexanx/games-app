export const CHATBOT_GENERIC_ERROR =
  "Nie udało się uzyskać odpowiedzi chatbota. Sprawdź konfigurację usługi i spróbuj ponownie.";

export const CHATBOT_ERROR_CODES = [
  "llm_not_configured",
  "llm_auth_error",
  "llm_timeout",
  "llm_rate_limited",
  "llm_provider_unavailable",
  "llm_network_error",
  "llm_invalid_response",
  "llm_internal_error"
] as const;

export type ChatbotErrorCode = (typeof CHATBOT_ERROR_CODES)[number];

export type ChatbotErrorDetails = {
  code: ChatbotErrorCode | null;
  errorId: string | null;
  message: string;
};

const CHATBOT_ERROR_MESSAGES: Record<ChatbotErrorCode, string> = {
  llm_not_configured: "Chatbot nie został jeszcze skonfigurowany.",
  llm_auth_error: "Dostawca modelu odrzucił konfigurację dostępu.",
  llm_timeout: "Model nie odpowiedział w wymaganym czasie. Spróbuj ponownie.",
  llm_rate_limited: "Dostawca modelu chwilowo ograniczył liczbę zapytań. Spróbuj później.",
  llm_provider_unavailable: "Usługa chatbota jest obecnie niedostępna.",
  llm_network_error: "Nie udało się połączyć z usługą chatbota. Spróbuj ponownie.",
  llm_invalid_response: "Dostawca modelu zwrócił nieprawidłową odpowiedź.",
  llm_internal_error: "Wystąpił wewnętrzny błąd chatbota. Spróbuj ponownie."
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function getErrorRecords(error: unknown) {
  const root = asRecord(error);
  const detail = asRecord(root?.detail);
  const data = asRecord(root?.data);
  return [root, detail, data];
}

function isChatbotErrorCode(value: string | null): value is ChatbotErrorCode {
  return value !== null && (CHATBOT_ERROR_CODES as readonly string[]).includes(value);
}

export function canSendChatMessage(message: string, configured: boolean, loading: boolean) {
  return configured && !loading && message.trim().length > 0;
}

export function getChatbotErrorDetails(error: unknown): ChatbotErrorDetails {
  const records = getErrorRecords(error);
  const code = records.map((record) => readString(record, ["code"])).find(isChatbotErrorCode) ?? null;
  const errorId = records.map((record) => readString(record, ["error_id", "errorId"])).find(Boolean) ?? null;
  const responseMessage = records.map((record) => readString(record, ["message"])).find(Boolean) ?? null;

  return {
    code,
    errorId,
    message: code ? CHATBOT_ERROR_MESSAGES[code] : responseMessage ?? CHATBOT_GENERIC_ERROR
  };
}

export function getChatbotErrorMessage(error: unknown) {
  return getChatbotErrorDetails(error).message;
}
