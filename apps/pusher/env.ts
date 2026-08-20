import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),
});

export const env = envSchema.parse(process.env);
