/// A value represented by a set of attention policies.
type Value = {
  id: number
  policies: string[]
  title?: string
  description?: string
  embedding?: number[]
}

/// Represents a context or a choice in which a value apply.
type ChoiceType = {
  name: string
}
