import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { BikesService } from './bikes.service';
import { CreateBikeDto } from './dto/create-bike.dto';
import { UpdateBikeDto } from './dto/update-bike.dto';

@Controller('bikes')
export class BikesController {
  constructor(private readonly bikesService: BikesService) {}

  // TODO: Add the correct HTTP decorator to get all bikes
  @Get()
  findAll() {
    return this.bikesService.findAll();
  }

  // TODO: Add the correct HTTP decorator to get a bike by ID
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bikesService.findOne(id);
  }

  // TODO: Add the correct HTTP decorator to create a bike
  @Post()
  create(@Body() createBikeDto: CreateBikeDto) {
    return this.bikesService.create(createBikeDto);
  }

  // TODO: Add the correct HTTP decorator to update a bike by ID
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBikeDto: UpdateBikeDto) {
    return this.bikesService.update(id, updateBikeDto);
  }

  // TODO: Add the correct HTTP decorator to delete a bike
  //       Use ParseMongoIdPipe to validate the id (same as in CarsController)
  @Delete(':id')
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.bikesService.remove(id);
  }
}
