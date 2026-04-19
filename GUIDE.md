# NestJS with a Database — Workshop be-two

## Prerequisites

- Completed **be-one** (NestJS basics, DTOs, ValidationPipe)
- Node.js >= 18 installed
- One of the two database options set up (see Section 2)

---

## What we are building

A REST API to manage a collection of cars (`Cars`) connected to MongoDB. This time data is stored in a real database, not an in-memory array.

**New concepts compared to be-one:**
- Connecting to MongoDB with Mongoose
- Schemas and entities (`@Schema`, `@Prop`)
- Real CRUD with database error handling
- Custom Pipe to validate MongoDB IDs
- Environment variables with `@nestjs/config`
- D.R.Y. pattern to centralize error handling

---

## Section 1 — Project setup

Install dependencies:

```bash
npm install
```

Or if starting from scratch:

```bash
npm install -g @nestjs/cli
nest new nest-cars
cd nest-cars
npm install @nestjs/mongoose mongoose @nestjs/config class-validator class-transformer @nestjs/mapped-types
```

---

## Section 2 — Database: choose your option

Before running the app you need a MongoDB database. There are two options:

---

### Option A: Docker (recommended if you have Docker installed)

**Requirement:** Docker Desktop installed and running.

**When to use this option:**
- You have at least 4 GB of RAM available
- You have Docker Desktop installed
- You prefer working 100% locally without creating accounts

**Steps:**

1. Start the MongoDB container:

```bash
docker-compose up -d
```

2. Verify the container is running:

```bash
docker ps
```

3. Your connection URL is:
```
mongodb://localhost:27017/nest-cars
```

4. To inspect the database use a client like **TablePlus**, **MongoDB Compass**, or the **MongoDB for VS Code** extension.
   - Connect with: `mongodb://localhost:27017/nest-cars`

5. To stop the container:
```bash
docker-compose down
```

---

### Option B: MongoDB Atlas — free cloud database

**When to use this option:**
- Docker is slow or heavy on your laptop
- You do not want to install anything locally
- You want to try a cloud database

MongoDB Atlas offers a free M0 Sandbox cluster with 512 MB of storage — more than enough for this workshop.

**Steps:**

1. Go to [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas) and create a free account.

2. Create a new project and inside it create a **cluster** (select the **M0 FREE** tier).

3. Go to **Database Access** → **Add new database user**:
   - Choose password authentication
   - Create a username (e.g. `nest-user`) and a secure password
   - Grant the role **Atlas admin** or **Read and write to any database**

4. Go to **Network Access** → **Add IP Address**:
   - For this workshop choose **Allow access from anywhere** (`0.0.0.0/0`)

5. Go to your cluster → **Connect** → **Connect your application**:
   - Driver: Node.js
   - Copy the connection string, which looks like this:
   ```
   mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

6. Replace `<user>` and `<password>`, and append your database name:
   ```
   mongodb+srv://nest-user:myPassword123@cluster0.xxxxx.mongodb.net/nest-cars
   ```

---

> **Regardless of which option you choose, the application code is exactly the same.**
> Only the URL in your `.env` file changes.

---

## Section 3 — Environment variables

Create the `.env` file at the root of the project (never commit this file):

```bash
# Option A — Docker:
PORT=3000
MONGODB_URL=mongodb://localhost:27017/nest-cars
```

```bash
# Option B — Atlas:
PORT=3000
MONGODB_URL=mongodb+srv://nest-user:myPassword123@cluster0.xxxxx.mongodb.net/nest-cars
```

The `.env.template` file (which is committed to git) acts as a template so other developers know which variables they need to create.

**Important rule:** `.env` is in `.gitignore`. Never commit passwords to git.

---

## Section 4 — How `main.ts` configures the app

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');   // All endpoints are prefixed with /api
  app.enableCors();             // Allows requests from a browser (frontend)

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // Strips properties not declared in the DTO
      forbidNonWhitelisted: true,   // Returns 400 if extra properties are sent
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
```

---

## Section 5 — AppModule: connecting Mongoose and ConfigModule

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // Loads .env, available app-wide

    MongooseModule.forRootAsync({             // forRootAsync waits for ConfigModule
      useFactory: () => ({                    // to load vars before connecting
        uri: process.env.MONGODB_URL || 'mongodb://localhost:27017/nest-cars',
      }),
    }),

    CarsModule,
    BikesModule,
  ],
})
export class AppModule {}
```

**Why `forRootAsync` and not `forRoot`?**

`forRoot(url)` evaluates the URL immediately when the module file is loaded.
`forRootAsync({ useFactory })` waits for NestJS to initialize modules in order
(ConfigModule loads the `.env` first, then the factory runs with the variables available).

---

## Section 6 — Request lifecycle in NestJS

```
HTTP Request
      ↓
  Middlewares
      ↓
    Guards
      ↓
  Interceptors (Before)
      ↓
  Pipes / Decorators    ← ParseMongoIdPipe validates the :id here
      ↓
  Controller            ← Receives the request, delegates to the service
      ↓
  Service               ← Business logic, calls Mongoose
      ↓
  Interceptors (After)
      ↓
  Exception Filters     ← Catches unhandled errors
      ↓
