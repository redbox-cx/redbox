import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategy/jwt.strategy";
import { UsersModule } from "../users/users.module";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";

@Module({
    imports: [
        UsersModule,
        PassportModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'secret',
            signOptions: {
                expiresIn: '7d',
            },
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy],
})
export class AuthModule {}