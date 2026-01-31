import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('database.mongodb.uri');
        process.stdout.write(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'log',
            context: 'MongoModule',
            message: 'Connecting to MongoDB Atlas',
          }) + '\n',
        );
        return {
          uri,
          retryWrites: true,
          w: 'majority',
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class MongoModule {}
