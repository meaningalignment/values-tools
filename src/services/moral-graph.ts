import { MoralGraphEdge, MoralGraph, MoralGraphValue, Edge } from "../types"

/**
 * Calculates the entropy of a set of responses.
 * @param responseCounts - An object containing response counts.
 * @returns The calculated entropy value.
 */
function calculateEntropy(responseCounts: Record<string, number>): number {
  const total = Object.values(responseCounts).reduce((acc, val) => acc + val, 0)
  let entropy = 0

  for (const count of Object.values(responseCounts)) {
    const probability = count / total
    if (probability > 0) {
      entropy -= probability * Math.log2(probability)
    }
  }

  return entropy
}

type NodeId = number
type PageRank = Record<NodeId, number>

/**
 * Initializes the PageRank for a set of nodes.
 * @param nodes - An array of node IDs.
 * @returns An object with initial PageRank values for each node.
 */
function initializePageRank(nodes: NodeId[]): PageRank {
  const rank: PageRank = {}
  nodes.forEach((node) => (rank[node] = 1 / nodes.length))
  return rank
}

/**
 * Calculates the weighted PageRank for a set of edges.
 * @param edges - An array of MoralGraphEdge objects.
 * @param dampingFactor - The damping factor for PageRank calculation (default: 0.85).
 * @param iterations - The number of iterations for PageRank calculation (default: 100).
 * @returns An object with calculated PageRank values for each node.
 */
export function calculatePageRank(
  edges: MoralGraphEdge[],
  dampingFactor = 0.85,
  iterations = 100
): PageRank {
  const nodes = Array.from(
    new Set(edges.flatMap((edge) => [edge.sourceValueId, edge.wiserValueId]))
  )
  let pageRank = initializePageRank(nodes)

  for (let i = 0; i < iterations; i++) {
    const newRank: PageRank = {}
    nodes.forEach(
      (node) => (newRank[node] = (1 - dampingFactor) / nodes.length)
    )

    edges.forEach((edge) => {
      const outgoingEdges = edges.filter(
        (e) => e.sourceValueId === edge.sourceValueId
      )
      const totalWeight = outgoingEdges.reduce(
        (sum, e) => sum + e.summary.wiserLikelihood,
        0
      )
      if (totalWeight > 0) {
        newRank[edge.wiserValueId] +=
          (dampingFactor *
            pageRank[edge.sourceValueId] *
            edge.summary.wiserLikelihood) /
          totalWeight
      }
    })

    pageRank = newRank
  }

  return pageRank
}

export const usPoliticalAffiliationSummarizer = (
  demographics: {
    usPoliticalAffiliation?: string | null
  }[]
) => {
  const usPoliticalAffiliationCounts = demographics
    .map((d) => d.usPoliticalAffiliation)
    .filter((affiliation): affiliation is string => !!affiliation)
    .reduce((counts, affiliation) => {
      counts[affiliation] = (counts[affiliation] || 0) + 1
      return counts
    }, {} as Record<string, number>)

  // Only consider Democrat/Republican for main affiliation
  const mainUsPoliticalAffiliation = Object.entries(
    usPoliticalAffiliationCounts
  )
    .filter(
      ([affiliation]) =>
        affiliation === "Democrat" || affiliation === "Republican"
    )
    .sort(([, a], [, b]) => b - a)[0]?.[0]

  return {
    mainUsPoliticalAffiliation,
    usPoliticalAffiliationCounts, // Keep all affiliations in the counts
  }
}

type Key = `${number},${number}`

class PairMap {
  private data: Map<Key, RawEdgeCount> = new Map()
  all(): RawEdgeCount[] {
    return Array.from(this.data.values())
  }
  get(a: number, b: number): RawEdgeCount {
    if (!this.data.has(`${a},${b}`)) {
      this.data.set(`${a},${b}`, {
        sourceValueId: a,
        wiserValueId: b,
        contexts: [],
        demographics: [],
        counts: {
          markedWiser: 0,
          markedNotWiser: 0,
          markedLessWise: 0,
          markedUnsure: 0,
          impressions: 0,
        },
      })
    }
    return this.data.get(`${a},${b}`)!
  }
}

