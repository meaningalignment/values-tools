import { ZodSchema } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

class PromptCache {
  private db: any
  private isBun: boolean

  constructor(path: string = "cache.sqlite") {
    this.isBun = typeof Bun !== "undefined"
    if (this.isBun) {
      const { Database } = require("bun:sqlite")
      this.db = new Database(path)
      this.db.run(
        "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT)"
      )
    }
  }

  private genCacheKey(data: any): string {
    if (!this.isBun) return ""
    return Bun.hash(JSON.stringify(data)).toString(16)
  }

  private setCache(key: string, value: any): void {
    if (!this.isBun) return
    this.db.run("INSERT OR REPLACE INTO cache (key, value) VALUES (?, ?)", [
      key,
      JSON.stringify(value),
    ])
  }

  private getCache(key: string): any | undefined {
    if (!this.isBun) return undefined
    const row = this.db
      .query("SELECT value FROM cache WHERE key = ?")
      .get(key) as { value: string } | undefined
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
  }): any | undefined {
    if (!this.isBun) return undefined
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
  }): void {
    if (!this.isBun) return
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
  }): string | undefined {
    if (!this.isBun) return undefined
    const key = this.genCacheKey({ prompt, userMessage, model, temperature })
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
  }): void {
    if (!this.isBun) return
    const key = this.genCacheKey({ prompt, userMessage, model, temperature })
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
  }): any | undefined {
    if (!this.isBun) return undefined
    const key = this.genCacheKey({ messages, model, temperature })
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
    value: any
  }): void {
    if (!this.isBun) return
    const key = this.genCacheKey({ messages, model, temperature })
    this.setCache(key, value)
  }
}

export { PromptCache }
