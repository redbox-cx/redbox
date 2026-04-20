import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { OffsetPaginationQueryDto, toBoolean } from './common.dto';

export class AdminMailsQueryDto extends OffsetPaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: "senderId can't be longer than 50 characters" })
  senderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Search can't be longer than 100 characters" })
  search?: string;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ message: 'isBroadcast must be true or false' })
  isBroadcast?: boolean;
}

export class AdminMailAttachmentDto {
  @IsString()
  @IsNotEmpty({ message: "Attachment name can't be empty" })
  @MaxLength(255, { message: "Attachment name can't be longer than 255 characters" })
  name: string;

  @Type(() => Number)
  @IsInt({ message: 'Attachment size must be an integer' })
  @Min(0, { message: "Attachment size can't be negative" })
  size: number;

  @IsString()
  @IsNotEmpty({ message: "Attachment type can't be empty" })
  @MaxLength(100, { message: "Attachment type can't be longer than 100 characters" })
  type: string;
}

export class SendAdminMailDto {
  @IsString()
  @IsNotEmpty({ message: "senderId can't be empty" })
  @MaxLength(50, { message: "senderId can't be longer than 50 characters" })
  senderId: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:\*|[^@\s]+)@redbox\.cx$/i, {
    message: "to must be either *@redbox.cx or username@redbox.cx",
  })
  to?: string;

  // Legacy fields kept for compatibility with the current admin panel payload.
  @IsArray()
  @ArrayUnique()
  @IsEmail({}, { each: true, message: 'Each recipient must be a valid email address' })
  recipients: string[] = [];

  @IsOptional()
  @IsBoolean()
  isBroadcast?: boolean;

  @IsString()
  @IsNotEmpty({ message: "Subject can't be empty" })
  @MaxLength(255, { message: "Subject can't be longer than 255 characters" })
  subject: string;

  @IsString()
  @IsNotEmpty({ message: "Body can't be empty" })
  @MaxLength(100000, { message: "Body can't be longer than 100000 characters" })
  body: string;

  @IsBoolean()
  isHtml: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: "Template can't be longer than 100 characters" })
  template?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10, { message: "You can't attach more than 10 files" })
  @ValidateNested({ each: true })
  @Type(() => AdminMailAttachmentDto)
  attachments: AdminMailAttachmentDto[] = [];
}

export class RecallAdminMailDto {
  @IsString()
  @IsNotEmpty({ message: "Reason can't be empty" })
  @MaxLength(500, { message: "Reason can't be longer than 500 characters" })
  reason: string;
}
