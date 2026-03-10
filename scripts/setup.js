#!/usr/bin/env node
/**
 * Setup Script — One-command setup for a fresh system.
 * Usage: npm run setup  (or: node scripts/setup.js)
 *
 * What it does:
 *   1. Checks Docker is running
 *   2. Starts Postgres + Redis containers
 *   3. Copies .env.example → .env (if needed)
 *   4. Installs npm dependencies (root + frontend)
 *   5. Generates Prisma client + pushes DB schema
 *   6. Installs Playwright Chromium
 *   7. Prints success message
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function run(cmd, opts = {}) {
    console.log(`  → ${cmd}`);
    try {
        execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
    } catch (err) {
        if (!opts.ignoreError) {
            console.error(`\n❌ Command failed: ${cmd}`);
            process.exit(1);
        }
    }
}

function step(n, label) {
    console.log(`\n[${'='.repeat(n > 0 ? 1 : 0)}] Step ${n}: ${label}`);
    console.log('-'.repeat(50));
}

async function setup() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  Google Business Scraper — Fresh Setup       ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    // Step 1: Check Docker
    step(1, 'Checking Docker...');
    try {
        execSync('docker info', { stdio: 'pipe' });
        console.log('  ✓ Docker is running and accessible');
    } catch (err) {
        const errorString = err.stderr ? err.stderr.toString() : err.message;
        if (errorString.includes('permission denied') || errorString.includes('dial unix /var/run/docker.sock')) {
            console.error('\n  ❌ Docker is installed, but your user does not have permission to use it!');
            console.error('  To fix this on Linux, run the following commands:');
            console.error('\n    sudo groupadd docker');
            console.error('    sudo usermod -aG docker $USER');
            console.error('\n  Then log out and log back in, or run: newgrp docker');
            console.error('  Alternatively, you can temporarily grant access with: sudo chmod 666 /var/run/docker.sock\n');
        } else {
            console.error('\n  ❌ Docker is not running or not installed!');
            console.error('  Please install and start Docker Desktop (Windows/Mac) or Docker Engine (Linux), and try again.\n');
        }
        process.exit(1);
    }

    // Step 2: Start containers
    step(2, 'Starting Postgres + Redis containers...');
    run('docker compose up -d');
    console.log('  ✓ Containers started');

    // Wait a moment for Postgres to be ready
    console.log('  ⏳ Waiting for Postgres to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Create .env if missing
    step(3, 'Checking .env file...');
    const envPath = path.join(ROOT, '.env');
    const envExamplePath = path.join(ROOT, '.env.example');
    if (!fs.existsSync(envPath)) {
        if (fs.existsSync(envExamplePath)) {
            fs.copyFileSync(envExamplePath, envPath);
            console.log('  ✓ Created .env from .env.example');
        } else {
            console.error('  ❌ No .env.example found! Create .env manually with DATABASE_URL.');
            process.exit(1);
        }
    } else {
        console.log('  ✓ .env already exists');
    }

    // Step 4: Install dependencies
    step(4, 'Installing dependencies...');
    run('npm install');
    run('npm install', { cwd: path.join(ROOT, 'frontend') });
    console.log('  ✓ Dependencies installed');

    // Step 5: Prisma setup
    step(5, 'Setting up database...');
    run('npx prisma generate');
    run('npx prisma db push');
    console.log('  ✓ Database schema created');

    // Step 6: Playwright
    step(6, 'Installing Playwright Chromium...');
    run('npx playwright install chromium');
    console.log('  ✓ Chromium installed');

    // Done!
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  ✅ Setup complete!                           ║');
    console.log('║                                              ║');
    console.log('║  Start the app:   npm run dev                ║');
    console.log('║  Reset data:      npm run reset              ║');
    console.log('║                                              ║');
    console.log('║  API:      http://localhost:3001              ║');
    console.log('║  Frontend: http://localhost:3000              ║');
    console.log('╚══════════════════════════════════════════════╝\n');
}

setup().catch(err => {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
});
