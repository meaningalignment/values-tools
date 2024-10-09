import { embedMany, generateObject, generateText, type CoreMessage } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"
import { z, ZodSchema } from "zod"
import { Cache } from "./cache"
import { embed } from "ai"

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

export async function genObj<T extends ZodSchema>({
  prompt,
  data,
  schema,
  model = "claude-3-5-sonnet-20240620",
  temperature = 0,
  cache,
}: {
  prompt: string
  data: Record<string, any>
  schema: T
  temperature?: number
  model?: string
  cache?: Cache
}): Promise<z.infer<T>> {
  const renderedData = Object.entries(data)
    .map(([key, value]) => `# ${key}\n\n${stringify(value)}`)
    .join("\n\n")

  if (cache) {
    const cached = cache.getObj({
      prompt,
      data: renderedData,
      schema,
      model,
      temperature,
    })
    if (cached) {
      console.log("Cache hit!")
      return cached
    }
  }

  const { object } = await generateObject({
    model: getLanguageModel(model),
    schema,
    system: prompt,
    messages: [{ role: "user", content: renderedData }],
    temperature,
    mode: "auto",
  })

  if (cache) {
    cache.setObj({
      prompt,
      data: renderedData,
      schema,
      model,
      temperature,
      value: object,
    })
  }

  return object
}

export async function genText({
  prompt,
  userMessage,
  model = "claude-3-5-sonnet-20240620",
  temperature = 0,
  cache,
}: {
  prompt: string
  userMessage: string
  model?: string
  temperature?: number
  cache?: Cache
}): Promise<string> {
  if (cache) {
    const cached = cache.getText({
      prompt,
      userMessage,
      model,
      temperature,
    })
    if (cached) {
      console.log("Cache hit!")
      return cached
    }
  }

  const { text } = await generateText({
    model: getLanguageModel(model),
    system: prompt,
    messages: [{ role: "user", content: userMessage }],
    temperature,
  })

  if (cache) {
    cache.setText({
      prompt,
      userMessage,
      model,
      temperature,
      value: text,
    })
  }

  return text
}

export async function genTextMessages({
  messages,
  systemPrompt,
  model = "claude-3-5-sonnet-20240620",
  temperature = 0,
  cache,
}: {
  messages: CoreMessage[]
  systemPrompt?: string
  model?: string
  temperature?: number
  cache?: Cache
}): Promise<string> {
  if (cache) {
    const cached = cache.getMessages({
      messages,
      model,
      temperature,
    })
    if (cached) {
      console.log("Cache hit!")
      return cached
    }
  }

  const { text } = await generateText({
    model: anthropic(model),
    system: systemPrompt,
    messages,
    temperature,
  })

  if (cache) {
    cache.setMessages({
      messages,
      model,
      temperature,
      value: text,
    })
  }

  return text
}

export async function embedOne(value: string): Promise<number[]> {
  const result = await embed({
    model: openai.embedding("text-embedding-3-large", { dimensions: 1536 }),
    value,
  })

  return result.embedding
}

export async function embedSeveral(values: string[]): Promise<number[][]> {
  const result = await embedMany({
    model: openai.embedding("text-embedding-3-large", { dimensions: 1536 }),
    values,
  })

  return result.embeddings
}
