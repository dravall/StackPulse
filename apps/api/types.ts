import { z } from "zod";
import { isPrivateOrInternalTarget } from "url-safety/client";

export const AuthInput = z.object({
    username: z.string(),
    password: z.string().min(8, "Password must be at least 8 characters")
})

export const WebsiteInput = z.object({
    url: z.string()
        .url()
        .refine(
            (u) => ["http:", "https:"].includes(new URL(u).protocol),
            { message: "URL must use http or https" }
        )
        .refine(
            async (u) => !(await isPrivateOrInternalTarget(u)),
            { message: "URL must not resolve to a private or internal address" }
        )
})
