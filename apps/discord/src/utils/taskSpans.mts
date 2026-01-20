import type { Span } from '@thesharks/analytics'

const spans = new Map<string, Span>()

function buildKey(task: { name: string }): string {
  return task.name
}

export function setTaskSpan(task: { name: string }, span: Span): void {
  spans.set(buildKey(task), span)
}

export function getTaskSpan(task: { name: string }): Span | undefined {
  return spans.get(buildKey(task))
}

export function clearTaskSpan(task: { name: string }): void {
  spans.delete(buildKey(task))
}
