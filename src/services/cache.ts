import { Database } from "bun:sqlite"
import { ZodSchema } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { CryptoHasher } from "bun"

export class Cache {
  private db: Database
  private hasher: CryptoHasher

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
