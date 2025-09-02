- we are building an http streaming mcp server NOT SSE!
- when using env vars, always access them via the env.ts file ( import { env } from '@/env'
 )
- in typescript prefer type over interface when possible
- in typescript, avoid "any" like the plague
- prefer colocation + locality of behavior
- NEVER user css margin (as margin is a css side effect)! Instead, wrap content in divs and apply padding, or use layout techniques such as flex box or css grid.
- always type things as strictly as possible, use things like discriminated unions when reasonable