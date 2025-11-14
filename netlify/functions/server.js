// netlify/functions/server.js
import serverless from 'serverless-http';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';

// Import your existing routes from backend
import { mountAuth } from '../../backend/src/routes/auth.js';
import { mountStatsRoutes } from '../../backend/src/routes/stats.js';
import { mountUserRoutes } from '../../backend/src/routes/users.js';
import { mountKudosRoutes } from '../../backend/src/routes/kudos.js';
import { mountBadgesRoutes } from '../../backend/src/routes/badges.js';
import { mountWhoamiRoutes } from '../../backend/src/routes/whoami.js';
import { mountSummaryRoutes } from '../../backend/src/routes/summary.js';
import { mountNowRoutes } from '../../backend/src/routes/now.js';
import { mountNotificationsRoutes } from '../../backend/src/routes/notifications.js';

const app = express();
const prisma = new PrismaClient();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({ secret: 'netlify-preview', resave: false, saveUninitialized: true }));

// Reuse all your real backend routes (no top-level await)
async function setupRoutes() {
  await mountAuth(app, prisma);
  mountStatsRoutes(app, prisma);
  mountUserRoutes(app, prisma);
  mountKudosRoutes(app, prisma);
  mountBadgesRoutes(app, prisma);
  mountWhoamiRoutes(app, prisma);
  mountSummaryRoutes(app, prisma);
  mountNowRoutes(app, prisma);
  mountNotificationsRoutes(app, prisma);
}

setupRoutes().catch((err) => {
  console.error('❌ Failed to mount routes:', err);
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV,
    note: 'Running as Netlify function',
  });
});

export const handler = serverless(app);
