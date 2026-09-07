/** Minimal Server-Sent Events helper for route handlers (generation stages, tutor chat). */
export type SseSend = (event: string, data: unknown) => void;

export function sseResponse(run: (send: SseSend) => Promise<void>, init: { headers?: Record<string, string> } = {}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send: SseSend = (event, data) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); } catch { closed = true; }
      };
      const heartbeat = setInterval(() => { if (!closed) { try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { closed = true; } } }, 15_000);
      try {
        await run(send);
      } catch (e) {
        send("error", { code: "INTERNAL", message: (e as Error)?.message ?? "Unexpected error" });
      } finally {
        clearInterval(heartbeat);
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no", ...init.headers },
  });
}
