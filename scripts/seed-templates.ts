/** Seeds templates/{company} + items from templates/*.md.   npm run db:seed:templates */
import "./_bootstrap";
import { seed } from "../src/lib/data/templates";

seed().then((counts) => {
  console.log("Seeded templates:", counts);
}).catch((e) => { console.error(e.message); process.exit(1); });
