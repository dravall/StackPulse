import { promises as dns } from "dns";
import ipaddr from "ipaddr.js";

const BLOCKED_RANGES = new Set([
    "private",
    "loopback",
    "linkLocal",
    "uniqueLocal",
    "reserved",
    "carrierGradeNat",
    "broadcast",
]);

export async function isPrivateOrInternalTarget(url: string): Promise<boolean> {
    let hostname: string;
    try {
        hostname = new URL(url).hostname;
    } catch {
        return true;
    }

    let addresses: { address: string }[];
    try {
        addresses = await dns.lookup(hostname, { all: true });
    } catch {
        // Doesn't resolve at all (yet) -- nothing routable to reach, so no
        // SSRF risk from this lookup. The actual fetch will fail on its own
        // if that's still true when the worker tries it.
        return false;
    }

    return addresses.some(({ address }) => {
        if (!ipaddr.isValid(address)) {
            return true;
        }
        const range = ipaddr.process(address).range();
        return BLOCKED_RANGES.has(range);
    });
}
