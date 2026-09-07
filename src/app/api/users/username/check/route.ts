import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { isUsernameAvailable } from "@/lib/data/users";

export const GET = handler(
  { evt: "username.check", query: z.object({ u: z.string().trim().toLowerCase().min(1).max(30) }) },
  async ({ query }) => ({ username: query.u, available: await isUsernameAvailable(query.u) }),
);
