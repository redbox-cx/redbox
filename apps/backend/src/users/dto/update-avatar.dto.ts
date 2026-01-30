import { IsEnum, IsNotEmpty } from "class-validator";
import { UserAvatar } from "@prisma/client";

export class UpdateAvatarDto {
    @IsEnum(UserAvatar, {message: "This avatar doesn't exist"})
    @IsNotEmpty()
    avatar: UserAvatar;
}