/**
 * MiniMax Native Provider — bypasses Vercel AI SDK using native fetch.
 *
 * Uses https://api.minimaxi.com/anthropic/v1/messages directly.
 */

import type { AIProvider, ProviderEvent, ProviderResult } from '../types.js'
import type { SessionEntry, ContentBlock } from '../../core/session.js'
import { readAIProviderConfig } from '../../core/config.js'

export class MiniMaxNativeProvider implements AIProvider {
  readonly providerTag = 'minimax-native' as const

  private apiKey: string = ''
  private baseUrl: string = 'https://api.minimaxi.com/anthropic/v1/messages'
  private model: string = 'MiniMax-M2.7'

  constructor() {
    this.loadConfig()
  }

  private async loadConfig() {
    try {
      const config = await readAIProviderConfig()
      this.apiKey = (config.apiKeys as Record<string, string>)['anthropic'] || ''
      this.baseUrl = config.baseUrl || 'https://api.minimaxi.com/anthropic/v1/messages'
      this.model = config.model || 'MiniMax-M2.7'
    } catch (e) {
      // Use defaults
    }
  }

  async ask(prompt: string): Promise<ProviderResult> {
    const result = await this.generateWithFetch(prompt, [])
    let text = ''
    for await (const event of result) {
      if (event.type === 'text') text = event.text
    }
    return { text, media: [] }
  }

  async *generate(
    entries: SessionEntry[],
    prompt: string,
    _opts?: { systemPrompt?: string; disabledTools?: string[] },
  ): AsyncGenerator<ProviderEvent> {
    // Build messages from session entries
    const messages = this.buildMessages(entries, prompt)

    // Simple non-streaming for now, yield text when done
    const response = await this.fetchCompletion(messages, false)

    if (response.content) {
      for (const block of response.content) {
        if (block.type === 'text') {
          yield { type: 'text', text: block.text }
        } else if (block.type === 'thinking') {
          // Skip thinking in output, or could yield as meta
        }
      }
    }

    yield {
      type: 'done',
      result: {
        text: response.content
          ?.filter((b) => b.type === 'text')
          .map((b) => ('text' in b ? b.text : ''))
          .join('') || '',
        media: [],
      },
    }
  }

  private buildMessages(entries: SessionEntry[], currentPrompt: string): AnthropicMessage[] {
    const messages: AnthropicMessage[] = []

    for (const entry of entries) {
      // Skip compact boundary markers
      if (entry.type === 'system' && entry.subtype === 'compact_boundary') continue

      const { message } = entry

      if (message.role === 'user') {
        if (typeof message.content === 'string') {
          messages.push({ role: 'user', content: message.content })
        } else {
          const textBlocks = message.content
            .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
            .map((b) => b.text)
            .join('\n')
          if (textBlocks) {
            messages.push({ role: 'user', content: textBlocks })
          }
        }
      } else if (message.role === 'assistant') {
        if (typeof message.content === 'string') {
          messages.push({ role: 'assistant', content: message.content })
        } else {
          const textBlocks = message.content
            .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
            .map((b) => b.text)
            .join('\n')
          if (textBlocks) {
            messages.push({ role: 'assistant', content: textBlocks })
          }
        }
      }
    }

    // Add current prompt
    messages.push({ role: 'user', content: currentPrompt })

    return messages
  }

  private async fetchCompletion(
    messages: AnthropicMessage[],
    stream: boolean,
  ): Promise<AnthropicResponse> {
    await this.loadConfig()

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      max_tokens: 4096,
    }

    if (stream) {
      body.stream = true
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`MiniMax API error: ${response.status} - ${text}`)
    }

    if (stream) {
      // Handle streaming
      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      // For streaming, we need to parse SSE lines
      // This is a simplified version
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              // Handle streaming event
              if (parsed.type === 'content_block_delta') {
                if (parsed.delta.type === 'text_delta') {
                  // Yield text event
                }
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      // Return a dummy response for streaming (actual streaming events yielded above)
      return { content: [] }
    } else {
      return response.json()
    }
  }
}

// Types for Anthropic API
interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AnthropicResponse {
  id: string
  type: string
  role: string
  model: string
  content?: Array<{ type: 'text' | 'thinking'; text?: string }>
  usage?: { input_tokens: number; output_tokens: number }
  stop_reason?: string
}
