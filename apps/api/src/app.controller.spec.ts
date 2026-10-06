import { Test, TestingModule } from '@nestjs/testing';
import { SIGN_PACK_SCHEMA_VERSION } from '@hand-sign/shared';
import { AppController } from './app.controller.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports ok with the shared schema version', () => {
      expect(appController.health()).toEqual({
        status: 'ok',
        signPackSchemaVersion: SIGN_PACK_SCHEMA_VERSION,
      });
    });
  });
});
