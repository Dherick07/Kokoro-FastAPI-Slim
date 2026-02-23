"""
Generate pre-recorded voice sample audio files for all available voices.

Each voice gets a short "Hello Everyone, Welcome to Dexterous!" sample
stored as MP3 in web/voice_samples/<voice_name>.mp3.

Usage:
    python scripts/generate_voice_samples.py [--api-url http://localhost:8880] [--batch-size 5]

Requires a running Kokoro FastAPI instance (local Docker container).
"""

import argparse
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

SAMPLE_TEXT = "Hello Everyone, Welcome to Dexterous!"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "web" / "voice_samples"


def get_voices(api_url: str) -> list[str]:
    """Fetch available voices from the API."""
    resp = requests.get(f"{api_url}/v1/audio/voices", timeout=10)
    resp.raise_for_status()
    return resp.json()["voices"]


def generate_sample(api_url: str, voice: str, output_dir: Path) -> dict:
    """Generate a single voice sample and save it as MP3."""
    output_path = output_dir / f"{voice}.mp3"

    # Skip if already exists
    if output_path.exists() and output_path.stat().st_size > 0:
        return {"voice": voice, "status": "skipped", "path": str(output_path)}

    payload = {
        "model": "kokoro",
        "input": SAMPLE_TEXT,
        "voice": voice,
        "response_format": "mp3",
        "stream": False,
        "speed": 1.0,
    }

    try:
        resp = requests.post(
            f"{api_url}/v1/audio/speech",
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()

        output_path.write_bytes(resp.content)
        return {
            "voice": voice,
            "status": "ok",
            "path": str(output_path),
            "size_kb": round(len(resp.content) / 1024, 1),
        }
    except Exception as e:
        return {"voice": voice, "status": "error", "error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="Generate voice sample audio files")
    parser.add_argument(
        "--api-url",
        default="http://localhost:8880",
        help="Kokoro FastAPI base URL (default: http://localhost:8880)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=3,
        help="Number of parallel requests (default: 3, keep low for CPU)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate even if file already exists",
    )
    args = parser.parse_args()

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Fetch voices
    print(f"Fetching voices from {args.api_url}...")
    try:
        voices = get_voices(args.api_url)
    except Exception as e:
        print(f"ERROR: Could not connect to API at {args.api_url}: {e}")
        print("Make sure the Kokoro FastAPI Docker container is running.")
        sys.exit(1)

    print(f"Found {len(voices)} voices")
    print(f"Sample text: \"{SAMPLE_TEXT}\"")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Batch size: {args.batch_size}")
    print()

    # If force, remove existing files
    if args.force:
        for f in OUTPUT_DIR.glob("*.mp3"):
            f.unlink()
        print("Cleared existing samples (--force)")

    # Generate samples in batches
    results = {"ok": 0, "skipped": 0, "error": 0}
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=args.batch_size) as executor:
        futures = {
            executor.submit(generate_sample, args.api_url, voice, OUTPUT_DIR): voice
            for voice in voices
        }

        for i, future in enumerate(as_completed(futures), 1):
            voice = futures[future]
            result = future.result()
            status = result["status"]
            results[status] += 1

            if status == "ok":
                print(f"  [{i}/{len(voices)}] {voice} — {result['size_kb']} KB")
            elif status == "skipped":
                print(f"  [{i}/{len(voices)}] {voice} — skipped (exists)")
            else:
                print(f"  [{i}/{len(voices)}] {voice} — ERROR: {result['error']}")

    elapsed = time.time() - start_time
    print()
    print(f"Done in {elapsed:.1f}s")
    print(f"  Generated: {results['ok']}")
    print(f"  Skipped:   {results['skipped']}")
    print(f"  Errors:    {results['error']}")
    print(f"  Total:     {sum(results.values())}")


if __name__ == "__main__":
    main()
