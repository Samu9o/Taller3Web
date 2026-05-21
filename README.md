# Taller be-two — Respuestas TASKS.md

Repositorio NestJS + MongoDB (Mongoose) con módulos Cars, Bikes y Pilots.

---

## Question 1

**¿MongoDB considera duplicados a `"McQueen"` y `"mcqueen"`?**

Por defecto MongoDB es sensible a mayúsculas, por lo que `"McQueen"` y `"mcqueen"` serían documentos distintos y no habría conflicto de unicidad. Sin embargo, en `cars.service.ts` la línea que cambia ese comportamiento es:

```typescript
// cars.service.ts — método create, línea 42
createCarDto.nombre = createCarDto.nombre.toLowerCase();
```

Esta línea convierte el `nombre` a minúsculas **antes** de llamar a `this.carsModel.create(createCarDto)`. El mismo patrón se repite en `update` (línea 53-54). La consecuencia es que el constraint `unique: true` de MongoDB opera de facto de manera case-insensitive: tanto `"McQueen"` como `"mcqueen"` se almacenan como `"mcqueen"`, lo que dispara el error 11000 en el segundo intento.

---

## Question 2

**¿Por qué existen ambas validaciones de ID?**

`findOne` valida el ID dentro del servicio con `isValidObjectId`, mientras que `remove` delega esa validación al `ParseMongoIdPipe` en el controlador. Ambas protegen contra IDs con formato inválido pero operan en capas distintas del ciclo de vida de la solicitud.

**Si `findOne` no tuviera la verificación `isValidObjectId` y recibiera `"abc"`:**
- `this.carsModel.findById("abc")` lanzaría un `CastError` de Mongoose (no puede convertir `"abc"` a ObjectId).
- Ese error no está dentro de un `try/catch` ni es una `HttpException`, así que el filtro de excepciones global de NestJS lo convierte en **500 Internal Server Error**.

**Si `remove` no usara `ParseMongoIdPipe` y recibiera `"abc"`:**
- `this.carsModel.deleteOne({ _id: "abc" })` también lanzaría un `CastError` de Mongoose.
- Al igual que el caso anterior, sin captura explícita el cliente recibiría **500 Internal Server Error**.

La diferencia clave es el momento en que ocurre la validación: el Pipe rechaza el ID con **400** antes de que el controlador o el servicio ejecuten ninguna lógica; las validaciones internas del servicio también devuelven **400** pero solo después de que el controlador ya delegó al servicio.

---

## Question 3

**¿Por qué `create` necesita `try/catch` pero `findAll` no?**

`findAll` es una operación de solo lectura (`find()`); no escribe datos ni puede violar ninguna restricción de unicidad, por lo que Mongoose no lanzará errores de persistencia.

`create` escribe un nuevo documento en la base de datos y puede violar el constraint `unique: true` del campo `nombre`, lo que produce el **error 11000** de MongoDB (duplicate key). Sin el `try/catch`, ese error escapa sin capturarse.

Si se elimina el `try/catch` de `create` y MongoDB lanza el error 11000:
- El error llega al filtro de excepciones global de NestJS como un error ordinario de JavaScript (no es `HttpException`).
- NestJS lo convierte en **500 Internal Server Error**.
- El cliente no recibe el mensaje descriptivo `"Car exists in db {...}"` sino un error genérico de servidor.

---

## Question 4

**¿Cuántas queries hace `update` y puede haber diferencia entre lo devuelto y lo almacenado?**

El método realiza **2 queries** en el camino feliz:

1. `this.findOne(id)` → `findById(id)` (leer el documento actual).
2. `car.updateOne(updateCarDto)` (escribir los cambios en MongoDB).

La respuesta se construye con `{ ...car.toJSON(), ...updateCarDto }`: combina el estado anterior del documento con los campos del DTO.

**Sí puede haber diferencia.** Un escenario concreto: si la entidad tuviera un hook `pre('save')` o un middleware de Mongoose que transforme algún campo (por ejemplo, recalcular un campo derivado, o añadir un timestamp `updatedAt` automático a nivel de esquema), esa transformación ocurre en MongoDB pero no queda reflejada en el spread devuelto por la API. El cliente recibiría el valor antiguo de ese campo aunque en la base de datos ya esté actualizado.

Otro escenario: un segundo proceso actualiza el mismo documento entre la query 1 (`findOne`) y la query 2 (`updateOne`). La respuesta devuelta mezclaría el estado leído antes del cambio concurrente con los campos del DTO del cliente actual.

---

## Question 5

**`forRootAsync` vs `forRoot` y el timing de `process.env`**

Si se cambia a:

```typescript
MongooseModule.forRoot(process.env.MONGODB_URL || 'mongodb://localhost:27017/nest-cars'),
```

El problema es el **momento exacto** en que JavaScript evalúa `process.env.MONGODB_URL`: al parsear y ejecutar el archivo `app.module.ts`, es decir, cuando Node.js importa el módulo y ejecuta el decorador `@Module({ imports: [...] })`. En ese instante el `ConfigModule` (responsable de cargar el `.env`) todavía no ha inicializado, por lo que `process.env.MONGODB_URL` es `undefined` y Mongoose intenta conectarse con `undefined` como URI.