HTTP Response
```

---

## Section 7 — Defining an entity (Mongoose Schema)

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Car extends Document {
  @Prop({ unique: true, index: true })
  nombre: string;

  @Prop()
  modelo: string;

  @Prop()
  anio: number;

  @Prop()
  frase: string;
}

export const CarSchema = SchemaFactory.createForClass(Car);
```

- `@Schema()` — marks this class as a MongoDB schema
- `@Prop()` — marks this property as a collection field
- `unique: true` — MongoDB rejects documents with the same value (error 11000)
- `index: true` — MongoDB indexes the field for faster lookups
- `extends Document` — the class inherits Mongoose document methods (`.save()`, `.updateOne()`, etc.)
- `CarSchema` — the object Mongoose needs to register the model

---

## Section 8 — Registering the schema in the module

```typescript
// cars.module.ts
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Car.name, schema: CarSchema }]),
  ],
  controllers: [CarsController],
  providers: [CarsService],
})
export class CarsModule {}
```

**`forRoot` vs `forFeature`:**

| | `forRoot` | `forFeature` |
|---|---|---|
| Where | `AppModule` (once) | Each feature module |
| Purpose | Connect to the database | Register a collection |
| How many times | 1 | One per collection |

---

## Section 9 — Injecting the model into the service

```typescript
@Injectable()
export class CarsService {
  private readonly logger = new Logger('Cars');

  constructor(
    @InjectModel(Car.name)
    private readonly carsModel: Model<Car>,
  ) {}
}
```

`@InjectModel(Car.name)` tells the dependency injection system:
*"give me the Mongoose model that was registered with this name"*.

The token `Car.name` is simply the string `"Car"` (the class name).

---

## Section 10 — CRUD with Mongoose

### GET — find all

```typescript
async findAll() {
  return this.carsModel.find();
}
```

### GET — find by ID

```typescript
async findOne(id: string) {
  if (!isValidObjectId(id)) {
    throw new BadRequestException(`Id is not a valid object id`);
  }
  const car = await this.carsModel.findById(id);
  if (!car) {
    throw new NotFoundException(`Car with id ${id} not found`);
  }
  return car;
}
```

`isValidObjectId('abc')` → `false`
`isValidObjectId('507f1f77bcf86cd799439011')` → `true`

### POST — create

```typescript
async create(createCarDto: CreateCarDto) {
  createCarDto.nombre = createCarDto.nombre.toLowerCase();
  try {
    const car = await this.carsModel.create(createCarDto);
    return car;
  } catch (error) {
    this.handleException(error);
  }
}
```

### PATCH — update

```typescript
async update(id: string, updateCarDto: UpdateCarDto) {
  if (updateCarDto.nombre) {
    updateCarDto.nombre = updateCarDto.nombre.toLowerCase();
  }
  const car = await this.findOne(id); // reuses the validation logic
  try {
    await car.updateOne(updateCarDto);
    return { ...car.toJSON(), ...updateCarDto };
  } catch (error) {
    this.handleException(error);
  }
}
```

### DELETE — remove

```typescript
async remove(id: string) {
  const { deletedCount } = await this.carsModel.deleteOne({ _id: id });
  if (deletedCount === 0) {
    throw new BadRequestException(`Car with id ${id} not found`);
  }
  return;
}
```

---

## Section 11 — Error handling and D.R.Y.

MongoDB error **11000** occurs when you try to insert a document that violates a `unique` constraint.

