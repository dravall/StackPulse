import { createClient } from "redis";

const client = await createClient()
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();

type WebsiteEvent = {url: string, id: string}
type MessageType = {
    id: string,
    message: {
        url: string,
        id: string
    }
}

// node-redis types XREADGROUP's reply as a generic union; with the default RESP2
// protocol it is an array of { name, messages } entries, one per stream read.
type StreamReadReply = { name: string, messages: MessageType[] }[] | null;

const STREAM_NAME = "betteruptime:website";

export async function xAddBulk(websites: WebsiteEvent[]) {
    if (websites.length === 0) {
        return;
    }
    const pipeline = client.multi();
    for (const { url, id } of websites) {
        pipeline.xAdd(STREAM_NAME, '*', { url, id });
    }
    await pipeline.exec();
}

export async function ensureConsumerGroup(consumerGroup: string) {
    try {
        await client.xGroupCreate(STREAM_NAME, consumerGroup, '0', { MKSTREAM: true });
    } catch (e: any) {
        if (!String(e?.message).includes('BUSYGROUP')) {
            throw e;
        }
    }
}

export async function xReadGroup(consumerGroup: string, workerId: string): Promise<MessageType[] | undefined> {

    const res = await client.xReadGroup(
        consumerGroup, workerId, {
            key: STREAM_NAME,
            id: '>'
        }, {
        'COUNT': 5,
        'BLOCK': 5000
        }
    );

    return (res as StreamReadReply)?.[0]?.messages;
}

export async function xAckBulk(consumerGroup: string, eventIds: string[]) {
    if (eventIds.length === 0) {
        return;
    }
    const pipeline = client.multi();
    for (const eventId of eventIds) {
        pipeline.xAck(STREAM_NAME, consumerGroup, eventId);
    }
    await pipeline.exec();
}