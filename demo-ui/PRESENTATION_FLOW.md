# K4 LLM Lab Console - Demo Flow

Use this as the mentor talk track for a short live presentation. The goal is to show the lab concepts through one UI instead of jumping between terminal output and source code.

## 1. Setup Before Class

Run from the project root:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/ -q
$env:PYTHONIOENCODING='utf-8'
.\.venv\Scripts\python.exe grade.py
```

Expected result:

```text
35 passed
TONG 100.0/100
```

Prepare `.env` for a real API demo:

```text
OPENAI_API_KEY=your-key-here
OPENAI_BASE_URL=
LAB_MODEL=gpt-4o
LAB_MINI_MODEL=gpt-4o-mini
```

If using a compatible provider, set `OPENAI_BASE_URL`, `LAB_MODEL`, and `LAB_MINI_MODEL` to the values from that provider.

Start the demo server:

```powershell
.\.venv\Scripts\python.exe demo-ui\server.py
```

Open:

```text
http://127.0.0.1:8000
```

The status badge should show `Real API ready` when `OPENAI_API_KEY` is available. If the API fails, the server falls back to mock output so the presentation can continue.

## 2. Five Minute Talk Track

1. Introduce the product:
   This is a visual console for the Day 1 LLM API lab. It shows how an app builds messages, calls a model, streams output, tracks history, estimates tokens and compares model tradeoffs.

2. Explain config:
   The API key stays in `.env` and is never committed. Model names are config values, so the same code can switch from `gpt-4o` to `gpt-4o-mini` or to another OpenAI-compatible endpoint.

3. Explain prompts:
   `System prompt` controls behavior, tone, language and role. `User prompt` is the current task. The message stack shows the exact order sent to the model: system, history, latest user message.

4. Explain sampling:
   `temperature` changes randomness. `top_p` changes how wide the candidate token pool is. For experiments, change one at a time so the result is explainable. `max_tokens` caps output length and cost.

5. Click `Stream reply`:
   Point out that the answer appears incrementally. This improves perceived speed because people see text before the full answer is done.

6. Ask follow-up questions:
   Show that history is preserved, then point to `History kept`. The lab keeps only 3 turns, or 6 messages, so context does not grow forever.

7. Click `Compare models`:
   The same prompt is sent to the main model and mini model. Compare latency, cost and response quality. The lesson is product choice, not "one model is always best."

8. Close with verify:
   Tests prove the code contract. `grade.py` proves the submission package in `solution/` is what will be graded.

## 3. Real Demo Path

Use these prompts:

```text
System prompt:
You are a friendly AI lab teaching assistant. Answer clearly, concisely, and in English.

User prompt 1:
Explain what an API is using a weather app example.

User prompt 2:
In that example, what are the request and the response?

Compare prompt:
Explain the difference between temperature and top_p in one sentence.
```

What to say while streaming:

```text
The UI does not wait for the full answer to finish. The server receives chunks from the model and forwards them to the browser. Users can start reading immediately, so the experience feels faster even if the total generation time is similar.
```

What to say while comparing:

```text
The same prompt can produce different tradeoffs. The larger model often gives deeper answers and costs more. The smaller model is usually faster and cheaper, which fits FAQ, intent classification, or high-volume demos. For multi-step reasoning or high-quality responses, the larger model can be worth the cost.
```

## 4. Sharing Checklist

- Push code, not secrets.
- Keep `.env` local.
- Run `git status --short --ignored` and confirm `.env` is ignored.
- Share the GitHub fork link for grading.
- Share the local demo by projecting `http://127.0.0.1:8000`.
- If another machine needs to run the demo, that machine must create its own `.env`.

## 5. Fallback Plan

If the network, key, quota, or model endpoint fails:

1. Keep the server running.
2. The UI will show mock fallback status.
3. Continue explaining the same flow: prompt, message stack, streaming, history, token and cost.
4. Tell the class the fallback is intentional so the teaching flow is not blocked by external API reliability.
