require('dotenv').config();

const { createEventSource } = require('eventsource-client');
const fetchModule = require('node-fetch');
const fetch = fetchModule.default || fetchModule;
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

function truthy(v) {
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

const BASE_URL=process.env.BASE_URL || 'https://localhost:3000'
const API_URL = `${BASE_URL}/api`;
const STREAM_URL = `${API_URL}/now/stream`;
const BOT_TOKEN = process.env.BOT_TOKEN || '';

const INSECURE =
  truthy(process.env.KUDOS_NOTIFY_INSECURE) ||
  truthy(process.env.INSECURE);

const DRY_RUN = truthy(process.env.DRY_RUN);

const MAIL_FROM =
  process.env.MAIL_FROM || 'KUDOS Recognition platform <kudos@opensuse.org>';

const MAIL_REPLY_TO =
  process.env.MAIL_REPLY_TO || 'noreply@opensuse.org';

const WEB_BASE_URL =
  process.env.KUDOS_WEB_URL || 'https://kudos.opensuse.org';

const httpsAgent = INSECURE
  ? new https.Agent({ rejectUnauthorized: false })
  : undefined;

const templates = {
  kudo: null,
  badge: null,
  follower: null,
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 25),
  secure: false,
});

transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP transporter verification failed:', error);
  } else {
    console.log('SMTP transporter is ready');
  }
});

function log(...args) {
  console.log(new Date().toISOString(), '-', ...args);
}

function warn(...args) {
  console.warn(new Date().toISOString(), '-', ...args);
}

function errlog(...args) {
  console.error(new Date().toISOString(), '-', ...args);
}

function renderTemplate(content, view = {}) {
  return content.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
    const value = view[key.trim()];
    return value === undefined || value === null ? '' : String(value);
  });
}

function preferencesUrl(username) {
  return `${WEB_BASE_URL}/user/${encodeURIComponent(username)}#preferences`;
}

function pickDisplayName(user, fallback) {
  return (
    user?.name ||
    user?.displayName ||
    user?.fullName ||
    user?.username ||
    fallback
  );
}

async function loadTemplate(name) {
  const filePath = path.join(__dirname, 'templates', `${name}.txt`);
  templates[name] = await fs.readFile(filePath, 'utf8');
}

async function loadTemplates() {
  await loadTemplate('kudo');
  await loadTemplate('badge');
  await loadTemplate('follower');
  log('Templates loaded.');
}

function apiHeaders(extra = {}) {
  const headers = { ...extra };

  if (BOT_TOKEN) {
    headers.Authorization = `Bearer ${BOT_TOKEN}`;
  }

  return headers;
}

function sseFetch(url, init = {}) {
  const headers = {
    Accept: 'text/event-stream',
    ...(init.headers || {}),
  };

  if (BOT_TOKEN) {
    headers.Authorization = `Bearer ${BOT_TOKEN}`;
  }

  return fetch(url, {
    ...init,
    headers,
    agent: httpsAgent,
  });
}

