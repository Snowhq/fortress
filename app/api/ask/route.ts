import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { prompt, apiKey } = await req.json();
  if (!prompt || !apiKey) return NextResponse.json({ error: "Missing prompt or apiKey" }, { status: 400 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  return NextResponse.json(data);
}
