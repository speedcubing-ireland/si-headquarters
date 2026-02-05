import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import Unfonts from "unplugin-fonts/vite";

export default defineConfig({
	plugins: [
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
		react(),
		tailwindcss(),
		Unfonts({
			google: {
				families: [
					{
						name: "Montserrat",
						styles: "wght@400;500;600;700",
					},
					{
						name: "Merriweather",
						styles: "ital,wght@0,400;0,700;1,400;1,700",
					},
					{
						name: "Source Code Pro",
						styles: "wght@400;500;600;700",
					},
				],
			},
		}),
	],
	resolve: {
		alias: {
			"@/convex": path.resolve(__dirname, "./convex"),
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
