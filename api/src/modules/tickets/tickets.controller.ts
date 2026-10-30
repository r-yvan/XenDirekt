import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type AuthenticatedAdmin,
  type AuthenticatedUser,
  CurrentAdmin,
  CurrentUser,
  RequiresAdminPermission,
} from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { AdminTicketsQuery, CreateTicketDto, UpdateTicketDto } from './dto/tickets.dto';
import { TicketsService } from './tickets.service';

@ApiTags('support')
@ApiBearerAuth('user')
@Controller('v1')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post('payments/:id/tickets')
  @RateLimit({ name: 'ticket-create', key: 'user', limit: 10, windowSeconds: 3600 })
  reportPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CreateTicketDto,
  ) {
    return this.tickets.create(user, {
      paymentId: id,
      category: body.category,
      message: body.message,
    });
  }

  @Post('tickets')
  @RateLimit({ name: 'ticket-create', key: 'user', limit: 10, windowSeconds: 3600 })
  report(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateTicketDto) {
    return this.tickets.create(user, { category: body.category, message: body.message });
  }

  @Get('tickets')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.tickets.listForUser(user);
  }
}

@ApiTags('admin: support')
@ApiBearerAuth('admin')
@Controller('v1/admin/tickets')
export class AdminTicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @RequiresAdminPermission('tickets:read')
  list(@CurrentAdmin() admin: AuthenticatedAdmin, @Query() query: AdminTicketsQuery) {
    return this.tickets.listForAdmin(admin, query);
  }

  @Patch(':id')
  @RequiresAdminPermission('tickets:manage')
  update(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: UpdateTicketDto,
  ) {
    return this.tickets.update(admin, id, body);
  }
}
