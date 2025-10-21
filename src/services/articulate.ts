import { articulateValuePrompt } from "../prompts"

export { articulateValuePrompt }

// Tool definition for submit_values_card function
export const submitValuesCardTool = {
  name: "submit_values_card",
  description: "Submit a values card.",
  strict: false,
  parameters: {
    type: "object",
    properties: {
      policies: {
        type: "array",
        description: "The attention policies of the values card.",
        items: {
          type: "string",
          description: "A plural noun that feels meaningful for the person to attend to, followed by a prepositional phrase providing more detail."
        }
      },
      title: {
        type: "string",
        description: "A 2-5 word title for the source of meaning, distinguishing it from other similar values. Should not be cheesy."
      },
      description: {
        type: "string",
        description: "A very short one-sentence summary in the shape of a personal story in present continous tense from a first person perspective about the exact moment that felt meaningful to the user. Should not not describe the resulting feeling or state (e.g. '...which made me feel deeply connected'). Should not include ANY names or other sensitive PII – replace names with 'my mom', 'my dad', 'my friend', 'someone I was talking to', 'someone I love', etc. Example story: 'Watching my mom lean over and kissing my dad on the forehead, beaming love and gratitude'."
      }
    },
    required: [
      "policies",
      "description", 
      "title"
    ]
  }
}