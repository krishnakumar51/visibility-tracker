# Routes

TanStack Router uses file-based routing. Each route component is defined in
this directory, with `__root.tsx` providing the shared dashboard shell.

## Conventions

| File | URL |
| --- | --- |
| `index.tsx` | `/` |
| `answer-explorer.tsx` | `/answer-explorer` |

The Vite router plugin generates `src/routeTree.gen.ts` from the route files.
