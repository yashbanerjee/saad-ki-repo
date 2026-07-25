import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from './common/decorators';

/**
 * Root welcome page — the login UI lives on the Next.js frontend service.
 * This Nest API only serves /api/v1/* and /api/docs.
 */
@ApiExcludeController()
@Controller()
export class RootController {
  @Public()
  @Get()
  root(@Res() res: Response) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TaskFlow API</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; background: #09090B; color: #f4f4f5;
      display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; }
    .card { max-width: 480px; padding: 2rem; border: 1px solid rgba(255,255,255,.08);
      border-radius: 18px; background: rgba(255,255,255,.04); }
    h1 { margin: 0 0 .5rem; font-size: 1.5rem; }
    p { color: #a1a1aa; line-height: 1.5; }
    a { color: #a1c8cf; }
    code { background: rgba(255,255,255,.06); padding: .15rem .4rem; border-radius: 6px; font-size: .9em; }
    ul { padding-left: 1.2rem; color: #d4d4d8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>TaskFlow API is running</h1>
    <p>This URL is the <strong>backend API</strong>, not the login UI.</p>
    <ul>
      <li><a href="/api/docs">Swagger API docs</a></li>
      <li><a href="/api/v1/health">Health check</a></li>
    </ul>
    <p>Open your <strong>frontend</strong> Railway URL and go to <code>/login</code> to sign in.</p>
    <p>Sign in from the <strong>frontend</strong> app at <code>/login</code>.</p>
  </div>
</body>
</html>`;
    res.type('html').send(html);
  }
}
