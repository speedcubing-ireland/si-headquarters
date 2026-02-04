import React from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

interface ErrorBoundaryProps {
	children: React.ReactNode;
	fallback?: React.ComponentType<{
		error: Error | null;
		resetError: () => void;
	}>;
	onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends React.Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
		};
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return {
			hasError: true,
			error,
		};
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		this.props.onError?.(error, errorInfo);
		console.error("ErrorBoundary caught an error:", error, errorInfo);
	}

	resetError = () => {
		this.setState({
			hasError: false,
			error: null,
		});
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				const Fallback = this.props.fallback;
				return (
					<Fallback error={this.state.error} resetError={this.resetError} />
				);
			}

			return (
				<DefaultErrorFallback
					error={this.state.error}
					resetError={this.resetError}
				/>
			);
		}

		return this.props.children;
	}
}

function DefaultErrorFallback({
	error,
	resetError,
}: {
	error: Error | null;
	resetError: () => void;
}) {
	return (
		<div className="flex h-full w-full items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<div className="flex items-center gap-2">
						<AlertTriangle className="size-5 text-destructive" />
						<CardTitle>Something went wrong</CardTitle>
					</div>
					<CardDescription>
						An unexpected error occurred. Please try refreshing the page.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{error && (
						<div className="rounded-md bg-muted p-3">
							<pre className="text-xs text-muted-foreground">
								{error.message}
							</pre>
						</div>
					)}
					<div className="flex gap-2">
						<Button onClick={resetError} variant="outline">
							Try again
						</Button>
						<Button
							onClick={() => {
								window.location.reload();
							}}
						>
							Refresh page
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
