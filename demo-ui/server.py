from __future__ import annotations

import json
import os
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from template import (  # noqa: E402
    OPENAI_MINI_MODEL,
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


def _send_sse(handler: SimpleHTTPRequestHandler, payload: dict[str, Any]) -> None:
    body = f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")
    handler.wfile.write(body)
    handler.wfile.flush()


class DemoHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:
        if self.path == "/api/config":
            _json_response(
                self,
                200,
                {
                    "hasKey": bool(os.getenv("OPENAI_API_KEY")),
                    "model": OPENAI_MODEL,
                    "miniModel": OPENAI_MINI_MODEL,
                    "baseUrlConfigured": bool(os.getenv("OPENAI_BASE_URL")),
                },
            )
            return
        super().do_GET()

    def do_POST(self) -> None:
        if self.path == "/api/compare":
            self._handle_compare()
            return
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

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        reply = ""
        source = "mock-no-key"

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
                stream = retry_with_backoff(
                    lambda: client.chat.completions.create(
                        model=OPENAI_MODEL,
                        messages=messages,
                        temperature=temperature,
                        top_p=top_p,
                        max_tokens=max_tokens,
                        stream=True,
                    )
                )
                source = "api"
                for chunk in stream:
                    delta = chunk.choices[0].delta.content or ""
                    if not delta:
                        continue
                    reply += delta
                    _send_sse(self, {"type": "delta", "text": delta})
            except Exception as exc:
                reply = _mock_reply(prompt, persona)
                source = f"mock-fallback: {exc.__class__.__name__}"
                self._stream_mock_text(reply)
        else:
            reply = _mock_reply(prompt, persona)
            self._stream_mock_text(reply)

        cost = estimate_cost(prompt, reply)
        _send_sse(
            self,
            {
                "type": "done",
                "reply": reply,
                "source": source,
                "inputTokens": cost["input_tokens"],
                "outputTokens": cost["output_tokens"],
                "totalCost": cost["total_cost"],
            },
        )

    def _stream_mock_text(self, reply: str) -> None:
        words = reply.split(" ")
        for index, word in enumerate(words):
            _send_sse(self, {"type": "delta", "text": f"{'' if index == 0 else ' '}{word}"})
            time.sleep(0.025)

    def _handle_compare(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "Invalid JSON"})
            return

        prompt = str(payload.get("prompt", "")).strip() or "Giải thích token là gì."
        temperature = float(payload.get("temperature", 0.7))
        top_p = float(payload.get("topP", 0.9))
        max_tokens = int(payload.get("maxTokens", 256))

        rows: list[dict[str, Any]] = []
        source = "mock-no-key"

        if os.getenv("OPENAI_API_KEY"):
            try:
                from openai import OpenAI

                client = OpenAI(
                    api_key=os.getenv("OPENAI_API_KEY"),
                    base_url=os.getenv("OPENAI_BASE_URL"),
                )
                for model in (OPENAI_MODEL, OPENAI_MINI_MODEL):
                    start = time.perf_counter()
                    response = retry_with_backoff(
                        lambda model=model: client.chat.completions.create(
                            model=model,
                            messages=[{"role": "user", "content": prompt}],
                            temperature=temperature,
                            top_p=top_p,
                            max_tokens=max_tokens,
                        )
                    )
                    latency = time.perf_counter() - start
                    text = response.choices[0].message.content or ""
                    cost = estimate_cost(prompt, text, model)["total_cost"]
                    rows.append(
                        {
                            "model": model,
                            "latency": latency,
                            "cost": cost,
                            "response": text,
                        }
                    )
                source = "api"
            except Exception:
                rows = []
                source = "mock-fallback"

        if not rows:
            mock_rows = [
                (
                    OPENAI_MODEL,
                    1.35 + len(prompt) / 260,
                    "Phản hồi đầy đủ hơn, diễn giải kỹ các khái niệm và liên hệ tới sản phẩm thật.",
                ),
                (
                    OPENAI_MINI_MODEL,
                    0.48 + len(prompt) / 520,
                    "Phản hồi ngắn hơn, nhanh hơn, phù hợp demo hoặc tác vụ đơn giản.",
                ),
            ]
            rows = [
                {
                    "model": model,
                    "latency": latency,
                    "cost": estimate_cost(prompt, response, model)["total_cost"],
                    "response": response,
                }
                for model, latency, response in mock_rows
            ]

        _json_response(self, 200, {"source": source, "rows": rows})


def main() -> None:
    port = int(os.getenv("PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), DemoHandler)
    print(f"LLM Lab Console running at http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
