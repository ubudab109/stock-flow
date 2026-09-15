import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module.js';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter.js';
import { validationExceptionFactory } from '../../src/common/pipes/validation-exception-factory.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { TestPrismaService } from './test-prisma.service.js';

export async function bootstrapTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useClass(TestPrismaService)
    .compile();
  const app = moduleFixture.createNestApplication();

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();
  return app;
}
