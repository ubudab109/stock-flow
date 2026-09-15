import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'staff@stockflow.test' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'Passw0rd!' })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @MaxLength(72, { message: 'password must be at most 72 characters long' })
  password!: string;
}
