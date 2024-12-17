import { DBSCAN } from "density-clustering"
import { genObj } from "./ai"
import { embedTexts, embedValue } from "./embedding"
import { cosineDistance } from "../utils"
import { z } from "zod"
import {
  deduplicateContextsPrompt,
  deduplicateValuesPrompt,
  bestValuesCardPrompt,
  findExistingDuplicateContextPrompt,
  findExistingDuplicateValuePrompt,
} from "../prompts"
import { Value } from "../types"

/**
 * Clusters an array of values using DBSCAN.
 * @param values - An array of Value objects to cluster.
 * @param neighborhoodRadius - The neighborhood radius for DBSCAN clustering (default: 0.3).
 * @param minPointsPerCluster - The minimum number of points per cluster (default: 5).
 * @param distanceFunction - The distance function to use for clustering (default: cosineDistance).
 * @returns A Promise that resolves to an array of arrays, where each inner array represents a cluster of similar values.
 */
export async function clusterValues<V extends Value>(
  values: V[],
  neighborhoodRadius: number = 0.3,
  minPointsPerCluster: number = 5,
  distanceFunction: (p: number[], q: number[]) => number = cosineDistance
): Promise<V[][]> {
  const embeddings = await Promise.all(
    values.map((value) => {
      if (value.embedding) {
        return value.embedding
      }

      return embedValue(value)
    })
  )
  const dbscan = new DBSCAN()
  const dbscanClusters = dbscan
    .run(embeddings, neighborhoodRadius, minPointsPerCluster, distanceFunction)
    .map((cluster: number[]) => cluster.map((i) => values[i])) as V[][]

  const clusteredValues = new Set(dbscanClusters.flat().map((v) => v.id))
  const unclusteredValues = values.filter((v) => !clusteredValues.has(v.id))
  if (unclusteredValues.length > 0) {
    dbscanClusters.push(unclusteredValues)
  }

  return dbscanClusters
}

/**
 * Clusters an array of context strings using DBSCAN.
 * @param contexts - An array of context strings to cluster.
 * @param neighborhoodRadius - The neighborhood radius for DBSCAN clustering (default: 0.3).
 * @param minPointsPerCluster - The minimum number of points per cluster (default: 5).
 * @param distanceFunction - The distance function to use for clustering (default: cosineDistance).
 * @returns A Promise that resolves to an array of arrays, where each inner array represents a cluster of similar context strings.
 */
export async function clusterContexts(
  contexts: string[],
  neighborhoodRadius: number = 0.3,
  minPointsPerCluster: number = 5,
  distanceFunction: (p: number[], q: number[]) => number = cosineDistance
): Promise<string[][]> {
  const uniqueContexts = Array.from(new Set(contexts))
  const embeddings = await embedTexts(uniqueContexts)

  const dbscan = new DBSCAN()
  const dbscanClusters = dbscan
    .run(embeddings, neighborhoodRadius, minPointsPerCluster, distanceFunction)
    .map((cluster: any) => cluster.map((i: any) => uniqueContexts[i]))

  const clusteredValues = new Set(dbscanClusters.flat())
  const unclusteredValues = uniqueContexts.filter(
    (value) => !clusteredValues.has(value)
  )

  if (unclusteredValues.length > 0) {
    dbscanClusters.push(unclusteredValues)
  }

  return dbscanClusters
}

/**
 * Finds an existing duplicate value from a list of candidates using an AI prompt.
 * @param value - The value to find a duplicate for.
 * @param candidates - An array of candidate values to compare against.
 * @returns A Promise that resolves to the duplicate Value if found, or null if no duplicate is found.
 */
export async function getExistingDuplicateValue<
  V extends Value,
  C extends Value
>(value: V, candidates: C[]): Promise<C | null> {
  try {
    const result = await genObj({
      prompt: findExistingDuplicateValuePrompt,
      data: { value: { id: value.id, policies: value.policies }, candidates },
      schema: z.object({ duplicateId: z.number().nullable() }),
    })
    return result.duplicateId === null ? null : candidates[result.duplicateId]
  } catch (error) {
    console.error("Error:", error)
    return null
  }
}

/**
 * Finds an existing duplicate context from a list of candidates using an AI prompt.
 * @param context - The context string to find a duplicate for.
 * @param candidates - An array of candidate context strings to compare against.
 * @returns A Promise that resolves to the duplicate context string if found, or null if no duplicate is found.
 */
export async function getExistingDuplicateContext(
  context: string,
  candidates: string[]
): Promise<string | null> {
  const result = await genObj({
    prompt: findExistingDuplicateContextPrompt,
    data: { context, candidates },
    schema: z.object({ duplicate: z.string().nullable() }),
  })

  if (result.duplicate && candidates.includes(result.duplicate)) {
    return result.duplicate
  }

  return null
}

/**
 * Deduplicates an array of values, optionally considering a context.
 * @param values - An array of Value objects to deduplicate.
 * @param context - An optional string representing the context to consider during deduplication.
 * @param useDbScan - A boolean flag to determine whether to use DBSCAN clustering (default: false).
 * @returns A Promise that resolves to an array of arrays, where each inner array represents a cluster of similar values.
 */
