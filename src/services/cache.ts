import { ZodSchema } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

interface DatabaseLike {
  query(sql: string): {
    run(params?: any): Promise<void>
    get(params?: any): Promise<any>
  }
}

interface HasherLike {
  update(data: string): HasherLike
  digest(encoding: "hex"): string
}

let Database: new (path: string, options?: any) => DatabaseLike
let Hasher: new (algorithm: string) => HasherLike

if (typeof Bun !== "undefined") {
  // Running in Bun
  import("bun:sqlite").then((bunSqlite) => {
    Database = class BunDatabase implements DatabaseLike {
      private db: any
      constructor(path: string, options?: any) {
        this.db = new bunSqlite.Database(path, options)
      }
      query(sql: string) {
        return {
          run: (params?: any): Promise<void> => {
            return Promise.resolve(this.db.query(sql, params))
          },
          get: (params?: any): Promise<any> => {
            return Promise.resolve(this.db.query(sql, params).get())
          },
        }
      }
    }
  })
  import("bun").then((bun) => {
    Hasher = bun.CryptoHasher
  })
} else {
  // Running in Node.js
  import("sqlite3").then((sqlite3) => {
    import("crypto").then((crypto) => {
      Database = class NodeDatabase implements DatabaseLike {
        private db: any
        constructor(path: string, options?: any) {
          this.db = new sqlite3.Database(path, options)
        }
        query(sql: string) {
          return {
            run: (params?: any): Promise<void> => {
              return new Promise((resolve, reject) => {
                this.db.run(sql, params, function (err: Error | null) {
                  if (err) reject(err)
                  else resolve()
                })
              })
            },
            get: (params?: any): Promise<any> => {
              return new Promise((resolve, reject) => {
                this.db.get(sql, params, (err: Error | null, row: any) => {
                  if (err) reject(err)
                  else resolve(row)
                })
              })
            },
          }
        }
      }

      Hasher = class NodeHasher implements HasherLike {
        private hasher: any
        constructor(algorithm: string) {
          this.hasher = crypto.createHash(algorithm)
        }
        update(data: string): HasherLike {
          this.hasher.update(data)
          return this
        }
        digest(encoding: "hex"): string {
          return this.hasher.digest(encoding)
        }
      }
    })
  })
}

/**
 * A cache service for storing and retrieving generated results with a SQLite database.
 * This class is designed to work in both Bun and Node.js environments.
 */
export class Cache {
  private db: DatabaseLike
  private hasher: HasherLike

  /**
   * Creates a new cache instance.
   * @param {string} path - The path to the SQLite database file.
   */
  constructor(path: string = "cache.sqlite") {
    this.db = new Database(path, { create: true })
    this.hasher = new Hasher("md5")
    this.initializeDatabase()
  }

  /**
   * Initializes the database by creating the cache table if it doesn't exist.
   * @private
   */
  private async initializeDatabase(): Promise<void> {
    await this.db
      .query(
        "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT)"
      )
      .run()
  }

  /**
   * Generates a cache key based on the provided data.
   * @private
   * @param {any} data - The data to generate the key from.
   * @returns {string} The generated cache key.
   */
  private genCacheKey(data: any): string {
    return this.hasher.update(JSON.stringify(data)).digest("hex")
  }

  /**
   * Sets a value in the cache.
   * @private
   * @param {string} key - The cache key.
   * @param {any} value - The value to store.
   */
  private async setCache(key: string, value: any): Promise<void> {
    await this.db
      .query("INSERT OR REPLACE INTO cache (key, value) VALUES ($key, $value)")
      .run({
        $key: key,
        $value: JSON.stringify(value),
      })
  }

  /**
   * Retrieves a value from the cache.
   * @private
   * @param {string} key - The cache key.
   * @returns {Promise<any | undefined>} The cached value if found, otherwise undefined.
   */
  private async getCache(key: string): Promise<any | undefined> {
    const row = (await this.db
      .query("SELECT * FROM cache WHERE key = $key")
      .get({ $key: key })) as { key: string; value: string } | undefined
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
   * @returns {Promise<any | undefined>} The cached object if found, otherwise undefined.
   */
  async getObj({
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
  }): Promise<any | undefined> {
    const jsonSchema = zodToJsonSchema(schema)
    const key = this.genCacheKey({
      prompt,
      data,
      schema: jsonSchema,
      model,
      temperature,
    })
    return await this.getCache(key)
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
  async setObj({
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
  }): Promise<void> {
    const jsonSchema = zodToJsonSchema(schema)
    const key = this.genCacheKey({
      prompt,
      data,
      schema: jsonSchema,
      model,
      temperature,
    })
    await this.setCache(key, value)
  }

  /**
   * Retrieves cached text based on the provided parameters.
   * @param {Object} params - The parameters for retrieving the cached text.
   * @param {string} params.prompt - The prompt used for generating the text.
   * @param {string} params.userMessage - The user message associated with the text.
   * @param {string} params.model - The model used for generating the text.
   * @param {number} params.temperature - The temperature setting used for generation.
   * @returns {Promise<string | undefined>} The cached text if found, otherwise undefined.
   */
  async getText({
    prompt,
    userMessage,
    model,
    temperature,
  }: {
    prompt: string
    userMessage: string
    model: string
    temperature: number
  }): Promise<string | undefined> {
    const key = this.genCacheKey({
      prompt,
      userMessage,
      model,
      temperature,
    })
    return await this.getCache(key)
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
  async setText({
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
  }): Promise<void> {
    const key = this.genCacheKey({
      prompt,
      userMessage,
      model,
      temperature,
    })
    await this.setCache(key, value)
  }

  /**
   * Retrieves cached messages based on the provided parameters.
   * @param {Object} params - The parameters for retrieving the cached messages.
   * @param {Array<{content: string | any}>} params.messages - The messages used for generation.
   * @param {string} params.model - The model used for generating the messages.
   * @param {number} params.temperature - The temperature setting used for generation.
   * @returns {Promise<any | undefined>} The cached messages if found, otherwise undefined.
   */
  async getMessages({
    messages,
    model,
    temperature,
  }: {
    messages: { content: string | any }[]
    model: string
    temperature: number
  }): Promise<any | undefined> {
    const key = this.genCacheKey({
      messages,
      model,
      temperature,
    })
    return await this.getCache(key)
  }

  /**
   * Stores messages in the cache based on the provided parameters.
   * @param {Object} params - The parameters for storing the messages.
   * @param {Array<{content: string | any}>} params.messages - The messages used for generation.
   * @param {string} params.model - The model used for generating the messages.
   * @param {number} params.temperature - The temperature setting used for generation.
   * @param {any} params.value - The messages to be stored in the cache.
   */
  async setMessages({
    messages,
    model,
    temperature,
    value,
  }: {
    messages: { content: string | any }[]
    model: string
    temperature: number
    value: any
  }): Promise<void> {
    const key = this.genCacheKey({
      messages,
      model,
      temperature,
    })
    await this.setCache(key, value)
  }
}
