import { z } from "zod"
import { PromptCache } from "./services/cache"

/**
 * Configuration for the Values Tools module.
 *
 * This configuration object defines settings for the AI language model,
 * including the default model to use, the default temperature for text
 * generation, and an optional caching mechanism.
 *
 * @property {string} defaultModel - The default AI model to use (by default, "claude-3-5-sonnet-20240620").
 * @property {number} defaultTemperature - The default temperature setting for text generation (between 0 and 1).
 * @property {Cache} [cache] - An optional Cache instance for storing and retrieving generated results.
 */

export const ConfigSchema = z.object({
  defaultModel: z.string().default("claude-3-5-sonnet-20240620"),
  defaultTemperature: z.number().min(0).max(1).default(0),
  cache: z.instanceof(PromptCache).optional(),
})

export type Config = z.infer<typeof ConfigSchema>

let globalConfig: Config = ConfigSchema.parse({})

export function configureValuesTools(config: Partial<Config>) {
  globalConfig = ConfigSchema.parse({ ...globalConfig, ...config })
}

export function getValuesToolsConfig(): Config {
  return globalConfig
}
