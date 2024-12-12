import { z } from "zod"
import { genObj } from "./ai"
import { generateUpgradesPrompt } from "../prompts"
import { Value } from "../types"

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

/**
 * Generates upgrade transitions between values.
 * @param {Value[]} values - Values to analyze
 * @param {string} [context] - Optional context
 * @returns {Promise<Upgrade[]>} Upgrade transitions
 */
export async function generateUpgrades(
  values: Value[],
  context?: string
): Promise<Upgrade[]> {
  const schema = z.object({
    transitions: z.array(
      z.object({
        a_id: z
          .number()
          .describe("The id of the value the person used to have."),
        b_id: z.number().describe("The id of the value they have now."),
        a_was_really_about: z
          .string()
          .describe(
            "If the new value is a 'deeper cut' at what you *really* cared about the whole time, what was it that you really cared about all along?"
          ),
        clarification: z
          .string()
          .describe(
            "What was confused or incomplete about the old value, that the new value clarifies?"
          ),
        story: z
          .string()
          .describe(
            'Tell a plausible, personal story. The story should be in first-person, "I" voice. Make up a specific, evocative experience. The experience should include a situation you were in, a series of specific emotions that came up, leading you to discover a problem with the older value, and how you discovered the new value, and an explanation of how the new values what was what you were really about the whole time. The story should also mention in what situations you think the new value is broadly applicable. The story should avoid making long lists of criteria and instead focus on the essence of the values and their difference.'
          ),
        mapping: z
          .array(
            z.object({
              a: z
                .string()
                .describe("An evaluation criterion of the old value."),
              rationale: z
                .string()
                .describe("What strategy did you use, and why is it relevant?"),
            })
          )
          .describe(
            "How do each of the evaluation criteria from the old value relate to criteria of the new one?"
          ),
        likelihood_score: z
          .enum(["A", "B", "C", "D", "F"])
          .describe(
            "How likely is this transition and story to be considered a gain in wisdom?"
          ),
      })
    ),
  })

  const data = {
    values: values.map((v) => ({
      id: v.id,
      policies: v.policies,
    })),
  }

  if (context) data["context"] = context

  const result = await genObj({
    prompt: generateUpgradesPrompt,
    temperature: 0.3,
    data,
    schema,
  })

  return (result.transitions ?? []) as Upgrade[]
}

/**
 * Generates upgrade transitions to a specific target value.
 * @param {Value} target - Target value
 * @param {Value[]} candidates - Candidate values
 * @param {string} [context] - Optional context
 * @returns {Promise<Upgrade[]>} Upgrade transitions
 * @throws {Error} If target ID doesn't match
 */
export async function generateUpgradesToValue(
  target: Value,
  candidates: Value[],
  context?: string
): Promise<Upgrade[]> {
  const schema = z.object({
    transitions: z.array(
      z.object({
        a_id: z
          .number()
          .describe("The id of the value the person used to have."),
        b_id: z
          .number()
          .describe(
            "The id of the value they have now (should always be the target value)."
          ),
        a_was_really_about: z
          .string()
          .describe(
            "If the new value is a 'deeper cut' at what you *really* cared about the whole time, what was it that you really cared about all along?"
          ),
        clarification: z
          .string()
          .describe(
            "What was confused or incomplete about the old value, that the new value clarifies?"
          ),
        story: z
          .string()
          .describe(
            'Tell a plausible, personal story. The story should be in first-person, "I" voice. Make up a specific, evocative experience. The experience should include a situation you were in, a series of specific emotions that came up, leading you to discover a problem with the older value, and how you discovered the new value, and an explanation of how the new values what was what you were really about the whole time. The story should also mention in what situations you think the new value is broadly applicable. The story should avoid making long lists of criteria and instead focus on the essence of the values and their difference.'
          ),
        mapping: z
          .array(
            z.object({
              a: z
                .string()
                .describe("An evaluation criterion of the old value."),
              rationale: z
                .string()
                .describe("What strategy did you use, and why is it relevant?"),
            })
          )
          .describe(
            "How do each of the evaluation criteria from the old value relate to criteria of the new one?"
          ),
        likelihood_score: z
          .enum(["A", "B", "C", "D", "F"])
          .describe(
            "How likely is this transition and story to be considered a gain in wisdom?"
          ),
      })
    ),
  })

  const data = {
    targetValue: {
      id: target.id,
      policies: target.policies,
    },
    candidateValues: candidates.map((v) => ({
      id: v.id,
      policies: v.policies,
    })),
  }

  if (context) data["context"] = context

  const result = await genObj({
    prompt: generateUpgradesPrompt,
    temperature: 0.3,
    data,
    schema,
  })

  if (result.transitions.some((t) => t.b_id !== target.id)) {
    throw new Error("Invalid upgrade generated –– target value does not match.")
  }

  return (result.transitions ?? []) as Upgrade[]
}
