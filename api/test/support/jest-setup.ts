import 'reflect-metadata';
import { Logger } from '@nestjs/common';

// Keep test output readable; set TEST_LOGS=1 to see application logs while debugging.
if (process.env.TEST_LOGS !== '1') {
  Logger.overrideLogger(false);
}
