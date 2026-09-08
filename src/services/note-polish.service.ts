/**
 * note-polish.service.ts
 * Frontend bridge to the /.netlify/functions/polish-note serverless function.
 * Supports response streaming (Server-Sent Events) to handle large notes (8,500+ chars) without gateway timeouts.
 */

export async function callPolishNote(
  rawText: string,
  subjectName?: string,
  chapterName?: string,
  onChunk?: (accumulatedText: string) => void
): Promise<{ html: string } | { error: string }> {
  try {
    const res = await fetch('/.netlify/functions/polish-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, subjectName, chapterName }),
    })

    if (!res.ok) {
      try {
        const data = await res.json()
        return { error: data.error || `Server error: ${res.status}` }
      } catch {
        const text = await res.text()
        return { error: text || `Server error: ${res.status}` }
      }
    }

    const contentType = res.headers.get('content-type') || ''
    // Handle standard JSON response if returned
    if (contentType.includes('application/json')) {
      const data = await res.json()
      if (data.error) return { error: data.error }
      if (data.html) return { html: data.html }
    }

    // Handle streamed SSE response
    if (!res.body) {
      return { error: 'No response body received from AI service.' }
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let fullContent = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue
        const dataStr = trimmed.slice(5).trim()
        if (dataStr === '[DONE]') continue

        try {
          const parsed = JSON.parse(dataStr)
          if (parsed.error) {
            return { error: parsed.error.message || 'Error occurred during AI note generation.' }
          }
          const delta = parsed?.choices?.[0]?.delta?.content
          if (typeof delta === 'string') {
            fullContent += delta
            onChunk?.(fullContent)
          }
        } catch {
          // Ignore incomplete chunks
        }
      }
    }

    // Process leftover buffer if any
    if (buffer.trim().startsWith('data:')) {
      const dataStr = buffer.trim().slice(5).trim()
      if (dataStr && dataStr !== '[DONE]') {
        try {
          const parsed = JSON.parse(dataStr)
          const delta = parsed?.choices?.[0]?.delta?.content
          if (typeof delta === 'string') {
            fullContent += delta
            onChunk?.(fullContent)
          }
        } catch {}
      }
    }

    const html = fullContent
      .replace(/^```(?:html)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    if (!html) {
      return { error: 'AI returned an empty response. Please try again.' }
    }

    return { html }
  } catch (err: any) {
    return { error: err?.message || 'Network error — could not reach the AI service.' }
  }
}
