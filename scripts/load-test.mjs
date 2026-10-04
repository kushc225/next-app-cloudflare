#!/usr/bin/env node

const DEFAULT_URL = "https://next-app-cloudflare.kushc225.workers.dev/";
const DEFAULT_USERS = 200;
const DEFAULT_DURATION_SECONDS = 30;
const DEFAULT_THINK_TIME_MS = 1_000;
const REQUEST_TIMEOUT_MS = 10_000;

function positiveNumber(value, name, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

const [urlArg, usersArg, durationArg, thinkTimeArg, ...extraArgs] =
  process.argv.slice(2);

if (extraArgs.length > 0) {
  console.error(
    "Usage: node scripts/load-test.mjs [url] [users] [duration-seconds] [think-time-ms]",
  );
  process.exit(2);
}

let target;
let users;
let durationSeconds;
let thinkTimeMs;

try {
  target = new URL(urlArg ?? DEFAULT_URL);
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("URL must use http or https.");
  }
  users = positiveNumber(usersArg, "users", DEFAULT_USERS);
  durationSeconds = positiveNumber(
    durationArg,
    "duration-seconds",
    DEFAULT_DURATION_SECONDS,
  );
  thinkTimeMs = positiveNumber(
    thinkTimeArg,
    "think-time-ms",
    DEFAULT_THINK_TIME_MS,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
}

const durationMs = durationSeconds * 1_000;
const controller = new AbortController();
const startTime = performance.now();
const deadline = startTime + durationMs;
const statusCounts = new Map();
const latencies = [];
let requests = 0;
let requestErrors = 0;

const stopTimer = setTimeout(
  () => controller.abort(new DOMException("Test duration elapsed", "AbortError")),
  durationMs,
);

async function virtualUser() {
  while (!controller.signal.aborted && performance.now() < deadline) {
    const requestStarted = performance.now();
    try {
      const response = await fetch(target, {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        ]),
      });
      await response.arrayBuffer();
      requests += 1;
      latencies.push(performance.now() - requestStarted);
      statusCounts.set(
        response.status,
        (statusCounts.get(response.status) ?? 0) + 1,
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        requestErrors += 1;
        console.error(
          `Request failed: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    const remainingMs = deadline - performance.now();
    if (remainingMs <= 0 || controller.signal.aborted) break;
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(thinkTimeMs, remainingMs)),
    );
  }
}

console.log(
  `Starting ${users} virtual users for ${durationSeconds}s against ${target.href} (think time: ${thinkTimeMs}ms).`,
);

await Promise.all(Array.from({ length: users }, () => virtualUser()));
clearTimeout(stopTimer);

const elapsedSeconds = (performance.now() - startTime) / 1_000;
const sortedLatencies = latencies.toSorted((a, b) => a - b);
const percentile = (p) =>
  sortedLatencies.length === 0
    ? null
    : sortedLatencies[Math.ceil((p / 100) * sortedLatencies.length) - 1];
const average =
  sortedLatencies.length === 0
    ? null
    : sortedLatencies.reduce((sum, latency) => sum + latency, 0) /
      sortedLatencies.length;

console.log("\nLoad test summary");
console.log(`Elapsed: ${elapsedSeconds.toFixed(2)}s`);
console.log(`HTTP responses: ${requests}`);
console.log(`Request errors/timeouts: ${requestErrors}`);
console.log(`Throughput: ${(requests / elapsedSeconds).toFixed(2)} responses/s`);
console.log(
  `Status codes: ${
    [...statusCounts]
      .sort(([a], [b]) => a - b)
      .map(([status, count]) => `${status}: ${count}`)
      .join(", ") || "none"
  }`,
);
console.log(
  `Latency ms (avg/p50/p95/p99): ${
    average === null
      ? "no completed requests"
      : `${average.toFixed(1)} / ${percentile(50).toFixed(1)} / ${percentile(95).toFixed(1)} / ${percentile(99).toFixed(1)}`
  }`,
);
