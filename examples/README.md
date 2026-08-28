# Examples

These examples call the hosted 4YI OpenAI-compatible endpoint. Create an API key in the [4YI console](https://app.4yi.ai/code?utm_source=github&utm_medium=repo_examples&utm_campaign=4yi-ai-bridge), then export it without committing it:

```bash
export FOURYI_API_KEY="your-api-key"
```

Use the model catalog endpoint to select a model available to your account:

```bash
curl -sS https://app.4yi.ai/api/v1/models \
  -H "Authorization: Bearer $FOURYI_API_KEY"
```

- [curl](curl/chat-completions.sh)
- [Python with the OpenAI SDK](python/chat.py)
- [TypeScript with the OpenAI SDK](typescript/chat.mjs)

Install the SDK required by the example you choose:

```bash
python -m pip install openai
# or
npm install openai
```

Never put a real API key in source code, shell history shared with others, screenshots, issues, or pull requests.
