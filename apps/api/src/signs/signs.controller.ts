import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  STICKER_MAX_BYTES,
  type CustomSignModelsResponse,
  type MySignsResponse,
  type UserSignSummary,
} from '@hand-sign/shared';
import { SessionGuard, type AuthedRequest } from '../auth/session.guard.js';
import { SignsService } from './signs.service.js';

@Controller('signs')
@UseGuards(SessionGuard)
export class SignsController {
  constructor(private readonly signs: SignsService) {}

  @Get('mine')
  mine(@Req() req: AuthedRequest): Promise<MySignsResponse> {
    return this.signs.listMine(req.user.id);
  }

  @Get('mine/models')
  mineModels(@Req() req: AuthedRequest): Promise<CustomSignModelsResponse> {
    return this.signs.modelsMine(req.user.id);
  }

  // multipart: file "sticker" + field "data" (CreateSignRequest JSON)
  @Post()
  @UseInterceptors(
    FileInterceptor('sticker', { limits: { fileSize: STICKER_MAX_BYTES, files: 1, fields: 1, fieldSize: 1024 * 1024 } }),
  )
  create(
    @Req() req: AuthedRequest,
    @Body('data') data: unknown,
    @UploadedFile() sticker: Express.Multer.File | undefined,
  ): Promise<UserSignSummary> {
    return this.signs.create(req.user, data, sticker?.buffer);
  }

  // multipart: optional file "sticker" + field "data" (UpdateSignRequest JSON)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('sticker', { limits: { fileSize: STICKER_MAX_BYTES, files: 1, fields: 1, fieldSize: 4096 } }))
  update(
    @Req() req: AuthedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('data') data: unknown,
    @UploadedFile() sticker: Express.Multer.File | undefined,
  ): Promise<UserSignSummary> {
    return this.signs.update(req.user.id, id, data, sticker?.buffer);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.signs.remove(req.user.id, id);
  }
}
