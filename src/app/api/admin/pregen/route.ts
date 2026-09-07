import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import * as jobs from "@/lib/data/jobs";
import { serialize } from "@/lib/data/schema";
import { collectPregenJob, computeDeficits, submitPregenBatch } from "@/jobs/pregen";

export const maxDuration = 300;

const BodySchema = z.object({
  action: z.enum(["status", "deficits", "submit", "collect"]),
  jobId: z.string().optional(),
  maxRequests: z.number().int().min(1).max(500).optional(),
  poolMin: z.number().int().min(0).max(50).optional(),
  companies: z.array(z.string().regex(/^[a-z]+$/)).max(6).optional(),
  templateLimit: z.number().int().min(1).max(100).optional(),
  chunk: z.number().int().min(1).max(50).optional(),
});

/** Admin trigger for pre-generation (Module 02 §3.6). */
export const POST = handler({ evt: "admin.pregen", admin: true, body: BodySchema }, async ({ body }) => {
  switch (body.action) {
    case "status":
      return { jobs: serialize(await jobs.listRecentPregenJobs()) };
    case "deficits": {
      const d = await computeDeficits(body.poolMin);
      return { poolMin: body.poolMin, cells: d, totalNeed: d.reduce((a, x) => a + x.need, 0) };
    }
    case "submit": {
      const job = await submitPregenBatch({ maxRequests: body.maxRequests, poolMin: body.poolMin, companies: body.companies, templateLimit: body.templateLimit });
      return { job: job ? serialize(job) : null, message: job ? `Submitted batch ${job.batchId} with ${job.requested} requests` : "Nothing to generate — every cell is at pool minimum" };
    }
    case "collect": {
      const list = body.jobId ? [await jobs.getPregenJob(body.jobId)].filter(Boolean) : await jobs.listOpenPregenJobs();
      if (!list.length) throw ApiError.notFound("No open pre-generation job");
      const out = [];
      for (const job of list) out.push({ id: job!.id, ...(await collectPregenJob(job!, body.chunk)) });
      return { collected: out };
    }
  }
});