async function apiFetchJson(url) {
  log('Fetching API:', url);

  const response = await fetch(url, {
    headers: apiHeaders({ Accept: 'application/json' }),
    agent: httpsAgent,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

async function getUser(username) {
  if (!username) return null;

  try {
    const user = await apiFetchJson(`${API_URL}/users/${encodeURIComponent(username)}`);
    log(`Fetched user ${username}:`, {
      username: user?.username,
      email: user?.email || '(no email)',
    });
    return user;
  } catch (e) {
    errlog(`Failed to fetch user ${username}:`, e.message);
    return null;
  }
}

async function getFollowers(username) {
  if (!username) return [];

  try {
    const data = await apiFetchJson(
      `${API_URL}/follow/${encodeURIComponent(username)}/followers`
    );
    const followers = Array.isArray(data) ? data : [];
    log(`Fetched ${followers.length} followers for ${username}`);
    return followers;
  } catch (e) {
    errlog(`Failed to fetch followers for ${username}:`, e.message);
    return [];
  }
}

async function sendNotification({ to, subject, text }) {
  if (!to) {
    warn('No recipient address, skipping email');
    return;
  }

  if (!text) {
    warn(`No text rendered for "${subject}", skipping email`);
    return;
  }

  if (DRY_RUN) {
    log('DRY RUN: Email not sent');
    log(`  To: ${to}`);
    log(`  From: ${MAIL_FROM}`);
    log(`  Reply-To: ${MAIL_REPLY_TO}`);
    log(`  Subject: ${subject}`);
    log('  Body:');
    console.log(text);
    return;
  }

  try {
    await transporter.sendMail({
      from: MAIL_FROM,
      replyTo: MAIL_REPLY_TO,
      to,
      subject,
      text,
    });

    log(`Email sent to ${to}`);
  } catch (e) {
    errlog(`Failed to send email to ${to}:`, e);
  }
}

async function handleKudos(payload) {
  log('Handling kudos event:', payload);

  const recipient = await getUser(payload.to);
  if (recipient && recipient.email) {
    const recipientName = pickDisplayName(recipient, payload.to);
    const recipientUsername = recipient.username || payload.to;
    const subject = `You received a kudo from ${payload.from}`;

    const text = renderTemplate(templates.kudo, {
      recipient: recipientName,
      username: recipientUsername,
      sender: payload.from,
      message: payload.message || '',
      category: payload.category || '',
      permalink: payload.permalink || '',
      preferencesUrl: preferencesUrl(recipientUsername),
    });

    await sendNotification({
      to: recipient.email,
      subject,
      text,
    });
  } else {
    warn(`User ${payload.to} has no email, skipping direct notification`);
  }

  const followers = await getFollowers(payload.to);

  for (const follower of followers) {
    const followerUser = await getUser(follower.username);
    if (!followerUser || !followerUser.email) {
      continue;
    }

    const followerName = pickDisplayName(followerUser, follower.username);
    const followerUsername = followerUser.username || follower.username;
    const subject = `Update for ${payload.to}`;

    const text = renderTemplate(templates.follower, {
      recipient: followerName,
      username: followerUsername,
      followedUser: payload.to,
      sender: payload.from,
      message: `${payload.from} sent them a kudo: "${payload.message || ''}"`,
      category: payload.category || '',
      permalink: payload.permalink || '',
      preferencesUrl: preferencesUrl(followerUsername),
    });

    await sendNotification({
      to: followerUser.email,
      subject,
      text,
    });
  }
}

async function handleBadge(payload) {
  log('Handling badge event:', payload);

  const recipient = await getUser(payload.username);
  if (recipient && recipient.email) {
    const recipientName = pickDisplayName(recipient, payload.username);
    const recipientUsername = recipient.username || payload.username;
    const subject = `You earned a new badge: ${payload.badgeTitle}`;

    const text = renderTemplate(templates.badge, {
      recipient: recipientName,
      username: recipientUsername,
      badgeTitle: payload.badgeTitle || '',
      message: payload.message || '',
      permalink: payload.permalink || '',
      preferencesUrl: preferencesUrl(recipientUsername),
    });

    await sendNotification({
      to: recipient.email,
      subject,
      text,
    });
  } else {
    warn(`User ${payload.username} has no email, skipping direct notification`);
  }

  const followers = await getFollowers(payload.username);

  for (const follower of followers) {
    const followerUser = await getUser(follower.username);
    if (!followerUser || !followerUser.email) {
      continue;
    }

    const followerName = pickDisplayName(followerUser, follower.username);
    const followerUsername = followerUser.username || follower.username;
    const subject = `Update for ${payload.username}`;

    const text = renderTemplate(templates.follower, {
      recipient: followerName,
      username: followerUsername,
      followedUser: payload.username,
      sender: '',
      message: `They earned a new badge: ${payload.badgeTitle || ''}`,
      category: '',
      permalink: payload.permalink || '',
      preferencesUrl: preferencesUrl(followerUsername),
    });

    await sendNotification({
      to: followerUser.email,
      subject,
      text,
    });
  }
}

async function main() {
  await loadTemplates();

  log('Starting notifier with settings:');
  log({
    apiUrl: API_URL,
    streamUrl: STREAM_URL,
    insecure: INSECURE,
    dryRun: DRY_RUN,
    hasToken: !!BOT_TOKEN,
    mailFrom: MAIL_FROM,
    mailReplyTo: MAIL_REPLY_TO,
    webBaseUrl: WEB_BASE_URL,
  });

  createEventSource({
    url: STREAM_URL,
    fetch: sseFetch,

    onOpen(response) {
      log(`SSE connection opened (HTTP ${response.status})`);
    },

    onMessage({ event, data, id }) {
      log('--- SSE MESSAGE ---');
      log('event:', event || 'message');
      log('id:', id);
      log('data:', data);

      if (!data) return;

      let payload;
      try {
        payload = JSON.parse(data);
      } catch (e) {
        warn('Received non-JSON message:', data);
        return;
      }

      if (event === 'info') {
        log('Info event:', payload);
        return;
      }

      if (event === 'kudos') {
        handleKudos(payload).catch((e) => {
          errlog('Failed to process kudos event:', e);
        });
        return;
      }

      if (event === 'badge') {
        handleBadge(payload).catch((e) => {
          errlog('Failed to process badge event:', e);
        });
        return;
      }

      warn(`Unknown event type: ${event}`);
    },

    onError(err) {
      errlog('SSE error:', err);
    },
  });
}

main().catch((e) => {
  errlog('Fatal startup error:', e);
  process.exit(1);
}); 
