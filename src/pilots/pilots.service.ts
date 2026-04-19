import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { CreatePilotDto } from './dto/create-pilot.dto';
import { UpdatePilotDto } from './dto/update-pilot.dto';
import { Pilot } from './entities/pilot.entity';

@Injectable()
export class PilotsService {
  private readonly logger = new Logger('Pilots');

  constructor(
    @InjectModel(Pilot.name)
    private readonly pilotsModel: Model<Pilot>,
  ) {}

  async findAll() {
    return this.pilotsModel.find();
  }

  async findOne(id: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(`Id is not a valid object id`);
    }

    const pilot = await this.pilotsModel.findById(id);

    if (!pilot) {
      throw new NotFoundException(`Pilot with id ${id} not found`);
    }

    return pilot;
  }

  async create(createPilotDto: CreatePilotDto) {
    createPilotDto.nombre = createPilotDto.nombre.toLowerCase();

    try {
      const pilot = await this.pilotsModel.create(createPilotDto);
      return pilot;
    } catch (error) {
      this.handleException(error);
    }
  }

  async update(id: string, updatePilotDto: UpdatePilotDto) {
    if (updatePilotDto.nombre) {
      updatePilotDto.nombre = updatePilotDto.nombre.toLowerCase();
    }

    const pilot = await this.findOne(id);

    try {
      await pilot.updateOne(updatePilotDto);
      return { ...pilot.toJSON(), ...updatePilotDto };
    } catch (error) {
      this.handleException(error);
    }
  }

  async remove(id: string) {
    const { deletedCount } = await this.pilotsModel.deleteOne({ _id: id });

    if (deletedCount === 0) {
      throw new BadRequestException(`Pilot with id ${id} not found`);
    }

    return;
  }

  private handleException(error: any) {
    if (error.code === 11000) {
      throw new BadRequestException(
        `Pilot exists in db ${JSON.stringify(error.keyValue)}`,
      );
    }
    this.logger.error(error);
    throw new InternalServerErrorException(
      `Can't process request, check server logs`,
    );
  }
}
