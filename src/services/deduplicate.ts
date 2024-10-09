import { DBSCAN } from "density-clustering"
import { embedOne, embedSeveral, genObj } from "./ai"
import { cosineDistance, readMarkdownFile } from "../utils"
import { z } from "zod"

type SimpleValue = Pick<Value, "id" | "policies">

const getDedupeChoiceTypesPrompt = readMarkdownFile(
  "ai/prompts/deduplicate-choice-types.md"
)
const getDedupeValuesPrompt = readMarkdownFile(
  "ai/prompts/deduplicate-values.md"
)
const getFindExistingDuplicatePrompt = readMarkdownFile(
  "ai/prompts/find-existing-duplicate.md"
)

/**
 * Finds an existing duplicate value from a list of candidates using an AI prompt.
 * @param value - The value to find a duplicate for.
 * @param candidates - An array of candidate values to compare against.
 * @returns A Promise that resolves to the duplicate Value if found, or null if no duplicate is found.
 */
export async function findExistingDuplicateWithPrompt(
  value: Value,
  candidates: { id: number; policies: string[] }
): Promise<Value | null> {
  try {
    const prompt = await getFindExistingDuplicatePrompt
    const result = await genObj({
      prompt,
      data: { value: value as SimpleValue, candidates },
      schema: z.object({ duplicateId: z.number().nullable() }),
    })
    return result.duplicateId === null ? null : candidates[result.duplicateId]
  } catch (error) {
    console.error("Error in findExistingDuplicate:", error)
    return null
  }
}

/**
 * Deduplicates an array of values, optionally considering a choice type.
 * @param values - An array of Value objects to deduplicate.
 * @param choiceType - An optional string representing the choice type to consider during deduplication.
 * @returns A Promise that resolves to an array of arrays, where each inner array represents a cluster of similar values.
 */
export async function deduplicateValues(
  values: Value[],
  choiceType?: string
): Promise<Value[][]> {
  if (values.length === 1) {
    return [[values[0]]]
  }

  //
  // Cluster the values with a prompt.
  //
  let valueClusters = []
  try {
    const prompt = await getDedupeValuesPrompt

    // Include the choice type in the prompt if it is provided.
    const data: { values: typeof values; choiceType?: string } = { values }
    if (choiceType) {
      data.choiceType = choiceType
    }

    const result = await genObj({
      prompt,
      data,
      schema: z.object({
        clusters: z
          .array(
            z.array(
              z
                .number()
                .int()
                .min(0)
                .max(values.length - 1)
            )
          )
          .describe(
            "A list of value clusters, where each cluster is a list of ids referring to values that all are about the same source of meaning."
          ),
      }),
    })

    valueClusters = result.clusters.map((cluster) =>
      cluster.map((index) => values[index])
    )
  } catch (error) {
    console.error("Error in genDeduplicatePolicies:", error)
    return [values]
  }

  // Include any value that was not clustered as its own cluster.
  const allValueIds = new Set(valueClusters.flat().map((v) => v.id))
  for (let i = 0; i < values.length; i++) {
    if (!allValueIds.has(values[i].id)) {
      valueClusters.push([values[i]])
    }
  }

  // Return the clustered values.
  return valueClusters
}

/**
 * Deduplicates an array of choice type strings.
 * @param strings - An array of choice type strings to deduplicate.
 * @param useDbscan - A boolean flag to determine whether to use DBSCAN clustering (default: true).
 * @returns A Promise that resolves to an array of Promises, each resolving to a Map of deduplicated choice types.
 */
export async function deduplicateChoiceTypes(
  strings: string[],
  useDbscan = true
): Promise<Promise<Map<string, string[]>>[]> {
  //
  // Functions.
  //

  async function dedupeChoiceTypesWithPrompt(
    choiceTypes: string[]
  ): Promise<string[][]> {
    const prompt = await getDedupeChoiceTypesPrompt
    const result = await genObj({
      prompt,
      data: { terms: choiceTypes },
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

  function processChoiceTypeClusters(
    dbscanClusters: string[][]
  ): Promise<Map<string, string[]>>[] {
    const dedupedChoiceTypesPromises: Promise<Map<string, string[]>>[] = []

    for (const cluster of dbscanClusters) {
      const clusterPromise = dedupeChoiceTypesWithPrompt(cluster).then(
        (deduplicatedCluster) => {
          const clusterMap = new Map<string, string[]>()
          for (const group of deduplicatedCluster) {
            const representative = group[group.length - 1]
            clusterMap.set(representative, group)
          }
          return clusterMap
        }
      )

      dedupedChoiceTypesPromises.push(clusterPromise)
    }

    return dedupedChoiceTypesPromises
  }

  function ensureAllChoiceTypesExist(
    dedupedChoiceTypes: Map<string, string[]>,
    uniqueChoiceTypes: string[]
  ): Map<string, string[]> {
    for (const context of uniqueChoiceTypes) {
      if (!Array.from(dedupedChoiceTypes.values()).flat().includes(context)) {
        dedupedChoiceTypes.set(context, [context])
      }
    }
    return dedupedChoiceTypes
  }

  async function clusterChoiceTypes(
    choiceTypes: string[]
  ): Promise<string[][]> {
    const uniqueChoiceTypes = Array.from(new Set(choiceTypes))
    const embeddings = await embedSeveral(uniqueChoiceTypes)

    const dbscan = new DBSCAN()
    const dbscanClusters = dbscan
      .run(embeddings, 0.3, 5, cosineDistance)
      .map((cluster) => cluster.map((i) => uniqueChoiceTypes[i]))

    const clusteredValues = new Set(dbscanClusters.flat())
    const unclusteredValues = uniqueChoiceTypes.filter(
      (value) => !clusteredValues.has(value)
    )

    if (unclusteredValues.length > 0) {
      dbscanClusters.push(unclusteredValues)
    }

    return dbscanClusters
  }

  //
  // Deduplication process.
  //

  // 1. Cluster choice types using DBSCAN, if enabled. If we are dealing with a large number of choice types, this can help to reduce the input tokens to the AI model.
  let clusters = []

  if (useDbscan) {
    clusters = await clusterChoiceTypes(strings)
  } else {
    clusters = strings.map((string) => [string])
  }

  // 2. Further deduplicate choice types with a prompt, for each cluster.
  const dedupedChoiceTypesPromises = processChoiceTypeClusters(clusters)

  // 3. Ensure all contexts exist in the final list by including any missing choice types as their own cluster.
  return dedupedChoiceTypesPromises.map(async (promise) => {
    const dedupedMap = await promise
    return ensureAllChoiceTypesExist(dedupedMap, strings)
  })
}
