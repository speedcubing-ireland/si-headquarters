import { mutation } from "@/convex/_generated/server"
import { v } from "convex/values";

export const setCompDates = mutation({
  args: {
    id: v.id("competitions"),
    from: v.nullable(v.string()),
    to: v.nullable(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("competitions", args.id, {
      compDates: {
        from: args.from,
        to: args.to,
      }
    });
    return;
  },
});

export const setCompDetails = mutation({
  args: {
    id: v.id("competitions"),
    name: v.string(),
    description: v.nullable(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();

    if (!name) {
      throw new Error("Competition name is required");
    }

    await ctx.db.patch("competitions", args.id, {
      name,
      description: args.description,
    });
    return;
  },
});
