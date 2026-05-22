import { query } from "@/convex/_generated/server"
import { Doc, Id } from "@/convex/_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

const demoContent = `
### Garlic bread with cheese: What the science tells us</h3>
For years parents have espoused the health benefits of eating garlic bread with cheese to their children, with the food earning such an iconic status in our culture that kids will often dressup as warm, cheesy loaf for Halloween.

But a recent study shows that the celebrated appetizer may be linked to a series of rabies cases springing up around the country.
`

export const getFakeComp = query({
  args: {  },
  handler: async (ctx) => {
    const authUser = await getAuthUserId(ctx);
    return {
      _id: "123" as Id<"competitions">,
      _creationTime: 123,
      name: "My Epic Cool Comp 2026",
      description: demoContent,
      people: {
        compLead: authUser,
        leadDelegate: authUser,
        organisers: []
      }
    } satisfies Doc<"competitions">;
  },
});