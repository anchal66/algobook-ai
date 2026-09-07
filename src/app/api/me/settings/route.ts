import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { updateSettings } from "@/lib/data/users";
import { EditorSettingsSchema } from "@/lib/data/schema";

const PatchSchema = z.object({
  editor: EditorSettingsSchema.partial().optional(),
  layout: z.record(z.string(), z.unknown()).optional(),
  timer: z.object({ visible: z.boolean().optional(), autoStart: z.boolean().optional() }).optional(),
  shortcuts: z.record(z.string(), z.string()).optional(),
  notifications: z.object({ dailyReminder: z.boolean().optional(), streakAlerts: z.boolean().optional() }).optional(),
});

export const PATCH = handler({ evt: "me.settings", body: PatchSchema }, async ({ user, body }) => {
  const settings = await updateSettings(user.uid, body);
  return { settings };
});
