
// Import the OpenRouter provider factory.
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

// Create a reusable OpenRouter provider instance.
export const openrouter = createOpenRouter({
  // Read the secret API key from the server environment.
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Define the default AI model used by the chatbot.
export const chatModel = openrouter("openai/gpt-4o-mini");
