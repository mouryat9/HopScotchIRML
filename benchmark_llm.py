#!/usr/bin/env python3
"""
Hopscotch LLM Benchmark — Compare Ollama vs vLLM under concurrent load.

Usage:
    # Benchmark Ollama (current setup)
    python benchmark_llm.py --backend ollama --users 1 5 10 25 50

    # Benchmark vLLM (after deployment)
    python benchmark_llm.py --backend vllm --vllm-url http://<cluster-ip>:8000/v1/chat/completions --users 1 5 10 25 50

    # Compare both side-by-side
    python benchmark_llm.py --backend both --users 1 5 10 25 50
"""

import argparse
import asyncio
import time
import json
import statistics
from dataclasses import dataclass, field
from typing import List, Optional

import httpx

# Test prompts simulating real student questions across different steps
TEST_PROMPTS = [
    "What does it mean to have a constructivist worldview? How does that shape my research?",
    "I'm interested in studying how social media affects teen mental health. Can you help me think about this?",
    "What theoretical frameworks would be relevant for studying educational technology in classrooms?",
    "I chose a qualitative approach. What data collection methods would work best?",
    "How do I formulate a good research question for a mixed methods study?",
    "What's the difference between surveys and interviews for data collection?",
    "How should I analyze qualitative interview data? What coding methods exist?",
    "How do I ensure trustworthiness in my qualitative study using Lincoln and Guba's criteria?",
    "What ethical considerations do I need for studying minors in a school setting?",
    "Can you explain the difference between positivist and post-positivist worldviews?",
    "I want to study the impact of project-based learning. What methodology should I consider?",
    "How do I write a problem statement for my research on student engagement?",
    "What's the role of axiology in choosing a research approach?",
    "How do I address potential bias in my qualitative research design?",
    "What are the Belmont principles and how do they apply to my study?",
    "I'm studying teacher burnout. Should I use quantitative or qualitative methods?",
    "How do I ensure my survey instrument is valid and reliable?",
    "What's the difference between credibility and transferability in qualitative research?",
    "How should I handle informed consent when working with high school students?",
    "Can you help me understand what a pragmatist worldview means for my research design?",
]


@dataclass
class RequestResult:
    success: bool
    latency: float  # seconds
    tokens_approx: int = 0
    error: str = ""


@dataclass
class BenchmarkResult:
    backend: str
    num_users: int
    results: List[RequestResult] = field(default_factory=list)

    @property
    def successes(self):
        return [r for r in self.results if r.success]

    @property
    def failures(self):
        return [r for r in self.results if not r.success]

    def summary(self) -> dict:
        latencies = [r.latency for r in self.successes]
        if not latencies:
            return {
                "backend": self.backend,
                "users": self.num_users,
                "success_rate": "0%",
                "error": "All requests failed",
            }
        return {
            "backend": self.backend,
            "users": self.num_users,
            "success_rate": f"{len(self.successes)}/{len(self.results)} ({100*len(self.successes)//len(self.results)}%)",
            "avg_latency": f"{statistics.mean(latencies):.1f}s",
            "median_latency": f"{statistics.median(latencies):.1f}s",
            "p95_latency": f"{sorted(latencies)[int(len(latencies)*0.95)]:.1f}s" if len(latencies) > 1 else f"{latencies[0]:.1f}s",
            "min_latency": f"{min(latencies):.1f}s",
            "max_latency": f"{max(latencies):.1f}s",
            "total_time": f"{max(r.latency for r in self.results):.1f}s",
            "failures": len(self.failures),
        }


async def call_ollama(client: httpx.AsyncClient, url: str, model: str, prompt: str) -> RequestResult:
    """Send a single request to Ollama."""
    start = time.time()
    try:
        resp = await client.post(url, json={
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a research methods tutor. Keep responses under 200 words."},
                {"role": "user", "content": prompt},
            ],
            "stream": False,
            "options": {"temperature": 0.4, "num_predict": 300},
        }, timeout=180)
        resp.raise_for_status()
        data = resp.json()
        content = data.get("message", {}).get("content", "")
        return RequestResult(
            success=True,
            latency=time.time() - start,
            tokens_approx=len(content.split()),
        )
    except Exception as e:
        return RequestResult(success=False, latency=time.time() - start, error=str(e))


