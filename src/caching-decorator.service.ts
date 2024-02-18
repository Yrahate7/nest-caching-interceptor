import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor, SetMetadata } from "@nestjs/common";
import { Observable } from "rxjs";
import { RedisService } from "@liaoliaots/nestjs-redis";
import Redis from "ioredis";
import { Reflector } from "@nestjs/core";

@Injectable()
export class CachingInterceptor implements NestInterceptor {
	private readonly redis: Redis;

	constructor(
		private readonly redisService: RedisService,
		private reflector: Reflector
	) {
		this.redis = this.redisService.getClient();
	}

	/**
	 * Intercepts the request and caches the response.
	 * @param context - The current execution context.
	 * @param next - The next call handler.
	 * @returns An observable of the response.
	 */
	intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
		const request = context.switchToHttp().getRequest();
		const response = context.switchToHttp().getResponse();
		const methodName = context.getHandler().name;
		const controllerName = context.getClass().name;

		const cacheKey = `CACHING_INTERCEPTOR_${controllerName}-${methodName}-${JSON.stringify(request.query)}`;
		const base64CacheKey = Buffer.from(cacheKey).toString("base64");

		const cacheExpiry = this.reflector.get<number>("caching_interceptor.ttl", context.getHandler()) ?? 10;

		// Check if the response is already cached
		return new Observable(observer => {
			this.redis.get(base64CacheKey, (err, result) => {
				if (err) {
					Logger.error("Error while fetching cached response: " + err);
					observer.next();
				}

				if (result) {
					// If the response is cached, send the cached response
					response.json(JSON.parse(Buffer.from(result, "base64").toString()));
					observer.next();
					observer.complete();
				} else {
					// If the response is not cached, intercept the request and cache the response
					next.handle().subscribe(async data => {
						try {
							await this.redis.set(
								base64CacheKey,
								Buffer.from(JSON.stringify(data)).toString("base64"),
								"EX",
								cacheExpiry
							);
						} catch (error) {
							Logger.error("Error while caching response: " + error);
						} finally {
							observer.next(data);
							observer.complete();
						}
					});
				}
			});
		});
	}
}

export const CacheExpiry = (expiryInSeconds: number) => SetMetadata("caching_interceptor.ttl", expiryInSeconds);
