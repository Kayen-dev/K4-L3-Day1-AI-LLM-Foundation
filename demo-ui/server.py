from __future__ import annotations

import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from template import (  # noqa: E402
    OPENAI_MODEL,
    count_tokens,
    estimate_cost,
    retry_with_backoff,
)


def _mock_reply(prompt: str, persona: str) -> str:
    style = "ngắn gọn" if "ngắn" in persona.lower() else "rõ ràng"
    return (
        f"Mình sẽ trả lời {style}: \"{prompt}\" được gửi kèm system prompt, "
        "history gần nhất và tham số sampling. Phản hồi này mô phỏng streaming, "
        "sau đó UI cập nhật token, chi phí và history 3 lượt cuối."
    )


def _json_response(handler: SimpleHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class DemoHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self) -> None:
        if self.path != "/api/chat":
            _json_response(self, 404, {"error": "Not found"})
            return

        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON"})
            return

        persona = str(payload.get("persona", "")).strip()
        prompt = str(payload.get("prompt", "")).strip()
        history = payload.get("history", [])
        temperature = float(payload.get("temperature", 0.7))
        top_p = float(payload.get("topP", 0.9))
        max_tokens = int(payload.get("maxTokens", 256))

        if not prompt:
            _json_response(self, 400, {"error": "Prompt is required"})
            return

        if os.getenv("OPENAI_API_KEY"):
            try:
                from openai import OpenAI

                client = OpenAI(
                    api_key=os.getenv("OPENAI_API_KEY"),
                    base_url=os.getenv("OPENAI_BASE_URL"),
                )
                messages = (
                    [{"role": "system", "content": persona}]
                    + [m for m in history if isinstance(m, dict)]
                    + [{"role": "user", "content": prompt}]
                )
                response = retry_with_backoff(
                    lambda: client.chat.completions.create(
                        model=OPENAI_MODEL,
                        messages=messages,
                        temperature=temperature,
                        top_p=top_p,
                        max_tokens=max_tokens,
                    )
                )
                reply = response.choices[0].message.content or ""
                source = "api"
            except Exception as exc:
                reply = _mock_reply(prompt, persona)
                source = f"mock-fallback: {exc.__class__.__name__}"
        else:
            reply = _mock_reply(prompt, persona)
            source = "mock-no-key"

        cost = estimate_cost(prompt, reply)
        _json_response(
            self,
            200,
            {
                "reply": reply,
                "source": source,
                "inputTokens": cost["input_tokens"],
                "outputTokens": cost["output_tokens"],
                "totalCost": cost["total_cost"],
            },
        )


def main() -> None:
    port = int(os.getenv("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), DemoHandler)
    print(f"LLM Lab Console running at http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
