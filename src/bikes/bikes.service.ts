import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { Bike } from './entities/bike.entity';
import { CreateBikeDto } from './dto/create-bike.dto';
import { UpdateBikeDto } from './dto/update-bike.dto';

@Injectable()
export class BikesService {
  private readonly logger = new Logger('Bikes');

  constructor(
    @InjectModel(Bike.name)
    private readonly bikesModel: Model<Bike>,
  ) {}

  // TODO: Implement findAll
  // Should return all bikes from the database
  // Hint: look at how CarsService.findAll() does it
  async findAll() {
    return this.bikesModel.find();
  }

  // TODO: Implement findOne
  // 1. Validate that `id` is a valid ObjectId using isValidObjectId()
  //    If not, throw BadRequestException
  // 2. Find the bike in the DB with findById(id)
  // 3. If it does not exist, throw NotFoundException
  // 4. Return the found bike
  async findOne(id: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException(`Id is not a valid object id`);
    }

    const bike = await this.bikesModel.findById(id);

    if (!bike) {
      throw new NotFoundException(`Bike with id ${id} not found`);
    }

    return bike;
  }

  // TODO: Implement create
  // 1. Normalize createBikeDto.marca to lowercase with .toLowerCase()
  // 2. Inside a try/catch, save to DB with this.bikesModel.create(...)
  // 3. Return the created bike
  // 4. In the catch, call this.handleException(error)
  async create(createBikeDto: CreateBikeDto) {
    createBikeDto.marca = createBikeDto.marca.toLowerCase();

    try {
      const bike = await this.bikesModel.create(createBikeDto);
      return bike;
    } catch (error) {
      this.handleException(error);
    }
  }

  // TODO: Implement update
  // 1. If updateBikeDto.marca exists, normalize it to lowercase
  // 2. Use findOne(id) to verify the bike exists (reuses its validation logic)
  // 3. Inside a try/catch, call bike.updateOne(updateBikeDto)
  // 4. Return the merged object: { ...bike.toJSON(), ...updateBikeDto }
  // 5. In the catch, call this.handleException(error)
  async update(id: string, updateBikeDto: UpdateBikeDto) {
    if (updateBikeDto.marca) {
      updateBikeDto.marca = updateBikeDto.marca.toLowerCase();
    }

    const bike = await this.findOne(id);

    try {
      await bike.updateOne(updateBikeDto);
      return { ...bike.toJSON(), ...updateBikeDto };
    } catch (error) {
      this.handleException(error);
    }
  }

  // TODO: Implement remove
  // 1. Call this.bikesModel.deleteOne({ _id: id })
  // 2. Destructure { deletedCount } from the result
  // 3. If deletedCount === 0, throw BadRequestException
  // 4. Return with no value (return;)
  async remove(id: string) {
    const { deletedCount } = await this.bikesModel.deleteOne({ _id: id });

    if (deletedCount === 0) {
      throw new BadRequestException(`Bike with id ${id} not found`);
    }

    return;
  }

  // This method is already implemented — use it in create and update
  private handleException(error: any) {
    if (error.code === 11000) {
      throw new BadRequestException(
        `Bike exists in db ${JSON.stringify(error.keyValue)}`,
      );
    }
    this.logger.error(error);
    throw new InternalServerErrorException(
      `Can't process request, check server logs`,
    );
  }
}
