import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { updateUsername } from "@/lib/data/users";
import { UsernameSchema } from "@/lib/data/schema";

export const POST = handler(
  { evt: "me.username", body: z.object({ username: z.string().trim().toLowerCase().pipe(UsernameSchema) }) },
  async ({ user, body }) => updateUsername(user.uid, body.username),
);
