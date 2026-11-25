# edge-tts 한 덩어리 → mp3 + 단어 시간(JSON). tts.mjs 가 부른다.
#   python scripts/shorts/tts.py <voice> <rate e.g. +0%> <text-file utf8> <out.mp3> <out.json>
# 단어 시간: [{"t": 시작초, "d": 길이초, "w": "낱말"}]
import asyncio
import json
import sys

import edge_tts


async def main() -> None:
    voice, rate, text_path, out_mp3, out_json = sys.argv[1:6]
    with open(text_path, encoding="utf-8") as f:
        text = f.read().strip()
    com = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    words = []
    with open(out_mp3, "wb") as out:
        async for ch in com.stream():
            if ch["type"] == "audio":
                out.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"t": ch["offset"] / 1e7, "d": ch["duration"] / 1e7, "w": ch["text"]})
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=1)


asyncio.run(main())