async def call_vllm(client: httpx.AsyncClient, url: str, model: str,
                     prompt: str, api_key: str = "") -> RequestResult:
    """Send a single request to vLLM (OpenAI-compatible)."""
    start = time.time()
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    try:
        resp = await client.post(url, json={
            "model": model,
            "messages": [
                {"role": "system", "content": "You are a research methods tutor. Keep responses under 200 words."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.4,
            "max_tokens": 300,
        }, headers=headers, timeout=180)
        resp.raise_for_status()
        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        return RequestResult(
            success=True,
            latency=time.time() - start,
            tokens_approx=len(content.split()),
        )
    except Exception as e:
        return RequestResult(success=False, latency=time.time() - start, error=str(e))


async def run_benchmark(backend: str, num_users: int, ollama_url: str, ollama_model: str,
                        vllm_url: str, vllm_model: str, vllm_api_key: str) -> BenchmarkResult:
    """Run concurrent requests and collect results."""
    result = BenchmarkResult(backend=backend, num_users=num_users)

    # Pick prompts (cycle if more users than prompts)
    prompts = [TEST_PROMPTS[i % len(TEST_PROMPTS)] for i in range(num_users)]

    async with httpx.AsyncClient() as client:
        if backend == "ollama":
            tasks = [call_ollama(client, ollama_url, ollama_model, p) for p in prompts]
        else:
            tasks = [call_vllm(client, vllm_url, vllm_model, p, vllm_api_key) for p in prompts]

        # Fire all requests concurrently
        print(f"  Firing {num_users} concurrent requests to {backend}...")
        results = await asyncio.gather(*tasks)
        result.results = list(results)

    return result


def print_results_table(all_results: List[BenchmarkResult]):
    """Print a comparison table."""
    print("\n" + "=" * 90)
    print(f"{'Backend':<10} {'Users':<7} {'Success':<12} {'Avg':<10} {'Median':<10} {'P95':<10} {'Max':<10}")
    print("=" * 90)
    for r in all_results:
        s = r.summary()
        print(f"{s['backend']:<10} {s['users']:<7} {s['success_rate']:<12} "
              f"{s.get('avg_latency', 'N/A'):<10} {s.get('median_latency', 'N/A'):<10} "
              f"{s.get('p95_latency', 'N/A'):<10} {s.get('max_latency', 'N/A'):<10}")
    print("=" * 90)


def main():
    parser = argparse.ArgumentParser(description="Hopscotch LLM Benchmark")
    parser.add_argument("--backend", choices=["ollama", "vllm", "both"], default="ollama",
                        help="Which backend to benchmark")
    parser.add_argument("--users", nargs="+", type=int, default=[1, 5, 10, 25, 50],
                        help="Concurrency levels to test")
    parser.add_argument("--ollama-url", default="http://127.0.0.1:11434/api/chat",
                        help="Ollama API URL")
    parser.add_argument("--ollama-model", default="qwen2.5:14b",
                        help="Ollama model name")
    parser.add_argument("--vllm-url", default="http://127.0.0.1:8000/v1/chat/completions",
                        help="vLLM API URL")
    parser.add_argument("--vllm-model", default="Qwen/Qwen2.5-14B-Instruct",
                        help="vLLM model name")
    parser.add_argument("--vllm-api-key", default="", help="vLLM API key (optional)")
    args = parser.parse_args()

    backends = ["ollama", "vllm"] if args.backend == "both" else [args.backend]
    all_results: List[BenchmarkResult] = []

    for backend in backends:
        print(f"\n{'='*50}")
        print(f"Benchmarking: {backend.upper()}")
        print(f"{'='*50}")

        for n in args.users:
            result = asyncio.run(run_benchmark(
                backend=backend,
                num_users=n,
                ollama_url=args.ollama_url,
                ollama_model=args.ollama_model,
                vllm_url=args.vllm_url,
                vllm_model=args.vllm_model,
                vllm_api_key=args.vllm_api_key,
            ))
            s = result.summary()
            print(f"  {n} users: {s.get('avg_latency', 'FAIL')} avg, "
                  f"{s.get('max_latency', 'N/A')} max, "
                  f"{s['success_rate']} success")
            all_results.append(result)

            # Brief pause between runs to let the GPU cool
            if n < args.users[-1]:
                time.sleep(3)

    print_results_table(all_results)

    # Save detailed results to JSON
    output = []
    for r in all_results:
        output.append({
            "backend": r.backend,
            "num_users": r.num_users,
            "summary": r.summary(),
            "requests": [
                {"success": rr.success, "latency": round(rr.latency, 2),
                 "tokens": rr.tokens_approx, "error": rr.error}
                for rr in r.results
            ],
        })
    with open("/home/aietlab/hopscotch/benchmark_results.json", "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nDetailed results saved to benchmark_results.json")


if __name__ == "__main__":
    main()
