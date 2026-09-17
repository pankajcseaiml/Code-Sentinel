# Model and Agent Selection - User Guide

## Overview
You can now select specific AI models and agents when communicating with OpenCode through the web UI. This gives you fine-grained control over which AI model processes your requests and which agent mode is used.

## Where to Find It

### 1. New Chat Dialog
**Location**: Click "New Chat" button on any project page

**What you'll see**:
- Two dropdowns at the top of the dialog
- **Model dropdown** (left): Select from available AI models grouped by provider
- **Agent dropdown** (right): Choose between agents like "build" or "plan"
- Both are **optional** - if you don't select, OpenCode uses its default configuration

**Example workflow**:
1. Click "New Chat"
2. (Optional) Select a model like `google/gemini-2.5-flash`
3. (Optional) Select an agent like `build`
4. Type your message
5. Click "Start Chat"

### 2. Resume Chat Area
**Location**: At the bottom of any active chat session, above the message input

**What you'll see**:
- Compact grid with Model and Agent selectors
- Same options as New Chat dialog
- Positioned right above the chat input area
- Smaller, space-efficient design

**Example workflow**:
1. Navigate to an existing chat session
2. Scroll to the bottom where the chat input is
3. (Optional) Select a different model or agent from the dropdowns
4. Type your message
5. Click "Resume" or "Send"

## Available Options

### Models
The models available depend on your OpenCode configuration. You'll typically see:
- **google/**: Google Gemini models (gemini-2.5-flash, gemini-2.5-pro, etc.)
- **opencode/**: OpenCode-specific models (big-pickle, grok-code, code-supernova)
- **anthropic/**: Claude models (if configured)
- **openai/**: GPT models (if configured)

The total number of models shown depends on your `~/.opencode/config.json` and authenticated providers.

### Agents
- **build**: Primary agent for writing and modifying code (has full tool access)
- **plan**: Agent for planning and analyzing without making changes (read-only mode)

## How It Works

When you select a model and/or agent, the web UI passes them to the OpenCode CLI:

```bash
opencode run --agent build --model google/gemini-2.5-flash "your message"
```

If you don't select options, OpenCode uses the defaults from your configuration file.

## Tips

1. **Default Configuration**: If you frequently use a specific model/agent, set it as default in `~/.opencode/config.json`
2. **Provider Authentication**: Make sure you're authenticated with providers using `opencode auth login`
3. **Model Availability**: Run `opencode models` in your terminal to see all available models
4. **Optional Selection**: You don't have to select a model or agent - leaving them empty uses OpenCode defaults
5. **Per-Message Selection**: You can change the model/agent for each message in a conversation

## Troubleshooting

### "No models available" message
- **Cause**: OpenCode CLI is not returning any models
- **Fix**: 
  1. Ensure OpenCode is properly installed: `opencode --version`
  2. Authenticate with at least one provider: `opencode auth login`
  3. Check your config file: `cat ~/.opencode/config.json`

### Models not loading
- **Cause**: Network issue or CLI error
- **Fix**: 
  1. Test manually: `opencode models`
  2. Check server logs for errors
  3. Restart the web UI server

### Agent selection not taking effect
- **Cause**: Agent configuration may be overridden by defaults
- **Fix**: Check your `~/.opencode/config.json` for agent-specific settings

## Configuration Example

To add custom models or agents, edit your OpenCode configuration:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "model": "google/gemini-2.5-flash",
  "agent": {
    "build": {
      "model": "anthropic/claude-sonnet-4-20250514"
    },
    "plan": {
      "model": "anthropic/claude-haiku-4-20250514"
    }
  }
}
```

## Related Commands

```bash
# List available models
opencode models

# Check authenticated providers
opencode auth list

# Login to a provider
opencode auth login google

# Test with specific model and agent
opencode run --model google/gemini-2.5-flash --agent build "test message"
```
