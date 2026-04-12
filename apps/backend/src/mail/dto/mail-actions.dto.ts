import { IsArray, IsBoolean, IsEmail, IsNotEmpty, IsString, IsIn, ArrayMaxSize, ArrayNotEmpty, MaxLength } from 'class-validator';

export class BulkMailDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100, {message: "You can't delete more than 100 Mails at once"})
  @IsString({ each: true })
  mailIds: string[];
}

export class MarkReadDto {
  @IsBoolean()
  @IsNotEmpty()
  isRead: boolean;
}

export class BulkMarkReadDto extends BulkMailDto {
  @IsBoolean()
  @IsNotEmpty()
  isRead: boolean;
}

export class BlockSenderDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254, {message: "Email-adress can't be longer than 254 characters"})
  email: string;
}

export class MoveMailDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['inbox', 'archive', 'spam'])
  folder: string;
}


export class BulkMoveMailDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  mailIds: string[];

  @IsString()
  @IsNotEmpty()
  @IsIn(['inbox', 'archive', 'spam'])
  folder: string;
}