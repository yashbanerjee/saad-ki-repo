import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, InviteUserDto } from './dto/user.dto';
import { CurrentUser, AuthenticatedUser, Permissions } from '../common/decorators';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PaginationDto } from '../common/dto/pagination.dto';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(PermissionsGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Permissions('users:read')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    return this.usersService.findAll(user.companyId!, query.page, query.limit);
  }

  @Post('invite')
  @Permissions('users:invite')
  invite(@CurrentUser() user: AuthenticatedUser, @Body() dto: InviteUserDto) {
    return this.usersService.invite(user.companyId!, user.id, dto);
  }

  @Get(':id')
  @Permissions('users:read')
  findOne(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findOne(id, user.companyId!);
  }

  @Post()
  @Permissions('users:manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.companyId!, dto);
  }

  @Patch(':id')
  @Permissions('users:manage')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, user.companyId!, dto);
  }

  @Delete(':id')
  @Permissions('users:manage')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.remove(id, user.companyId!);
  }
}
