import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),
    PORT: z.coerce.number().default(3001),
    FRONTEND_URL: z.string().url().default("http://localhost:3000"),
});

export const env = envSchema.parse(process.env);