`forRootAsync({ useFactory })` resuelve el problema porque la función `useFactory` es invocada por el sistema de inyección de dependencias de NestJS **después** de que todos los módulos de los que depende (en este caso `ConfigModule`) hayan sido inicializados y hayan cargado las variables de entorno en `process.env`.

---

## Question 6

**¿Qué pasa si se olvida importar `CarsModule` en `AppModule`?**

Si `CarsModule` no está en `imports` de `AppModule`: la aplicación **arranca sin errores**. NestJS simplemente no registra los controladores ni los providers de ese módulo en el grafo de la aplicación. Las rutas `/api/cars` no existen. En la primera petición a cualquiera de esas rutas el cliente recibe **404 Not Found**.

**Si `CarsModule` sí está importado pero falta `MongooseModule.forFeature` dentro de `CarsModule`:** la aplicación **falla al arrancar** con un error de inyección de dependencias:

```
Nest can't resolve dependencies of the CarsService (?).
Please make sure that the argument CarsModel at index [0]
is available in the CarsModule context.
```

Para diagnosticarlo se revisa `cars.module.ts` — el array `imports` debería contener `MongooseModule.forFeature([{ name: Car.name, schema: CarSchema }])`. Sin eso, el token `@InjectModel(Car.name)` no puede ser resuelto por el contenedor de DI.

---

## Question 7

**¿Ventaja de `remove` sin `findOne` previo y cuándo `deletedCount` puede ser 0?**

Ir directamente a `deleteOne` en lugar de llamar `findOne` antes de eliminar tiene dos ventajas:

1. **Eficiencia**: solo se realiza **1 query** en lugar de 2 (buscar + borrar).
2. **Atomicidad**: al no separar la comprobación de existencia del borrado, se elimina la ventana de tiempo en que otro proceso podría borrar el documento entre las dos queries.

`deletedCount` puede ser `0` — incluso con un ObjectId de formato válido — cuando **el documento con ese `_id` no existe en la base de datos**: nunca fue creado, ya fue eliminado por una operación anterior, o pertenece a otra colección.

---

## Question 8

**Ventaja arquitectónica del Pipe y efecto de quitar `@Injectable()`**

Si la lógica de validación del ObjectId se mueve al servicio y se elimina el Pipe:

- Se pierde la **separación de responsabilidades**: el controlador ya no es el único punto de entrada HTTP; la validación de transporte queda mezclada con la lógica de negocio.
- Se pierde la **reutilización**: el Pipe puede aplicarse a cualquier endpoint con `@Param('id', ParseMongoIdPipe)` en cualquier controlador; la misma lógica en el servicio no es reutilizable entre módulos sin duplicarla.
- En el ciclo de vida de NestJS, el Pipe ejecuta en la fase **Pipes / Decorators**, antes de que el método del controlador sea invocado. Si la validación está en el servicio, el controlador primero recibe el parámetro inválido, lo pasa al servicio, y solo entonces se rechaza — un paso innecesario más tardío.

**Si se elimina `@Injectable()` del Pipe pero se usa como `@Param('id', ParseMongoIdPipe)`:**
Cuando se pasa una referencia de clase (no una instancia con `new`), NestJS intenta instanciar el Pipe a través de su contenedor de DI. Sin `@Injectable()`, el contenedor no puede gestionar el Pipe formalmente. En la práctica, si el Pipe no tiene dependencias inyectadas (como es el caso de `ParseMongoIdPipe`), muchas versiones de NestJS logran instanciarlo de todos modos usando `new ParseMongoIdPipe()` internamente. Sin embargo, si el Pipe tuviera dependencias declaradas en su constructor, la ausencia de `@Injectable()` causaría un error de DI en el arranque.

---

## Question 9

**¿Importa el orden de `setGlobalPrefix`, `enableCors` y `useGlobalPipes`?**

**Escenario 1 — `useGlobalPipes` se mueve al principio (antes de `setGlobalPrefix` y `enableCors`):**

El comportamiento de la aplicación **no cambia**. Las tres llamadas simplemente registran configuraciones en la instancia de la aplicación NestJS. Lo único que importa es que todas se realicen **antes** de `app.listen()`. El orden relativo entre ellas no afecta su efecto.

**Escenario 2 — `enableCors()` se mueve a después de `app.listen()`:**

Esto **sí puede causar problemas**. `app.listen()` inicia el servidor HTTP y comienza a aceptar conexiones de inmediato. `enableCors()` registra un middleware de CORS en el adaptador subyacente (Express o Fastify); si una petición llega entre el momento en que el servidor empieza a escuchar y el momento en que se registra el middleware de CORS, esa petición no recibirá las cabeceras `Access-Control-Allow-*`. Además, dependiendo del adaptador HTTP, registrar middleware después de iniciar el servidor puede no tener efecto en absoluto. `enableCors()` debe llamarse **antes** de `app.listen()` para garantizar que todas las peticiones, desde la primera, tengan CORS habilitado.
