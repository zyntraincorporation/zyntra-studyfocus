/**
 * note-polish.service.ts
 * Frontend bridge to the /.netlify/functions/polish-note serverless function.
 */

export async function callPolishNote(
  rawText: string
): Promise<{ html: string } | { error: string }> {
  try {
    const res = await fetch('/.netlify/functions/polish-note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText }),
    })
    return await res.json()
  } catch {
    return { error: 'Network error — could not reach the AI service.' }
  }
}
