# Model Selection Guide

This guide helps you choose the right LLM provider and model for your Conversation Relay application.

## Quick Start

For most use cases, the defaults work well:

```env
# Default configuration (no changes needed)
LLM_PROVIDER=openai-chat-completions
LLM_MODEL=gpt-4.1
```

## Provider Selection

### OpenAI Chat Completions API (`openai-chat-completions`)

**Best for:** Production deployments, stability-focused applications

| Aspect | Details |
|--------|---------|
| Stability | Mature, well-tested API |
| Documentation | Extensive, widely documented |
| Tool Calls | Standard function calling |
| State Management | Manual (handled by the service) |

```env
LLM_PROVIDER=openai-chat-completions
```

### OpenAI Responses API (`openai-responses`)

**Best for:** Applications that benefit from built-in conversation state management

| Aspect | Details |
|--------|---------|
| Stability | Newer API |
| System Prompt | Uses `instructions` parameter (sent once, cached) |
| Tool Calls | Simplified tool format |
| State Management | Built-in conversation history handling |
| Token Efficiency | System prompt cached, potentially lower token usage |

```env
LLM_PROVIDER=openai-responses
```

**Key difference:** The Responses API uses an `instructions` parameter for the system prompt, which is sent once and cached by OpenAI, potentially reducing token usage in long conversations.

## Model Selection

### Available Models

| Model | Speed | Intelligence | Cost | Best For |
|-------|-------|--------------|------|----------|
| `gpt-4.1` | Fast | High | Medium | General use, balanced performance |
| `gpt-4o` | Fast | Very High | Higher | Complex reasoning, nuanced responses |
| `gpt-4o-mini` | Very Fast | Good | Low | Cost-sensitive, high-volume |
| `gpt-4-turbo` | Medium | Very High | Higher | Complex tasks with large context |

### Recommendations by Use Case

#### Voice Conversations (ConversationRelay)

```env
LLM_MODEL=gpt-4.1
OPENAI_MAX_COMPLETION_TOKENS=150
```

**Why:** Voice requires fast responses. Users are waiting in real-time, so latency matters more than in messaging. The `gpt-4.1` model provides a good balance of speed and intelligence.

**Token limit:** Keep responses concise (150-200 tokens) for natural conversation flow. Long responses feel unnatural in voice and delay user interaction.

#### High-Volume Applications

```env
LLM_MODEL=gpt-4o-mini
OPENAI_MAX_COMPLETION_TOKENS=200
```

**Why:** Lower cost per token, faster response times. Good enough for most customer service scenarios.

#### Complex Decision Making

```env
LLM_MODEL=gpt-4o
# No token limit for complex responses
```

**Why:** Best reasoning capabilities. Use when the AI needs to make nuanced decisions or handle complex multi-step processes.

## Configuration Examples

### Cost-Optimized Voice Bot

```env
LLM_PROVIDER=openai-responses
LLM_MODEL=gpt-4o-mini
OPENAI_MAX_COMPLETION_TOKENS=150
```

Uses the Responses API (token-efficient system prompt) with the most cost-effective model.

### Premium Customer Service

```env
LLM_PROVIDER=openai-chat-completions
LLM_MODEL=gpt-4o
OPENAI_MAX_COMPLETION_TOKENS=200
```

Uses the stable Chat Completions API with the most capable model for high-value interactions.

### Development/Testing

```env
LLM_PROVIDER=openai-chat-completions
LLM_MODEL=gpt-4o-mini
```

Fast iteration with lower costs during development.

## Token Usage Monitoring

Both providers log token usage for each response:

```
[ResponsesAPI] Token Usage:
   Input tokens:  1234
   Output tokens: 89
   Total tokens:  1323
```

Monitor these logs to:
- Understand cost implications
- Optimize prompt length
- Identify opportunities to reduce token usage

## Switching Providers

The application supports hot-switching between providers by changing the `LLM_PROVIDER` environment variable. Both providers:

- Use the same tool definitions (converted automatically)
- Emit the same events
- Support streaming and non-streaming responses
- Work with voice and messaging channels

To switch:
1. Update `LLM_PROVIDER` in `.env`
2. Restart the application

No code changes required.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    LLM Factory                               │
│                 (src/services/llm/factory.ts)                │
└─────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  OpenAIChatCompletions   │  │   OpenAIResponses        │
│  Service                 │  │   Service                │
│  (providers/openai-      │  │  (providers/openai-      │
│   chat-completions.ts)   │  │   responses.ts)          │
└──────────────────────────┘  └──────────────────────────┘
              │                           │
              └─────────────┬─────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │    Tool Definitions      │
              │  (tools/toolDefinitions  │
              │        .ts)              │
              └──────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │    Tool Converter        │
              │   (tools/converter.ts)   │
              │                          │
              │  Converts tools to       │
              │  provider-specific       │
              │  format automatically    │
              └──────────────────────────┘
```

## Troubleshooting

### "Model not found" error

Ensure your OpenAI API key has access to the specified model. Some models require specific API tier access.

### Slow responses

1. Try a faster model (`gpt-4o-mini`)
2. Reduce `OPENAI_MAX_COMPLETION_TOKENS`
3. Simplify your system prompt

### High costs

1. Switch to `gpt-4o-mini`
2. Use `openai-responses` provider (cached system prompt)
3. Set reasonable token limits
4. Monitor token usage logs

### Inconsistent behavior between providers

While both providers aim for consistent behavior, there may be subtle differences in how they handle:
- System prompt injection
- Tool call formatting
- Conversation history management

If you notice issues, stick with one provider for production.
