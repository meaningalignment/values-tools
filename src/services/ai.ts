import { embedMany, generateObject, generateText, type CoreMessage } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"
import { z, ZodSchema } from "zod"
import { embed } from "ai"
import { getValuesToolsConfig } from "../config"

function getLanguageModel(model: string) {
  if (model.startsWith("claude")) {
    return anthropic(model)
  } else if (model.startsWith("gpt") || model.startsWith("o1")) {
    return openai(model)
  } else {
    throw new Error(`Unknown model: ${model}`)
  }
}

function stringifyObj(obj: any) {
  return JSON.stringify(
    obj,
    (key, value) => {
      if (value === "" || value === undefined || value === null) {
        return undefined
      }
      return value
    },
    2
  )
}

function stringifyArray(arr: any[]) {
  return arr.map(stringifyObj).join("\n\n")
}

function stringify(value: any) {
  if (Array.isArray(value)) {
    return stringifyArray(value)
  } else if (typeof value === "string") {
    return value
  } else {
    return stringifyObj(value)
  }
}

/**
 * Generates an object based on the provided prompt, data, and schema.
 * @param {Object} options - The options for generating the object.
 * @param {string} options.prompt - The system prompt for the AI model.
 * @param {Record<string, any>} options.data - The data to be processed.
 * @param {ZodSchema} options.schema - The Zod schema for validating the generated object.
 * @param {string} [options.model] - The AI model to use (optional, defaults to config.defaultModel).
 * @param {number} [options.temperature] - The temperature for the AI generation (optional, defaults to config.defaultTemperature).
 * @param {boolean} [options.useCacheIfAvailable=true] - Whether to use cached results if available (optional).
 * @returns {Promise<z.infer<T>>} A promise that resolves to the generated object.
 */
export async function genObj<T extends ZodSchema>({
  prompt,
  data,
  schema,
  model,
  temperature,
  useCacheIfAvailable = true,
}: {
  prompt: string
  data: Record<string, any>
  schema: T
  temperature?: number
  model?: string
  useCacheIfAvailable?: boolean
}): Promise<z.infer<T>> {
  const config = getValuesToolsConfig()
  const renderedData = Object.entries(data)
    .map(([key, value]) => `# ${key}\n\n${stringify(value)}`)
    .join("\n\n")

  const finalModel = model || config.defaultModel
  const finalTemperature = temperature ?? config.defaultTemperature

  if (useCacheIfAvailable && config.cache) {
    const cached = config.cache.getObj({
      prompt,
      data: renderedData,
      schema,
      model: finalModel,
      temperature: finalTemperature,
    })
    if (cached) {
      console.log("Cache hit!")
      return cached
    }
  }

  const { object } = await generateObject({
    model: getLanguageModel(finalModel),
    schema,
    system: prompt,
    messages: [{ role: "user", content: renderedData }],
    temperature: finalTemperature,
    mode: "auto",
  })

  if (useCacheIfAvailable && config.cache) {
    config.cache.setObj({
      prompt,
      data: renderedData,
      schema,
      model: finalModel,
      temperature: finalTemperature,
      value: object,
    })
  }

  return object
}

/**
 * Generates text based on the provided prompt and user message.
 * @param {Object} options - The options for generating the text.
 * @param {string} options.prompt - The system prompt for the AI model.
 * @param {string} options.userMessage - The user's message to process.
 * @param {string} [options.model] - The AI model to use (optional, defaults to config.defaultModel).
 * @param {number} [options.temperature] - The temperature for the AI generation (optional, defaults to config.defaultTemperature).
 * @param {boolean} [options.useCacheIfAvailable=true] - Whether to use cached results if available (optional).
 * @returns {Promise<string>} A promise that resolves to the generated text.
 */
export async function genText({
  prompt,
  userMessage,
  model,
  temperature,
  useCacheIfAvailable = true,
}: {
  prompt: string
  userMessage: string
  model?: string
  temperature?: number
  useCacheIfAvailable?: boolean
}): Promise<string> {
  const config = getValuesToolsConfig()
  const finalModel = model || config.defaultModel
  const finalTemperature = temperature ?? config.defaultTemperature

  if (useCacheIfAvailable && config.cache) {
    const cached = config.cache.getText({
      prompt,
      userMessage,
      model: finalModel,
      temperature: finalTemperature,
    })
    if (cached) {
      console.log("Cache hit!")
      return cached
    }
  }

  const { text } = await generateText({
    model: getLanguageModel(finalModel),
    system: prompt,
    messages: [{ role: "user", content: userMessage }],
    temperature: finalTemperature,
  })

  if (useCacheIfAvailable && config.cache) {
    config.cache.setText({
      prompt,
      userMessage,
      model: finalModel,
      temperature: finalTemperature,
      value: text,
    })
  }

  return text
}

/**
 * Generates text based on a series of messages and an optional system prompt.
 * @param {Object} options - The options for generating the text.
 * @param {CoreMessage[]} options.messages - An array of messages to process.
 * @param {string} [options.systemPrompt] - The system prompt for the AI model (optional).
 * @param {string} [options.model] - The AI model to use (optional, defaults to config.defaultModel).
 * @param {number} [options.temperature] - The temperature for the AI generation (optional, defaults to config.defaultTemperature).
 * @param {boolean} [options.useCacheIfAvailable=true] - Whether to use cached results if available (optional).
 * @returns {Promise<string>} A promise that resolves to the generated text.
 */
export async function genTextMessages({
  messages,
  systemPrompt,
  model,
  temperature,
  useCacheIfAvailable = true,
}: {
  messages: CoreMessage[]
  systemPrompt?: string
  model?: string
  temperature?: number
  useCacheIfAvailable?: boolean
}): Promise<string> {
  const config = getValuesToolsConfig()
  const finalModel = model || config.defaultModel
  const finalTemperature = temperature ?? config.defaultTemperature

  if (useCacheIfAvailable && config.cache) {
    const cached = config.cache.getMessages({
      messages,
      model: finalModel,
      temperature: finalTemperature,
    })
    if (cached) {
      console.log("Cache hit!")
      return cached
    }
  }

  const { text } = await generateText({
    model: anthropic(finalModel),
    system: systemPrompt,
    messages,
    temperature: finalTemperature,
  })

  if (useCacheIfAvailable && config.cache) {
    config.cache.setMessages({
      messages,
      model: finalModel,
      temperature: finalTemperature,
      value: text,
    })
  }

  return text
}
