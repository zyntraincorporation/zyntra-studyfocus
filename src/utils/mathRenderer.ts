import katex from 'katex'

/**
 * Safely renders LaTeX mathematical expressions within an HTML string.
 * Supports:
 * - Block math: $$ ... $$ and \[ ... \]
 * - Inline math: $ ... $ and \( ... \)
 * - Fallback: <code> blocks containing LaTeX commands (\frac, \Delta, \gamma, etc.)
 */
export function renderMathInHtml(html: string): string {
  if (!html) return ''

  // 1. Render display math: $$...$$
  let result = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
    try {
      const cleanTex = tex.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
      return `<div class="katex-display-wrapper my-2 py-2 px-2 text-center overflow-x-auto" style="max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: thin;">${katex.renderToString(cleanTex, { displayMode: true, throwOnError: false })}</div>`
    } catch {
      return `$$${tex}$$`
    }
  })

  // 2. Render display math: \[...\]
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, tex) => {
    try {
      const cleanTex = tex.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
      return `<div class="katex-display-wrapper my-2 py-2 px-2 text-center overflow-x-auto" style="max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: thin;">${katex.renderToString(cleanTex, { displayMode: true, throwOnError: false })}</div>`
    } catch {
      return `\\[${tex}\\]`
    }
  })

  // 3. Render inline math: $...$ (avoiding dollar signs followed by numbers like $100)
  result = result.replace(/\$([^\$\n\r]+?)\$/g, (match, tex) => {
    if (/^\s*\d+([.,]\d+)?\s*$/.test(tex)) return match
    try {
      const cleanTex = tex.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
      return katex.renderToString(cleanTex, { displayMode: false, throwOnError: false })
    } catch {
      return `$${tex}$`
    }
  })

  // 4. Render inline math: \(...\)
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, tex) => {
    try {
      const cleanTex = tex.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
      return katex.renderToString(cleanTex, { displayMode: false, throwOnError: false })
    } catch {
      return `\\(${tex}\\)`
    }
  })

  // 5. Fallback for raw LaTeX inside <code> tags from earlier notes
  result = result.replace(/<code([^>]*)>([\s\S]*?)<\/code>/gi, (match, _attrs, codeContent) => {
    const raw = codeContent.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()
    if (/\\[a-zA-Z]+|\^|_|\{.*?\}/.test(raw)) {
      try {
        const isBlock = raw.length > 20 || raw.includes('\\frac') || raw.includes('\\int') || (raw.includes('=') && raw.length > 15)
        const rendered = katex.renderToString(raw, { displayMode: isBlock, throwOnError: false })
        if (isBlock) {
          return `<div class="katex-display-wrapper my-2 py-1.5 px-2 text-center overflow-x-auto" style="max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: thin;">${rendered}</div>`
        }
        return `<span class="katex-inline-wrapper px-0.5">${rendered}</span>`
      } catch {
        return match
      }
    }
    return match
  })

  return result
}
