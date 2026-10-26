import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'xd:isPublic';

/** Opts a route or controller out of authentication. Everything else requires a valid token. */
export const Public = (): ClassDecorator & MethodDecorator => SetMetadata(IS_PUBLIC, true);
