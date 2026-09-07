import { handler } from "@/lib/api/handler";
import * as templates from "@/lib/data/templates";
import { serialize } from "@/lib/data/schema";

export const GET = handler({ evt: "templates.list" }, async () => ({ templates: serialize(await templates.list()) }));
