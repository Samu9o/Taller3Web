import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Pilot extends Document {
  @Prop()
  nombre: string;

  @Prop()
  escuderia: string;

  @Prop({ unique: true, index: true })
  numero: number;

  @Prop()
  activo: boolean;

  @Prop()
  campeonatos: number;
}

export const PilotSchema = SchemaFactory.createForClass(Pilot);
