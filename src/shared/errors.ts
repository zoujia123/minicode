export class PixiuError extends Error {
  readonly code: string

  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message, { cause: options?.cause })
    this.name = "PixiuError"
    this.code = options?.code ?? "PIXIU_ERROR"
  }
}

export function formatError(error: unknown) {
  if (error instanceof PixiuError) return `${error.code}: ${error.message}`
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new PixiuError(message, { code: "ASSERTION_FAILED" })
}