export async function deduplicateValues<V extends Value>(
  values: V[],
  context?: string | null,
  useDbScan = false
): Promise<V[][]> {
  if (values.length === 1) {
    return [[values[0]]]
  }

  //
  // Functions
  //

  async function dedupeValuesWithPrompt(cluster: V[]): Promise<V[][]> {
    try {
      const data: { values: typeof cluster; context?: string } = {
        values: cluster,
      }
      if (context) {
        data.context = context
      }

      const result = await genObj({
        prompt: deduplicateValuesPrompt,
        data,
        schema: z.object({
          clusters: z
            .array(
              z.object({
                motivation: z
                  .string()
                  .describe(
                    "A short motivation text for *why* the values in this cluster are all about the same source of meaning. Should not be longer than a short sentence or two."
                  ),
                values: z
                  .array(z.number().int())
                  .describe(
                    "A list of ids referring to values that all are about the same source of meaning."
                  ),
              })
            )
            .describe(
              "A list of value clusters, each with a motivation and a list of value ids."
            ),
        }),
      })

      return result.clusters.map((cluster) =>
        cluster.values.map((id) => values.find((v) => v.id === id)!)
      )
    } catch (error) {
      console.error("Error in dedupeValuesWithPrompt:", error)
      return [cluster]
    }
  }

  function processValueClusters(dbscanClusters: V[][]): Promise<V[][]>[] {
    return dbscanClusters.map(dedupeValuesWithPrompt)
  }

  function ensureAllValuesExist(
    dedupedValues: V[][],
    originalValues: V[]
  ): V[][] {
    const allValueIds = new Set(dedupedValues.flat().map((v) => v.id))
    for (const value of originalValues) {
      if (!allValueIds.has(value.id)) {
        dedupedValues.push([value])
      }
    }
    return dedupedValues
  }

  //
  // Deduplication process
  //

  // 1. Cluster values using DBSCAN, if enabled
  let clusters: V[][]
  if (useDbScan) {
    clusters = await clusterValues(values)
  } else {
    clusters = [values]
  }

  // 2. Further deduplicate values with a prompt, for each cluster
  const dedupedValuesPromises = processValueClusters(clusters)

  // 3. Ensure all values exist in the final list
  const dedupedValues = (await Promise.all(dedupedValuesPromises)).flat()
  return ensureAllValuesExist(dedupedValues, values)
}

/**
 * Deduplicates an array of context strings.
 * @param contexts - An array of context strings to deduplicate.
 * @param useDbScan - A boolean flag to determine whether to use DBSCAN clustering (default: false).
 * @returns A Promise that resolves to an array of Promises, each resolving to a Map of deduplicated contexts.
 */
export async function deduplicateContexts(
  contexts: string[],
  useDbScan = false
): Promise<string[][]> {
  //
  // Functions.
  //

  async function dedupeContextsWithPrompt(
    contexts: string[]
  ): Promise<string[][]> {
    const result = await genObj({
      prompt: deduplicateContextsPrompt,
      data: { terms: contexts },
      schema: z.object({
        synonymGroups: z
          .array(z.array(z.string()))
          .describe(
            "A list of synonym groups, where each term in the group is a synonym of every other term. Combined, the terms in all the groups should contain all terms that were provided."
          ),
      }),
    })

    return result.synonymGroups
  }

  function processContextClusters(
    dbScanClusters: string[][]
  ): Promise<string[][]>[] {
    return dbScanClusters.map(dedupeContextsWithPrompt)
  }

  function ensureAllContextsExist(
    dedupedContexts: string[][],
    uniqueContexts: string[]
  ): string[][] {
    const allContexts = new Set(dedupedContexts.flat())
    const missingContexts = uniqueContexts.filter(
      (context) => !allContexts.has(context)
    )
    return [...dedupedContexts, ...missingContexts.map((context) => [context])]
  }

  //
  // Deduplication process.
  //

  // 1. Cluster contexts using DBSCAN, if enabled. If we are dealing with a large number of contexts, this can help to reduce the input tokens to the AI model.
  let clusters: string[][]

  if (useDbScan) {
    clusters = await clusterContexts(contexts)
  } else {
    clusters = [contexts]
  }

  // 2. Further deduplicate contexts with a prompt, for each cluster.
  const dedupedContextsPromises = processContextClusters(clusters)

  // 3. Combine results and ensure all contexts exist
  const dedupedContexts = (await Promise.all(dedupedContextsPromises)).flat()
  return ensureAllContextsExist(dedupedContexts, contexts)
}

/**
 * Selects a representative value from an array of Value objects.
 *
 * This function uses an AI prompt to determine the best representative value
 * from a given array of values. If the input array contains only one value,
 * that value is returned immediately.
 *
 * @param values - An array of Value objects to choose from.
 * @returns A Promise that resolves to the selected representative Value object.
 * @throws Will throw an error if the AI prompt fails or if no matching value is found.
 */
export async function getRepresentativeValue<V extends Value>(
  values: V[]
): Promise<V> {
  if (values.length === 1) {
    return values[0]
  }

  const response = await genObj({
    prompt: bestValuesCardPrompt,
    data: { values: values.map((v) => ({ id: v.id, policies: v.policies })) },
    schema: z.object({ best_values_card_id: z.number() }),
  })

  return values.find((v) => v.id === response.best_values_card_id)!
}