type RawEdgeCount = Omit<MoralGraph["edges"][0], "summary"> & {
  demographics: any[]
}

type DemographicsSummarizer = (demographics: any[]) => any

/**
 * Options for summarizing the moral graph.
 */
export interface Options {
  includeAllEdges?: boolean
  includePageRank?: boolean
  includeContexts?: boolean
  markedWiserThreshold?: number
  includeDemographics?: boolean
  demographicsSummarizer?: DemographicsSummarizer
}

/**
 * Summarizes the moral graph based on values and edges.
 * @param values - An array of MoralGraphValue objects.
 * @param edges - An array of Edge objects with a type property.
 * @param options - Options for customizing the summary (optional).
 * @returns A Promise that resolves to a MoralGraph object.
 */
export async function summarizeGraph(
  values: MoralGraphValue[],
  edges: (Edge & {
    type: "upgrade" | "no_upgrade" | "not_sure"
    demographics?: any
  })[],
  options: Options = {}
): Promise<MoralGraph> {
  const pairs = new PairMap()

  for (const edge of edges) {
    const existing = pairs.get(edge.fromId, edge.toId)
    existing.contexts.push(edge.contextId)
    existing.counts.impressions++
    if (edge.type === "upgrade") existing.counts.markedWiser++
    if (edge.type === "no_upgrade") existing.counts.markedNotWiser++
    if (edge.type === "not_sure") existing.counts.markedUnsure++
    if (edge.demographics) existing.demographics.push(edge.demographics)
  }

  // Do the opposite.
  for (const edge of edges) {
    const existing = pairs.get(edge.toId, edge.fromId)
    existing.contexts.push(edge.contextId)
    existing.counts.impressions++
    if (edge.type === "upgrade") existing.counts.markedLessWise++
  }

  // Cook them down.
  const cookedEdges = pairs.all().map((edge) => {
    const contexts = Array.from(new Set(edge.contexts))
    const total =
      edge.counts.markedWiser +
      edge.counts.markedNotWiser +
      edge.counts.markedUnsure +
      edge.counts.markedLessWise
    const wiserLikelihood =
      (edge.counts.markedWiser - edge.counts.markedLessWise) / total
    const entropy = calculateEntropy(edge.counts)

    const summary: any = { wiserLikelihood, entropy }

    // Add demographics summary if requested
    if (options.includeDemographics) {
      if (options.demographicsSummarizer) {
        summary.demographics = options.demographicsSummarizer(edge.demographics)
      } else {
        summary.demographics = edge.demographics
      }
    }

    return { ...edge, contexts, summary }
  })

  // Eliminate edges with low wiserLikelihood, low signal, or no consensus.
  const trimmedEdges = cookedEdges.filter((edge) => {
    if (!edge.counts.markedWiser) return false
    if (edge.summary.wiserLikelihood < 0.33) return false
    if (edge.summary.entropy > 1.69) return false
    if (edge.counts.markedWiser < (options.markedWiserThreshold ?? 2))
      return false
    return true
  })

  const referencedNodeIds = new Set<number>()
  for (const link of trimmedEdges) {
    referencedNodeIds.add(link.sourceValueId)
    referencedNodeIds.add(link.wiserValueId)
  }

  const extra: any = {}
  if (options.includeAllEdges) {
    extra["allEdges"] = cookedEdges
  }

  if (options.includeContexts) {
    values.forEach((node: MoralGraphValue & { contexts?: Set<string> }) => {
      node.contexts = new Set<string>()
      trimmedEdges.forEach((edge) => {
        if (edge.wiserValueId === node.id) {
          edge.contexts.forEach((context) => node.contexts!.add(context))
        }
      })
    })
  }

  if (options.includePageRank) {
    const pageRank = calculatePageRank(trimmedEdges)

    for (const node of values) {
      node.pageRank = pageRank[node.id]
    }
  }

  return {
    values: values.filter((n) => referencedNodeIds.has(n.id)),
    edges: trimmedEdges,
    ...extra,
  }
}