```typescript
private handleException(error: any) {
  if (error.code === 11000) {
    throw new BadRequestException(
      `Car exists in db ${JSON.stringify(error.keyValue)}`,
    );
  }
  this.logger.error(error);
  throw new InternalServerErrorException(
    `Can't process request, check server logs`,
  );
}
```

This private method is called from both `create` and `update`, avoiding duplicating the same `catch` block twice. **D.R.Y.** = _Don't Repeat Yourself_.

---

## Section 12 — Custom Pipe: ParseMongoIdPipe

MongoDB IDs have a specific format (24 hexadecimal characters). A Custom Pipe centralizes this validation at the controller level.

```typescript
// src/common/pipes/parse-mongo-id.pipe.ts
@Injectable()
export class ParseMongoIdPipe implements PipeTransform {
  transform(value: string, metadata: ArgumentMetadata) {
    if (!isValidObjectId(value)) {
      throw new BadRequestException(`${value} is not a valid MongoDB ObjectId`);
    }
    return value;
  }
}
```

Usage in the controller:

```typescript
@Delete(':id')
remove(@Param('id', ParseMongoIdPipe) id: string) {
  return this.carsService.remove(id);
}
```

The pipe runs **before** the controller method executes. If the id is invalid, the pipe throws the exception and the controller never runs.

---

## Section 13 — NestJS built-in exceptions

| Exception | HTTP Status | When to use |
|---|---|---|
| `BadRequestException` | 400 | Invalid input, ID not found |
| `NotFoundException` | 404 | Resource does not exist in the DB |
| `UnauthorizedException` | 401 | Not authenticated |
| `ForbiddenException` | 403 | Not authorized |
| `InternalServerErrorException` | 500 | Unexpected server error |

---

## ACTIVITY 1 — Read the Cars module (reference)

Open the files in `src/cars/` and read each one carefully.

**Guiding questions while reading:**

1. In `car.entity.ts`: why does `nombre` have `unique: true` but `modelo` does not?
2. In `cars.service.ts`: which methods have `try/catch` and why not all of them?
3. In `cars.service.ts`: what would happen if `Logger` was called without the `'Cars'` argument?
4. In `cars.module.ts`: what happens if you forget to import `CarsModule` in `AppModule`?
5. In `cars.controller.ts`: why does only the DELETE endpoint use `ParseMongoIdPipe`?

**Answer key:**

1. `nombre` is marked as unique because it acts like a logical identifier for each car record, while `modelo` is not unique because many cars can share the same model.
2. `try/catch` appears in `create` and `update` because they write to the database and can trigger persistence errors (for example duplicate key errors). `findAll`, `findOne`, and `remove` use direct control flow with explicit validations and exceptions.
3. The service would still run, but logs would lose the `Cars` context label, making tracing and debugging harder when reading server logs.
4. If `CarsModule` is not imported in `AppModule`, NestJS does not register its controllers/providers in the app graph, so `/cars` routes are not exposed (typically 404).
5. DELETE uses `ParseMongoIdPipe` to validate ObjectId format before hitting the service remove logic. In contrast, `findOne` and `update` already validate IDs inside `CarsService.findOne`.

**Test the endpoints:**

```bash
# Get all cars
curl http://localhost:3000/api/cars

# Create a car
curl -X POST http://localhost:3000/api/cars \
  -H "Content-Type: application/json" \
  -d '{"nombre": "mcqueen", "modelo": "Lightning", "anio": 2006, "frase": "Ka-chow!"}'

# Create another car
curl -X POST http://localhost:3000/api/cars \
  -H "Content-Type: application/json" \
  -d '{"nombre": "mater", "modelo": "Tow Truck", "anio": 1951, "frase": "Git-R-Done!"}'

# Get by ID (replace with a real ID from the previous step)
curl http://localhost:3000/api/cars/PASTE_ID_HERE

# Update
curl -X PATCH http://localhost:3000/api/cars/PASTE_ID_HERE \
  -H "Content-Type: application/json" \
  -d '{"frase": "Speed. I am speed."}'

# Delete
curl -X DELETE http://localhost:3000/api/cars/PASTE_ID_HERE
```

**Test the error cases:**

```bash
# Invalid ID format
curl http://localhost:3000/api/cars/not-a-valid-id

# Valid ObjectId format but does not exist in the DB
curl http://localhost:3000/api/cars/507f1f77bcf86cd799439011

# Duplicate name (create mcqueen twice)
curl -X POST http://localhost:3000/api/cars \
  -H "Content-Type: application/json" \
  -d '{"nombre": "mcqueen", "modelo": "Lightning", "anio": 2006, "frase": "Ka-chow!"}'

# Extra field not allowed by the DTO
curl -X POST http://localhost:3000/api/cars \
  -H "Content-Type: application/json" \
  -d '{"nombre": "doc", "modelo": "Hudson", "anio": 1951, "frase": "You can go.", "color": "blue"}'
