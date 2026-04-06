import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";
import { Injectable } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";

@Injectable()
export class RtStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: process.env.JWT_REFRESH_SECRET!,
            passReqToCallback: true,
        });
    }

    validate(req: Request, payload: any) {
        const authHeader = req.get('authorization');
        
        if (!authHeader) {
            throw new ForbiddenException('Refresh token missing');
        }

        const refreshToken = authHeader.replace('Bearer', '').trim();
        return { ...payload, id: payload.sub, refreshToken };
    }
}