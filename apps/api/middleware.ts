import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing or malformed Authorization header" });
        return;
    }
    const token = header.slice("Bearer ".length);
    try {
        let data = jwt.verify(token, process.env.JWT_SECRET!);
        req.userId = data.sub as string;
        next();
    } catch(e) {
        if (e instanceof jwt.TokenExpiredError) {
            res.status(401).json({ error: "Token expired" });
            return;
        }
        res.status(401).json({ error: "Invalid token" });
    }
}