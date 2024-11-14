import { readdir, readFile, writeFile } from "fs/promises"
import { join } from "path"

async function buildPrompts() {
  const promptsDir = join(process.cwd(), "src", "prompts")
  const outputFile = join(promptsDir, "index.ts")

  const files = await readdir(promptsDir)
  const mdFiles = files.filter((file) => file.endsWith(".md"))

  let output = "// This file is auto-generated. Do not edit directly.\n\n"

  for (const file of mdFiles) {
    const content = await readFile(join(promptsDir, file), "utf-8")
    const constName = file
      .replace(".md", "")
      .replace(/-./g, (x) => x[1].toUpperCase())
    output += `export const ${constName} = \`${content.replace(
      /`/g,
      "\\`"
    )}\`;\n\n`
  }

  await writeFile(outputFile, output)
  console.log("Prompts built successfully.")
}

buildPrompts().catch(console.error)
