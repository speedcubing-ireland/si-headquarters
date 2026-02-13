import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { createSponsorAuth, sponsorAuthComponent } from "./sponsorAuthServer";

const http = httpRouter();

auth.addHttpRoutes(http);
sponsorAuthComponent.registerRoutes(http, createSponsorAuth, {
	cors: {
		allowedOrigins: ["http://localhost:5173", "http://localhost:3000"],
	},
});

export default http;
