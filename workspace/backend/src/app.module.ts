import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { CompaniesModule } from './companies/companies.module';
import { ProjectsModule } from './projects/projects.module';
import { IssuesModule } from './issues/issues.module';
import { SprintsModule } from './sprints/sprints.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { DocumentsModule } from './documents/documents.module';
import { NdaModule } from './nda/nda.module';
import { ClientsModule } from './clients/clients.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';
import { ActivityModule } from './activity/activity.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SearchModule } from './search/search.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { TeamsModule } from './teams/teams.module';
import { ReportsModule } from './reports/reports.module';
import { StorageModule } from './storage/storage.module';
import { MailModule } from './mail/mail.module';
import { QueueModule } from './queue/queue.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ([{
        ttl: 60000,
        limit: config.get<number>('THROTTLE_LIMIT', 100),
      }]),
    }),
    PrismaModule,
    StorageModule,
    MailModule,
    QueueModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RolesModule,
    CompaniesModule,
    ProjectsModule,
    IssuesModule,
    SprintsModule,
    OnboardingModule,
    DocumentsModule,
    NdaModule,
    ClientsModule,
    NotificationsModule,
    ActivityModule,
    DashboardModule,
    SearchModule,
    WorkflowsModule,
    TeamsModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
