export const CHATBOT_GENERIC_ERROR =
  "Nie udało się uzyskać odpowiedzi chatbota. Sprawdź konfigurację usługi i spróbuj ponownie.";

export function canSendChatMessage(message: string, configured: boolean, loading: boolean) {
  return configured && !loading && message.trim().length > 0;
}

export function getChatbotErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return CHATBOT_GENERIC_ERROR;
}
