import axios, { AxiosError } from "axios";
import { env } from "./env";
import { ensureConsumerGroup, xAckBulk, xReadGroup } from "redisstream/client";
import { prismaClient } from "store/client";
import { isPrivateOrInternalTarget } from "url-safety/client";

const WORKER_ID = env.WORKER_ID;

async function main() {
    const region = await prismaClient.region.findUniqueOrThrow({
        where: { name: env.REGION_SLUG }
    });
    const REGION_ID = region.id;

    await ensureConsumerGroup(REGION_ID);

    while(1) {
        const response = await xReadGroup(REGION_ID, WORKER_ID);

        if (!response) {
            continue;
        }

        let promises = response.map(({message}) => fetchWebsite(message.url, message.id, REGION_ID))
        await Promise.all(promises);
        console.log(promises.length);

        await xAckBulk(REGION_ID, response.map(({id}) => id));
    }
}

async function recordTick(websiteId: string, regionId: string, responseTimeMs: number, status: "Up" | "Down" | "Unknown", errorMessage?: string) {
    await prismaClient.website_tick.create({
        data: {
            response_time_ms: responseTimeMs,
            status,
            region_id: regionId,
            website_id: websiteId,
            error_message: errorMessage ?? null
        }
    });
}

async function fetchWebsite(url: string, websiteId: string, regionId: string) {
    const startTime = Date.now();

    if (await isPrivateOrInternalTarget(url)) {
        await recordTick(websiteId, regionId, Date.now() - startTime, "Down", "Blocked: target resolves to a private or internal address");
        return;
    }

    try {
        await axios.get(url, { timeout: 10_000, maxRedirects: 0 });
        await recordTick(websiteId, regionId, Date.now() - startTime, "Up");
    } catch (e) {
        const responseTimeMs = Date.now() - startTime;
        if (e instanceof AxiosError && e.response) {
            await recordTick(websiteId, regionId, responseTimeMs, "Down", `HTTP ${e.response.status}`);
        } else {
            const reason = e instanceof AxiosError ? (e.code ?? e.message) : "Unknown error";
            await recordTick(websiteId, regionId, responseTimeMs, "Unknown", reason);
        }
    }
}

main();
