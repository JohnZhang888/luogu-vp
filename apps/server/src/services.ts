import type { FastifyInstance } from 'fastify';
import { BrowserLauncher } from './browser/launcher';
import { appConfig } from './config';
import { ContestService } from './luogu/contest';
import { ProblemService } from './luogu/problem';
import { RecordService } from './luogu/record';
import { LoginManager } from './session/login';
import { SessionStore } from './session/store';
import { SubmissionService } from './submissions/service';

export interface Services {
  session: SessionStore;
  launcher: BrowserLauncher;
  login: LoginManager;
  problems: ProblemService;
  contests: ContestService;
  records: RecordService;
  submissions: SubmissionService;
}

export function createServices(): Services {
  const session = new SessionStore(appConfig.dataDir);
  const launcher = new BrowserLauncher();
  const login = new LoginManager(session, launcher);
  const problems = new ProblemService();
  const contests = new ContestService();
  const records = new RecordService(session);
  const submissions = new SubmissionService(
    session,
    launcher,
    problems,
    records,
  );

  return { session, launcher, login, problems, contests, records, submissions };
}

export async function shutdownServices(services: Services): Promise<void> {
  await services.submissions.shutdown();
  await services.login.shutdown();
  await services.launcher.close();
}

declare module 'fastify' {
  interface FastifyInstance {
    services: Services;
  }
}
