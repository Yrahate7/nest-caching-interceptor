import { Module } from "@nestjs/common";
import {
	CacheExpiry,CachingInterceptor
} from "./caching-decorator.service";

@Module({
	providers: [],
	exports: [CacheExpiry,CachingInterceptor],
})
export class CachingDecoratorModule {}