```

Observe the difference in `statusCode` and `message` for each response.

---

## ACTIVITY 2 — Complete the Bikes module

Open `src/bikes/`. There are three files with `TODO` comments to complete.

### Step 1 — `create-bike.dto.ts`

Add the missing validation decorators. Use `create-car.dto.ts` as a reference.

The valid bike types are in the `BikeType` enum in `bike.entity.ts`:
`mountain`, `road`, `city`, `electric`.

### Step 2 — `bikes.service.ts`

Implement the five service methods. The instructions are in the `TODO` comments of each method. Use `cars.service.ts` as an exact reference.

### Step 3 — `bikes.controller.ts`

Add the missing HTTP decorators. Check `cars.controller.ts` to see which decorators to use and how.

Do not forget to use `ParseMongoIdPipe` on the DELETE endpoint.

### Step 4 — Verify with curl

```bash
# Create a bike
curl -X POST http://localhost:3000/api/bikes \
  -H "Content-Type: application/json" \
  -d '{"marca": "Trek", "tipo": "mountain", "velocidades": 21, "descripcion": "Best for trails"}'

# Invalid type (must return 400)
curl -X POST http://localhost:3000/api/bikes \
  -H "Content-Type: application/json" \
  -d '{"marca": "Honda", "tipo": "motorcycle", "velocidades": 1, "descripcion": "Not a bike"}'

# Duplicate brand (must return 400)
curl -X POST http://localhost:3000/api/bikes \
  -H "Content-Type: application/json" \
  -d '{"marca": "Trek", "tipo": "road", "velocidades": 11, "descripcion": "For the road"}'

# Get all
curl http://localhost:3000/api/bikes

# Delete with invalid ID (must return 400 from the Pipe)
curl -X DELETE http://localhost:3000/api/bikes/invalid-id
```

---

## ACTIVITY 3 — Build the Pilots module from scratch

Using `src/cars/` as a reference, build the `pilots` module completely on your own.

**The Pilot model has these fields:**

| Field | Type | Constraints |
|---|---|---|
| `nombre` | string | required |
| `escuderia` | string | required (team name) |
| `numero` | number | unique, positive (racing number) |
| `activo` | boolean | required |
| `campeonatos` | number | 0 or positive (championships won) |

**Steps:**

1. Generate the resource with the CLI:
   ```bash
   nest g resource pilots
   ```
   Choose "REST API" and "No" to CRUD entry points (we will write them by hand).

2. Create the entity in `src/pilots/entities/pilot.entity.ts`
   - `numero` should have `{ unique: true, index: true }`
   - All other fields with a plain `@Prop()`

3. Create the DTOs in `src/pilots/dto/`
   - `CreatePilotDto`: validate each field with the correct decorators
   - `UpdatePilotDto`: `PartialType(CreatePilotDto)`

4. Implement `PilotsService` in full (same pattern as `CarsService`)

5. Implement `PilotsController` in full with all 5 endpoints

6. Register the schema in `pilots.module.ts` with `MongooseModule.forFeature`

7. Import `PilotsModule` in `AppModule`

**Verify with curl:**

```bash
# Create a pilot
curl -X POST http://localhost:3000/api/pilots \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Lightning McQueen", "escuderia": "Rust-eze", "numero": 95, "activo": true, "campeonatos": 3}'

# Duplicate number (must fail)
curl -X POST http://localhost:3000/api/pilots \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Doc Hudson", "escuderia": "Rusteze", "numero": 95, "activo": false, "campeonatos": 3}'
```

---

## Bonus Challenges

**1. Pagination**

Add `?limit=10&skip=0` as query params to the `GET /cars` endpoint.

```typescript
@Get()
findAll(
  @Query('limit') limit: string = '10',
  @Query('skip') skip: string = '0',
) {
  return this.carsService.findAll(+limit, +skip);
}
```

In the service: `.find().limit(limit).skip(skip)`

**2. Search by name**

Add `GET /cars/search?q=mcqueen` using a MongoDB regex:

```typescript
return this.carsModel.find({ nombre: { $regex: q, $options: 'i' } });
```

**3. ConfigService instead of `process.env`**

Modify `app.module.ts` to read the MongoDB URL using `ConfigService`:

```typescript
MongooseModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    uri: configService.getOrThrow<string>('MONGODB_URL'),
  }),
  inject: [ConfigService],
}),
```

`getOrThrow` throws an error if the variable does not exist, instead of connecting to `undefined`.

**4. Seed endpoint**

Create a `seed` module with a `POST /api/seed` endpoint that:
1. Deletes all Cars documents
2. Inserts 5 hardcoded test cars

**5. Virtual field**

Add a virtual to `CarSchema` that calculates whether a car is "classic" (more than 25 years old):

```typescript
CarSchema.virtual('isClassic').get(function () {
  return new Date().getFullYear() - this.anio > 25;
});
```

Enable virtuals in responses with `{ toJSON: { virtuals: true } }` in `@Schema()`.
