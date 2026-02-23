export function ThemeCodeSample() {
	return (
		<div className="overflow-hidden rounded-lg border border-code-border bg-code text-code-foreground">
			<div className="border-b border-code-border bg-code-highlight px-3 py-2 text-xs text-muted-foreground">
				src/sponsorship/placeBid.ts
			</div>
			<pre className="overflow-x-auto p-0 text-xs leading-6">
				<code className="block p-3 font-mono">
					<div className="grid grid-cols-[2rem_1fr] gap-3">
						<span className="text-right text-code-number">1</span>
						<span>
							<span className="text-warning">const</span> minimumBidCents =
							auction.minimumNextBidCents ??{" "}
							<span className="text-code-number">100</span>
						</span>
					</div>
					<div className="grid grid-cols-[2rem_1fr] gap-3 bg-code-selection/60">
						<span className="text-right text-code-number">2</span>
						<span>
							<span className="text-warning">if</span> (amountCents {"<"}{" "}
							minimumBidCents) <span className="text-error">throw</span> new
							Error("Bid too low")
						</span>
					</div>
					<div className="grid grid-cols-[2rem_1fr] gap-3">
						<span className="text-right text-code-number">3</span>
						<span>
							<span className="text-info">await</span> placeBid(&#123;
							auctionId, amountCents &#125;)
						</span>
					</div>
					<div className="grid grid-cols-[2rem_1fr] gap-3">
						<span className="text-right text-code-number">4</span>
						<span>
							<span className="text-warning">return</span> &#123; status:{" "}
							<span className="text-success">"winning"</span> &#125;
						</span>
					</div>
				</code>
			</pre>
		</div>
	);
}
