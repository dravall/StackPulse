import "./env";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import express from "express"
import cors from "cors";
import rateLimit from "express-rate-limit";
const app = express();
import { prismaClient } from "store/client";
import { AuthInput, WebsiteInput } from "./types";
import { authMiddleware } from "./middleware";
import { env } from "./env";

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    // Key by IP + username rather than IP alone, so repeated signup/signin
    // attempts against ONE account are throttled without capping how many
    // distinct accounts a single IP can create/use (e.g. in tests, or NAT'd offices).
    keyGenerator: (req) => `${req.ip}:${(req.body as { username?: string } | undefined)?.username ?? "unknown"}`,
});

app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json());

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

app.post("/website", authMiddleware, async (req, res) => {
    const data = await WebsiteInput.safeParseAsync(req.body);
    if (!data.success) {
        res.status(400).json({ error: data.error.issues[0]?.message ?? "Invalid input" });
        return;
    }

    try {
        const website = await prismaClient.website.create({
            data: {
                url: data.data.url,
                time_added: new Date(),
                user_id: req.userId!
            }
        })

        res.json({
            id: website.id
        })
    } catch(e: any) {
        if (e?.code === "P2002") {
            res.status(409).json({ error: "You're already monitoring this URL" });
            return;
        }
        throw e;
    }
});

app.get("/websites", authMiddleware, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const websites = await prismaClient.website.findMany({
        where: { user_id: req.userId! },
        orderBy: { id: "asc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
            ticks: {
                orderBy: [{ createdAt: 'desc' }],
                take: 1
            }
        }
    });

    const hasMore = websites.length > limit;
    const page = hasMore ? websites.slice(0, limit) : websites;

    res.json({
        websites: page.map(w => ({
            id: w.id,
            url: w.url,
            latestTick: w.ticks[0] ?? null
        })),
        nextCursor: hasMore ? page[page.length - 1]!.id : null
    });
});

app.get("/status/:websiteId", authMiddleware, async (req, res) => {
    const website = await prismaClient.website.findFirst({
        where: {
            user_id: req.userId!,
            id: req.params.websiteId,
        },
        include: {
            ticks: {
                orderBy: [{
                    createdAt: 'desc',
                }],
                take: 1
            }
        }
    })

    if (!website) {
        res.status(404).json({
            error: "Not found"
        })
        return;
    }

    res.json({
        url: website.url,
        id: website.id,
        user_id: website.user_id,
        latestTick: website.ticks[0] ?? null
    })

})

app.patch("/website/:id", authMiddleware, async (req, res) => {
    const data = await WebsiteInput.safeParseAsync(req.body);
    if (!data.success) {
        res.status(400).json({ error: data.error.issues[0]?.message ?? "Invalid input" });
        return;
    }

    try {
        const result = await prismaClient.website.updateMany({
            where: { id: req.params.id, user_id: req.userId! },
            data: { url: data.data.url }
        });

        if (result.count === 0) {
            res.status(404).json({ error: "Not found" });
            return;
        }

        res.json({ id: req.params.id, url: data.data.url });
    } catch (e: any) {
        if (e?.code === "P2002") {
            res.status(409).json({ error: "You're already monitoring this URL" });
            return;
        }
        throw e;
    }
});

app.delete("/website/:id", authMiddleware, async (req, res) => {
    const result = await prismaClient.website.deleteMany({
        where: { id: req.params.id, user_id: req.userId! }
    });

    if (result.count === 0) {
        res.status(404).json({ error: "Not found" });
        return;
    }

    res.status(204).send();
});

app.post("/user/signup", authLimiter, async (req, res) => {
    const data = AuthInput.safeParse(req.body);
    if (!data.success) {
        res.status(400).json({ error: data.error.issues[0]?.message ?? "Invalid input" });
        return;
    }

    try {
        const user = await prismaClient.user.create({
            data: {
                username: data.data.username,
                password: await bcrypt.hash(data.data.password, 12)
            }
        })
        res.json({
            id: user.id
        })
    } catch(e: any) {
        if (e?.code === "P2002") {
            res.status(409).json({ error: "Username already taken" });
            return;
        }
        throw e;
    }
})

app.post("/user/signin", authLimiter, async (req, res) => {
    const data = AuthInput.safeParse(req.body);
    if (!data.success) {
        res.status(400).json({ error: data.error.issues[0]?.message ?? "Invalid input" });
        return;
    }

    const user = await prismaClient.user.findFirst({
        where: {
            username: data.data.username
        }
    })

    if (!user || !(await bcrypt.compare(data.data.password, user.password))) {
        res.status(401).json({ error: "Invalid username or password" });
        return;
    }

    const token = jwt.sign({
        sub: user.id
    }, env.JWT_SECRET, { expiresIn: "1h" })

    res.json({
        jwt: token
    })
})

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err);
    res.status(err?.status ?? 500).json({ error: err?.message ?? "Internal Server Error" });
});

app.listen(env.PORT);
