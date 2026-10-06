import { Controller, Get } from '@nestjs/common';
import { SIGN_PACK_SCHEMA_VERSION } from '@hand-sign/shared';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', signPackSchemaVersion: SIGN_PACK_SCHEMA_VERSION };
  }
}
