const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');

function copyEnv(src, dest) {
  if (!fs.existsSync(dest) && fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Created ${path.relative(root, dest)}`);
  }
}

console.log('TaskFlow Enterprise setup\n');

copyEnv(
  path.join(root, 'backend', '.env.example'),
  path.join(root, 'backend', '.env'),
);
copyEnv(
  path.join(root, 'frontend', '.env.example'),
  path.join(root, 'frontend', '.env.local'),
);

const uploads = path.join(root, 'uploads');
if (!fs.existsSync(uploads)) fs.mkdirSync(uploads, { recursive: true });
fs.writeFileSync(path.join(uploads, '.gitkeep'), '');

console.log('\nInstalling dependencies...');
execSync('npm install', { cwd: root, stdio: 'inherit' });

console.log('\nGenerating Prisma client...');
execSync('npm run prisma:generate --workspace=backend', { cwd: root, stdio: 'inherit' });

console.log(`
Setup complete.

Next steps:
  1. Start Postgres + Redis:  npm run docker:up
     (or run only infra: docker compose -f docker/docker-compose.yml up -d postgres redis)
  2. Edit workspace/backend/.env with your DATABASE_URL / secrets
  3. Migrate + seed:  npm run prisma:migrate && npm run prisma:seed
  4. Dev servers:
       npm run dev:backend
       npm run dev:frontend

API:      http://localhost:4000/api/v1
Swagger:  http://localhost:4000/api/docs
App:      http://localhost:3000

Demo login after seed: admin@acme.demo / Password123!
`);
