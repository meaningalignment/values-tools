# Values Tools

Values Tools is a TypeScript library that provides a configurable interface for working with AI language models, with built-in caching functionality.

## Features

- Articulate values
- Deduplicate values
- Deduplicate choice types

## Installation

```bash
npm install values-tools
```

## Configuration

The Values Tools module can be configured using the `configureValuesTools` function. Here's an example of how to set up the configuration:

```typescript
import { configureValuesTools, Cache } from 'values-tools';

const cache = new Cache('path/to/cache.sqlite');

configureValuesTools({
  defaultModel: 'claude-3-5-sonnet-20240620',
  defaultTemperature: 0.7,
  cache: cache
});

// You can now use any function with these default values.
```

## Caching

The Values Tools module includes a caching mechanism to store and retrieve LLM results, which reduces API calls. The cache uses a SQLite database to store the data.

## Prompt Generation

The system creates TypeScript variables from Markdown files in the `prompts` folder. It uses a build script to do this automatically. This makes the prompts easy to use in the code.