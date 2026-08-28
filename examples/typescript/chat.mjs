import OpenAI from "openai";

const apiKey = process.env.FOURYI_API_KEY;
const model = process.env.FOURYI_MODEL;

if (!apiKey || !model) {
  throw new Error("Set FOURYI_API_KEY and FOURYI_MODEL before running this example");
}

const client = new OpenAI({
  baseURL: "https://app.4yi.ai/api/v1",
  apiKey,
});

const response = await client.chat.completions.create({
  model,
  messages: [
    { role: "user", content: "Reply with one short sentence about secure AI tooling." },
  ],
});

console.log(response.choices[0].message.content);
