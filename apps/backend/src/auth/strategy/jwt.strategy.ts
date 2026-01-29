import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from 'passport-jwt'
import { PrismaService } from "src/prisma.service";



@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy){

    constructor(private readonly prismaService:PrismaService){
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_ACCESS_SECRET!,
        })
    }


    async validate(payload:{ sub: number, username:string, sessionKey: string }){
        const user = await this.prismaService.user.findUnique({
            where:{
                id: payload.sub
            }
        });

        if (!user || user.sessionKey !== payload.sessionKey) {
            throw new UnauthorizedException('Access Denied (Session Expired)')
        }
        return user;
    }
}   