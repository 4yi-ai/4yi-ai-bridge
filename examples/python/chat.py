"""Minimal OpenAI-compatible 4YI example."""

import os

from openai import OpenAI


api_key = os.environ["FOURYI_API_KEY"]
model = os.environ["FOURYI_MODEL"]

client = OpenAI(base_url="https://app.4yi.ai/api/v1", api_key=api_key)
response = client.chat.completions.create(
    model=model,
    messages=[
        {
            "role": "user",
            "content": "Reply with one short sentence about secure AI tooling.",
        }
    ],
)

print(response.choices[0].message.content)
