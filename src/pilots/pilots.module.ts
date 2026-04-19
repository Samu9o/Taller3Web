import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Pilot, PilotSchema } from './entities/pilot.entity';
import { PilotsController } from './pilots.controller';
import { PilotsService } from './pilots.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Pilot.name, schema: PilotSchema }]),
  ],
  controllers: [PilotsController],
  providers: [PilotsService],
})
export class PilotsModule {}
