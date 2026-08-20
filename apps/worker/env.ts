import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
    REGION_ID: z.string().min(1, "REGION_ID is required"),
    WORKER_ID: z.string().min(1, "WORKER_ID is required"),
    DATABASE_URL: z.string().url("DATABASE_URL must be a valid connection string"),
});

export const env = envSchema.parse(process.env);
