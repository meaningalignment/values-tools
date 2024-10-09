import { Database } from "bun:sqlite"
import { ZodSchema } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { CryptoHasher } from "bun"

/**
 * A cache service for storing and retrieving generated results with a SQLite database.
 */
export class Cache {
  private db: Database
  private hasher: CryptoHasher

  /**
   * Creates a new cache instance.
   * @param {string} path - The path to the SQLite database file.
   */
  constructor(path: string = "cache.sqlite") {
    this.db = new Database(path, { create: true })
    this.hasher = new Bun.CryptoHasher("md5")
    this.initializeDatabase()
  }

  private initializeDatabase() {
    this.db
      .query(
        "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT)"
      )
      .run()
  }

  private genCacheKey(data: any): string {
    return this.hasher.update(JSON.stringify(data)).digest("hex")
  }

  private setCache(key: string, value: any) {
    this.db
      .query("INSERT OR REPLACE INTO cache (key, value) VALUES ($key, $value)")
      .run({
        $key: key,
        $value: JSON.stringify(value),
      })
  }

  private getCache(key: string) {
    const row = this.db
      .query("SELECT * FROM cache WHERE key = $key")
      .get({ $key: key }) as { key: string; value: string } | undefined
    return row ? JSON.parse(row.value) : undefined
  }

  /**
   * Retrieves a cached object based on the provided parameters.
   * @param {Object} params - The parameters for retrieving the cached object.
   * @param {string} params.prompt - The prompt used for generating the object.
   * @param {string} params.data - The data associated with the object.
   * @param {ZodSchema} params.schema - The Zod schema for validating the object.
   * @param {string} params.model - The model used for generating the object.
   * @param {number} params.temperature - The temperature setting used for generation.
   * @returns {any | undefined} The cached object if found, otherwise undefined.
   */
  getObj({
    prompt,
    data,
    schema,
    model,
    temperature,
  }: {
    prompt: string
    data: string
    schema: ZodSchema
    model: string
    temperature: number
  }) {
    const jsonSchema = zodToJsonSchema(schema)
    const key = this.genCacheKey({
      prompt,
      data,
      schema: jsonSchema,
      model,
      temperature,
    })
    return this.getCache(key)
  }

  /**
   * Stores an object in the cache based on the provided parameters.
   * @param {Object} params - The parameters for storing the object.
   * @param {string} params.prompt - The prompt used for generating the object.
   * @param {string} params.data - The data associated with the object.
   * @param {ZodSchema} params.schema - The Zod schema for validating the object.
   * @param {string} params.model - The model used for generating the object.
   * @param {number} params.temperature - The temperature setting used for generation.
   * @param {any} params.value - The object to be stored in the cache.
   */
  setObj({
    prompt,
    data,
    schema,
    model,
    temperature,
    value,
  }: {
    prompt: string
    data: string
    schema: ZodSchema
    model: string
    temperature: number
    value: any
  }) {
    const jsonSchema = zodToJsonSchema(schema)
    const key = this.genCacheKey({
      prompt,
      data,
      schema: jsonSchema,
      model,
      temperature,
    })
    this.setCache(key, value)
  }

  /**
   * Retrieves cached text based on the provided parameters.
   * @param {Object} params - The parameters for retrieving the cached text.
   * @param {string} params.prompt - The prompt used for generating the text.
   * @param {string} params.userMessage - The user message associated with the text.
   * @param {string} params.model - The model used for generating the text.
   * @param {number} params.temperature - The temperature setting used for generation.
   * @returns {string | undefined} The cached text if found, otherwise undefined.
   */
  getText({
    prompt,
    userMessage,
    model,
    temperature,
  }: {
    prompt: string
    userMessage: string
    model: string
    temperature: number
  }) {
    const key = this.genCacheKey({
      prompt,
      userMessage,
      model,
      temperature,
    })
    return this.getCache(key)
  }

  /**
   * Stores text in the cache based on the provided parameters.
   * @param {Object} params - The parameters for storing the text.
   * @param {string} params.prompt - The prompt used for generating the text.
   * @param {string} params.userMessage - The user message associated with the text.
   * @param {string} params.model - The model used for generating the text.
   * @param {number} params.temperature - The temperature setting used for generation.
   * @param {string} params.value - The text to be stored in the cache.
   */
  setText({
    prompt,
    userMessage,
    model,
    temperature,
    value,
  }: {
    prompt: string
    userMessage: string
    model: string
    temperature: number
    value: string
  }) {
    const key = this.genCacheKey({
      prompt,
      userMessage,
      model,
      temperature,
    })
    this.setCache(key, value)
  }

  /**
   * Retrieves cached messages based on the provided parameters.
   * @param {Object} params - The parameters for retrieving the cached messages.
   * @param {Array<{content: string | any}>} params.messages - The messages used for generation.
   * @param {string} params.model - The model used for generating the messages.
   * @param {number} params.temperature - The temperature setting used for generation.
   * @returns {any | undefined} The cached messages if found, otherwise undefined.
   */
  getMessages({
    messages,
    model,
    temperature,
  }: {
    messages: { content: string | any }[]
    model: string
    temperature: number
  }) {
    const key = this.genCacheKey({
      messages,
      model,
      temperature,
    })
    return this.getCache(key)
  }

  /**
   * Stores messages in the cache based on the provided parameters.
   * @param {Object} params - The parameters for storing the messages.
   * @param {Array<{content: string | any}>} params.messages - The messages used for generation.
   * @param {string} params.model - The model used for generating the messages.
   * @param {number} params.temperature - The temperature setting used for generation.
   * @param {string} params.value - The messages to be stored in the cache.
   */
  setMessages({
    messages,
    model,
    temperature,
    value,
  }: {
    messages: { content: string | any }[]
    model: string
    temperature: number
    value: string
  }) {
    const key = this.genCacheKey({
      messages,
      model,
      temperature,
    })
    this.setCache(key, value)
  }
}
