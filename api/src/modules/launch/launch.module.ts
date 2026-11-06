import { Module } from '@nestjs/common';
import { HustleCheckService } from './hustle-check.service';
import { AdminLaunchController, LaunchController } from './launch.controller';
import { StoriesService } from './stories.service';
import { WaitlistService } from './waitlist.service';

/** Pre-launch website features: waitlist, Hustle Check, Wall of Hustle (ADR 0009). */
@Module({
  controllers: [LaunchController, AdminLaunchController],
  providers: [WaitlistService, HustleCheckService, StoriesService],
})
export class LaunchModule {}
