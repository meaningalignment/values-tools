/// A value represented by a set of attention policies.
export type Value = {
  id: number
  policies: string[]
  title?: string
  description?: string
  embedding?: number[]
}

/// An edge between two values.
export type Edge = {
  fromId: number
  toId: number
  contextId: string
}

/// A moral graph.
export interface MoralGraph {
  values: MoralGraphValue[]
  edges: MoralGraphEdge[]
}

export interface MoralGraphValue extends Value {
  pageRank?: number
}

export interface MoralGraphEdge {
  sourceValueId: number
  wiserValueId: number
  contexts: string[]
  counts: {
    markedWiser: number
    markedNotWiser: number
    markedLessWise: number
    markedUnsure: number
    impressions: number
  }
  summary: {
    wiserLikelihood: number
    entropy: number
  }
}

export interface Upgrade {
  a_id: number
  b_id: number
  a_was_really_about: string
  clarification: string
  mapping: {
    a: string
    rationale: string
  }[]
  story: string
  likelihood_score: string
}