import { defineApp } from "convex/server";
import crons from "@convex-dev/crons/convex.config";
import sponsorAuth from "./sponsorAuth/convex.config";

const app = defineApp();
app.use(crons);
app.use(sponsorAuth);

export default app;
