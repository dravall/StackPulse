import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        res.status(403).send("");
        return;
    }
    const token = header.slice("Bearer ".length);
    try {
        let data = jwt.verify(token, process.env.JWT_SECRET!);
        req.userId = data.sub as string;
        next();
    } catch(e) {
        console.log(e);
        res.status(403).send("");
    }
}