export const cosineDistance = (vecA: number[], vecB: number[]) => {
  let dotProduct = 0.0
  let normA = 0.0
  let normB = 0.0
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }
  return 1.0 - dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}
