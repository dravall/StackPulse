import { z } from "zod";

export const AuthInput = z.object({
    username: z.string(),
    password: z.string()
})

export const WebsiteInput = z.object({
    url: z.string().url().refine(
        (u) => ["http:", "https:"].includes(new URL(u).protocol),
        { message: "URL must use http or https" }
    )
})
