import { readPrompt } from "../utils"

const articulateValueForTopicPrompt = readPrompt(
  "articulate-value-for-topic-prompt.md"
)
const articulateValuePrompt = readPrompt("articulate-value-prompt.md")

export { articulateValueForTopicPrompt, articulateValuePrompt }

// TODO: Add some functions for values articulation here.