import { defineApp } from "convex/server";
import crons from "@convex-dev/crons/convex.config";
import workpool from "@convex-dev/workpool/convex.config";
import sponsorAuth from "./sponsorship/auth/component/sponsorAuth/convex.config";

const app = defineApp();
app.use(crons);
app.use(workpool, { name: "emailWorkpool" });
app.use(sponsorAuth);

export default app;
