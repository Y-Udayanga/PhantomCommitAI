export const aiProviders = ["gemma", "ultramarine"] as const;
export type AIProvider = (typeof aiProviders)[number];
export const providerLabel = (provider: AIProvider) =>
  provider === "ultramarine" ? "Ultramarine" : "Google Gemma";
export const processingNotice = (provider: AIProvider) =>
  provider === "ultramarine"
    ? "Paper Instruments’ hosted Ultramarine API"
    : "Google’s hosted Gemma API";
