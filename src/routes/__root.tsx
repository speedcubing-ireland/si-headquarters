import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Layout } from "@/components/layout/layout";

const RootLayout = () => (
	<Layout>
		<Outlet />
	</Layout>
);

export const Route = createRootRoute({ component: RootLayout });
