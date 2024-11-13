import { openai } from "@ai-sdk/openai"
import { embed, embedMany } from "ai"
import { Value } from "../types"

type Embedding = number[] & { length: 1536 }

/**
 * Generates an embedding for a single value object.
 * @param {Value} value - The value object to embed.
 * @returns {Promise<Embedding>} A promise that resolves to an array of numbers representing the embedding.
 */
export async function embedValue(value: Value): Promise<Embedding> {
  return embedText(value.policies.sort().join("\n"))
}

/**
 * Generates an embedding for a single string value.
 * @param {string} text - The string to embed.
 * @returns {Promise<Embedding>} A promise that resolves to an array of numbers representing the embedding.
 */
export async function embedText(text: string): Promise<Embedding> {
  const result = await embed({
    model: openai.embedding("text-embedding-3-large", { dimensions: 1536 }),
    value: text,
  })

  return result.embedding as Embedding
}

/**
 * Generates embeddings for multiple string values.
 * @param {string[]} texts - An array of strings to embed.
 * @returns {Promise<Embedding[]>} A promise that resolves to an array of embedding arrays.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const result = await embedMany({
    model: openai.embedding("text-embedding-3-large", { dimensions: 1536 }),
    values: texts,
  })

  return result.embeddings as Embedding[]
}
