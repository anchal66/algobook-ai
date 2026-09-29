import { handler } from "@/lib/api/handler";
import { consent } from "@/lib/rooms/service";

export const POST = handler({ evt: "rooms.consent" }, async ({ user, params }) => { return consent(user, params.id); });
