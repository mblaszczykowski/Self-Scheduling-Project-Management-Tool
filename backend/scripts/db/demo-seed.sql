BEGIN;

DELETE FROM comment_attachments
WHERE comment_id IN (
  SELECT c.id FROM comments c
    JOIN tasks t ON c.task_id = t.id
    JOIN projects p ON t.project_id = p.id
  WHERE p.project_key IN ('ECOM','MAPP','B2B'));

DELETE FROM task_attachments
WHERE task_id IN (
  SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
  WHERE p.project_key IN ('ECOM','MAPP','B2B'));

DELETE FROM project_attachments
WHERE project_id IN (
  SELECT id FROM projects WHERE project_key IN ('ECOM','MAPP','B2B'));

DELETE FROM comment_reactions
WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@flowlink.dev')
   OR comment_id IN (
     SELECT c.id FROM comments c
       JOIN tasks t ON c.task_id = t.id
       JOIN projects p ON t.project_id = p.id
     WHERE p.project_key IN ('ECOM','MAPP','B2B'));

DELETE FROM comments
WHERE author_id IN (SELECT id FROM users WHERE email LIKE '%@flowlink.dev')
   OR task_id IN (
     SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
     WHERE p.project_key IN ('ECOM','MAPP','B2B'));

DELETE FROM notifications
WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@flowlink.dev');

DELETE FROM task_activities
WHERE author_id IN (SELECT id FROM users WHERE email LIKE '%@flowlink.dev')
   OR task_id IN (
     SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
     WHERE p.project_key IN ('ECOM','MAPP','B2B'));

DELETE FROM task_dependencies
WHERE task_id IN (
     SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
     WHERE p.project_key IN ('ECOM','MAPP','B2B'))
   OR dependency_id IN (
     SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
     WHERE p.project_key IN ('ECOM','MAPP','B2B'));

DELETE FROM tasks
WHERE project_id IN (SELECT id FROM projects WHERE project_key IN ('ECOM','MAPP','B2B'));

DELETE FROM project_members
WHERE project_id IN (SELECT id FROM projects WHERE project_key IN ('ECOM','MAPP','B2B'))
   OR user_id IN (SELECT id FROM users WHERE email LIKE '%@flowlink.dev');

DELETE FROM project_dependencies
WHERE project_id IN (SELECT id FROM projects WHERE project_key IN ('ECOM','MAPP','B2B'))
   OR dependency_id IN (SELECT id FROM projects WHERE project_key IN ('ECOM','MAPP','B2B'));

DELETE FROM refresh_tokens
WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@flowlink.dev');

DELETE FROM projects WHERE project_key IN ('ECOM','MAPP','B2B');

DELETE FROM users WHERE email LIKE '%@flowlink.dev';

INSERT INTO users (first_name, last_name, email, password,
                   email_notifications_enabled, email_on_task_assigned,
                   email_on_comment_reply, email_on_project_invitation, version)
VALUES
  ('Emma',   'Clarke',  'demo@flowlink.dev',
   '$2b$10$mpV2p05Dv44wn2ELzedN6.q4zy9xoNyyHXoGm46kmX5TIQTpqpNzO',
   true, true, true, true, 0),
  ('Daniel', 'Brooks',  'daniel.brooks@flowlink.dev',
   '$2b$10$mpV2p05Dv44wn2ELzedN6.q4zy9xoNyyHXoGm46kmX5TIQTpqpNzO',
   true, true, true, true, 0),
  ('Priya',  'Sharma',  'priya.sharma@flowlink.dev',
   '$2b$10$mpV2p05Dv44wn2ELzedN6.q4zy9xoNyyHXoGm46kmX5TIQTpqpNzO',
   true, true, true, true, 0),
  ('Marcus', 'Webb',    'marcus.webb@flowlink.dev',
   '$2b$10$mpV2p05Dv44wn2ELzedN6.q4zy9xoNyyHXoGm46kmX5TIQTpqpNzO',
   true, true, true, true, 0)
ON CONFLICT (email) DO NOTHING;

INSERT INTO projects (project_key, summary, description, next_task_number, owner_id,
                      created, updated)
SELECT 'ECOM',
       'E-commerce platform redesign',
       'Comprehensive modernization of the online store: new UX/UI, performance optimization, a new shopping cart, and Stripe payment gateway integration. Goal: at least a 15% increase in conversion within the first quarter after launch.',
       16, u.id, NOW(), NOW()
FROM users u WHERE u.email = 'demo@flowlink.dev'
ON CONFLICT (project_key) DO NOTHING;

INSERT INTO projects (project_key, summary, description, next_task_number, owner_id,
                      created, updated)
SELECT 'MAPP',
       'iOS/Android mobile app',
       'A native mobile companion app for the web platform. Features: biometric sign-in (FaceID/TouchID), push notifications for orders, an offline mode with local caching, and product barcode scanning.',
       16, u.id, NOW(), NOW()
FROM users u WHERE u.email = 'demo@flowlink.dev'
ON CONFLICT (project_key) DO NOTHING;

INSERT INTO projects (project_key, summary, description, next_task_number, owner_id,
                      created, updated)
SELECT 'B2B',
       'Wholesale partner API integration',
       'Publishing a public REST API for B2B partners. OAuth2 with JWT, webhooks for order events, rate limiting, OpenAPI 3.0 documentation, a partner admin panel, and data export in CSV and XML (EDI) formats.',
       16, u.id, NOW(), NOW()
FROM users u WHERE u.email = 'demo@flowlink.dev'
ON CONFLICT (project_key) DO NOTHING;

INSERT INTO project_members (project_id, user_id)
SELECT p.id, u.id
FROM projects p
CROSS JOIN users u
WHERE p.project_key IN ('ECOM', 'MAPP', 'B2B')
  AND u.email IN ('daniel.brooks@flowlink.dev',
                  'priya.sharma@flowlink.dev',
                  'marcus.webb@flowlink.dev')
ON CONFLICT DO NOTHING;

INSERT INTO tasks (project_id, task_number, summary, description,
                   status, priority, start_date, due_date, progress,
                   assignee_id, labels, created, updated)
SELECT p.id, v.tn, v.summary, v.description,
       v.status, v.priority, (CURRENT_DATE - 20 + v.sd_offset), (CURRENT_DATE - 20 + v.dd_offset), v.progress,
       (SELECT id FROM users WHERE email = v.assignee_email),
       v.labels, NOW(), NOW()
FROM projects p,
(VALUES
  (1,  'UX audit of the current storefront',
       'Review of purchase paths, analysis of Hotjar heatmaps from the last 6 months, interviews with 8 customers, a report with recommendations.',
       'DONE',         'MEDIUM',  '2026-05-31', '2026-06-02', 100,
       'daniel.brooks@flowlink.dev',       'research,ux'),
  (2,  'Competitor and e-commerce trend research for 2026',
       'Analysis of 10 competing platforms (Amazon, eBay, Shopify, Shopee), a feature comparison table, and directional recommendations.',
       'DONE',         'LOW',     '2026-06-03', '2026-06-05', 100,
       'priya.sharma@flowlink.dev',        'research'),
  (3,  'Main view wireframes',
       'Wireframes for the homepage, product listing, product page, cart and checkout. Tool: Figma. 3 rounds of design review.',
       'TO_REVIEW',    'HIGH',    '2026-06-14', '2026-06-17', 80,
       'daniel.brooks@flowlink.dev',       'design,ux'),
  (4,  'Homepage visual design',
       'Full homepage design in a minimalist style: hero section, product grid, testimonials, newsletter CTA. Consistent with the design system.',
       'BACKLOG',      'HIGH',    '2026-06-21', '2026-06-24', 0,
       'priya.sharma@flowlink.dev',        'design'),
  (5,  'Product list and product page visual design',
       'Templates for the product listing views (grid + list) and the product page with a gallery, variants, and recommendations.',
       'BACKLOG',      'MEDIUM',  '2026-06-25', '2026-06-28', 0,
       'priya.sharma@flowlink.dev',        'design'),
  (6,  'Content migration from the current CMS',
       'Export of 1,200+ product descriptions from the current system, HTML clean-up, import into the new database preserving SEO slugs.',
       'IN_TEST',      'LOW',     '2026-06-14', '2026-06-17', 75,
       'marcus.webb@flowlink.dev',         'backend,migration'),
  (7,  'React UI component implementation',
       'Component library: Button, Input, Modal, ProductCard, Cart, ImageGallery. TypeScript, Storybook, unit tests.',
       'TODO',         'MEDIUM',  '2026-07-02', '2026-07-06', 0,
       'daniel.brooks@flowlink.dev',       'frontend'),
  (8,  'New shopping cart with a mini-view',
       'Cart rebuild: header mini-view, full cart page, stock-level validation, promotion recalculation.',
       'BACKLOG',      'HIGHEST', '2026-06-28', '2026-07-01', 0,
       'marcus.webb@flowlink.dev',         'frontend,business-critical'),
  (9,  'Stripe payment gateway integration',
       'Stripe Elements + Stripe Connect for sellers, 3D Secure, card payments, webhooks for order status changes.',
       'BACKLOG',      'HIGH',    '2026-07-02', '2026-07-05', 0,
       'marcus.webb@flowlink.dev',         'backend,payments'),
  (10, 'Contact page refresh',
       'New contact form integrated with the CRM, a Google map with store locations, and support desk opening hours.',
       'BACKLOG',      'LOWEST',  '2026-07-18', '2026-07-20', 0,
       'priya.sharma@flowlink.dev',        'content'),
  (11, 'New newsletter sign-up form',
       'Exit-intent pop-up, a footer section, double opt-in, Mailchimp integration, and user segmentation.',
       'BACKLOG',      'LOW',     '2026-07-03', '2026-07-04', 0,
       'priya.sharma@flowlink.dev',        'marketing'),
  (12, 'SEO optimization (meta tags, sitemap, schema.org)',
       'Technical SEO audit, filling in meta tags, generating sitemap.xml, schema.org microdata for products.',
       'BACKLOG',      'MEDIUM',  '2026-07-07', '2026-07-09', 0,
       'daniel.brooks@flowlink.dev',       'seo,backend'),
  (13, 'A/B tests for the new pricing strategy',
       'A/B test setup (Optimize), two experimental groups, analysis of the impact on conversion and average cart value.',
       'BACKLOG',      'MEDIUM',  '2026-07-22', '2026-07-24', 0,
       'marcus.webb@flowlink.dev',         'analytics,business'),
  (14, 'Deployment to the staging environment',
       'Deploying the full 2.0 version to staging, regression tests, load testing at 1000 RPS, final sign-off from the business team.',
       'BACKLOG',      'MEDIUM',  '2026-07-13', '2026-07-15', 0,
       'daniel.brooks@flowlink.dev',       'devops'),
  (15, 'Production release of version 2.0',
       'Final production deploy during the maintenance window (Saturday 02:00), 48-hour metrics monitoring, rollback plan.',
       'BACKLOG',      'HIGHEST', '2026-07-25', '2026-07-26', 0,
       'daniel.brooks@flowlink.dev',       'devops,business-critical')
) AS v(tn, summary, description, status, priority, sd_offset, dd_offset, progress, assignee_email, labels)
WHERE p.project_key = 'ECOM'
ON CONFLICT (project_id, task_number) DO NOTHING;

INSERT INTO tasks (project_id, task_number, summary, description,
                   status, priority, start_date, due_date, progress,
                   assignee_id, labels, created, updated)
SELECT p.id, v.tn, v.summary, v.description,
       v.status, v.priority, (CURRENT_DATE - 20 + v.sd_offset), (CURRENT_DATE - 20 + v.dd_offset), v.progress,
       (SELECT id FROM users WHERE email = v.assignee_email),
       v.labels, NOW(), NOW()
FROM projects p,
(VALUES
  (1,  'Technology research (Native vs React Native vs Flutter)',
       'Comparison of three approaches: native (Swift/Kotlin), React Native, Flutter. Performance benchmarks, maintenance cost, and library availability.',
       'DONE',         'MEDIUM',  '2026-05-31', '2026-06-02', 100,
       'priya.sharma@flowlink.dev',        'research,mobile'),
  (2,  'Application architecture design',
       'Component diagram, stack choice (React Native + TypeScript + Redux Toolkit), module structure, navigation strategy.',
       'READY_TO_MERGE','HIGH',   '2026-06-07', '2026-06-11', 100,
       'daniel.brooks@flowlink.dev',       'architecture,mobile'),
  (3,  'CI/CD setup with Fastlane',
       'Automated iOS and Android builds, version tagging, upload to TestFlight and the Google Play internal track, Slack notifications.',
       'GATHERING_INTEREST', 'MEDIUM',  '2026-07-06', '2026-07-08', 0,
       'marcus.webb@flowlink.dev',         'devops,mobile'),
  (4,  'Biometric sign-in implementation',
       'FaceID (iOS) + BiometricPrompt (Android), secure token storage in Keychain/Keystore, PIN fallback.',
       'BACKLOG',      'HIGHEST', '2026-06-21', '2026-06-23', 0,
       'daniel.brooks@flowlink.dev',       'mobile,security,business-critical'),
  (5,  'Sign-in and registration screen',
       'Design and implementation of the auth flow: email/password, OAuth (Google, Apple), registration with email verification.',
       'BACKLOG',      'MEDIUM',  '2026-06-29', '2026-07-02', 0,
       'priya.sharma@flowlink.dev',        'mobile,frontend'),
  (6,  'Product list screen with infinite scroll',
       'Fetching the list from the API with pagination, infinite scroll, pull-to-refresh, skeleton loading, category filters.',
       'BACKLOG',      'HIGH',    '2026-07-08', '2026-07-11', 0,
       'priya.sharma@flowlink.dev',        'mobile,frontend'),
  (7,  'Product detail screen',
       'Photo gallery with pinch-to-zoom, variant selection (size, color), add-to-cart button, recommendations.',
       'BACKLOG',      'MEDIUM',  '2026-07-09', '2026-07-11', 0,
       'marcus.webb@flowlink.dev',         'mobile,frontend'),
  (8,  'Mobile cart with checkout',
       'Cart implementation, Apple Pay / Google Pay integration, discount code validation, handoff to Stripe.',
       'BACKLOG',      'HIGHEST', '2026-07-12', '2026-07-15', 0,
       'marcus.webb@flowlink.dev',         'mobile,business-critical'),
  (9,  'Push notifications (FCM + APNS)',
       'Firebase Cloud Messaging and Apple Push Notifications setup, audience segmentation, message templates.',
       'BACKLOG',      'MEDIUM',  '2026-07-10', '2026-07-12', 0,
       'daniel.brooks@flowlink.dev',       'mobile,backend'),
  (10, 'Offline mode with local caching',
       'Local SQLite product database, sync on reconnect, optimistic UI for offline actions.',
       'BACKLOG',      'MEDIUM',  '2026-07-12', '2026-07-14', 0,
       'priya.sharma@flowlink.dev',        'mobile,performance'),
  (11, 'App localization (EN/ES)',
       'Extracting all strings into translation files, i18n support, automatic switching based on the system language.',
       'BACKLOG',      'LOW',     '2026-07-17', '2026-07-18', 0,
       'marcus.webb@flowlink.dev',         'mobile,i18n'),
  (12, 'First-time user onboarding',
       'A 4-screen tutorial after install, permission prompts (notifications, location), a sample purchase walkthrough.',
       'BACKLOG',      'LOW',     '2026-07-03', '2026-07-05', 0,
       'priya.sharma@flowlink.dev',        'mobile,ux'),
  (13, 'Barcode scanning',
       'Device camera integration, the ZXing library, product lookup by EAN-13, add to cart.',
       'BACKLOG',      'LOWEST',  '2026-07-17', '2026-07-18', 0,
       'marcus.webb@flowlink.dev',         'mobile,extra'),
  (14, 'QA testing across devices',
       'Manual testing on 12 devices (iPhone 12/14/15, Samsung Galaxy S21/S23, Xiaomi, Pixel), Firebase Test Lab for Android.',
       'BACKLOG',      'LOW',     '2026-07-14', '2026-07-15', 0,
       'marcus.webb@flowlink.dev',         'qa,mobile'),
  (15, 'App Store and Google Play launch',
       'Preparing marketing assets, screenshots and descriptions, handling the review process, monitoring first-week ratings.',
       'BACKLOG',      'HIGH',    '2026-07-16', '2026-07-18', 0,
       'daniel.brooks@flowlink.dev',       'release,mobile,business-critical')
) AS v(tn, summary, description, status, priority, sd_offset, dd_offset, progress, assignee_email, labels)
WHERE p.project_key = 'MAPP'
ON CONFLICT (project_id, task_number) DO NOTHING;

INSERT INTO tasks (project_id, task_number, summary, description,
                   status, priority, start_date, due_date, progress,
                   assignee_id, labels, created, updated)
SELECT p.id, v.tn, v.summary, v.description,
       v.status, v.priority, (CURRENT_DATE - 20 + v.sd_offset), (CURRENT_DATE - 20 + v.dd_offset), v.progress,
       (SELECT id FROM users WHERE email = v.assignee_email),
       v.labels, NOW(), NOW()
FROM projects p,
(VALUES
  (1,  'Wholesale partner requirements analysis',
       'Workshops with 5 partners, writing up use cases, prioritizing endpoints, an SLA contract draft.',
       'DONE',         'LOW',     '2026-06-07', '2026-06-09', 100,
       'priya.sharma@flowlink.dev',        'business,research'),
  (2,  'Technology stack selection',
       'Comparison of Spring Boot vs Quarkus vs Micronaut for the API, decision: Spring Boot 3.2 with Java 21 (consistent with the existing backend).',
       'DONE',         'MEDIUM',  '2026-06-03', '2026-06-05', 100,
       'daniel.brooks@flowlink.dev',       'architecture,backend'),
  (3,  'Data model and database schema',
       'ER schema for partners, contracts and B2B orders. Liquibase migrations, composite indexes for reporting queries.',
       'TO_TEST',      'MEDIUM',  '2026-06-10', '2026-06-12', 90,
       'daniel.brooks@flowlink.dev',       'backend,database'),
  (4,  'OAuth2 + JWT authentication',
       'Spring Authorization Server rollout, the Client Credentials flow for B2B, key rotation, scope handling.',
       'BACKLOG',      'HIGHEST', '2026-06-28', '2026-07-01', 0,
       'daniel.brooks@flowlink.dev',       'backend,security,business-critical'),
  (5,  'Product CRUD endpoints (REST)',
       'GET/POST/PUT/DELETE /api/v1/products, pagination, filtering, ETag caching, RFC 7231 compliance.',
       'BACKLOG',      'HIGH',    '2026-06-14', '2026-06-17', 0,
       'marcus.webb@flowlink.dev',         'backend,rest'),
  (6,  'Order CRUD endpoints',
       'Creating partner orders, status changes, history, idempotency via the Idempotency-Key header.',
       'BACKLOG',      'HIGH',    '2026-06-21', '2026-06-24', 0,
       'marcus.webb@flowlink.dev',         'backend,rest'),
  (7,  'Event notification webhooks',
       'Delivery of order.created, order.shipped and order.cancelled events to partner URLs with exponential backoff (5 attempts).',
       'BACKLOG',      'MEDIUM',  '2026-07-15', '2026-07-17', 0,
       'priya.sharma@flowlink.dev',        'backend,integrations'),
  (8,  'Rate limiting and throttling',
       'Token bucket per API key, plan-dependent limits (Basic/Pro/Enterprise), X-RateLimit-* headers.',
       'BACKLOG',      'MEDIUM',  '2026-07-04', '2026-07-06', 0,
       'daniel.brooks@flowlink.dev',       'backend,security'),
  (9,  'OpenAPI 3.0 documentation (Swagger)',
       'Auto-generated from annotations, interactive Swagger UI, request examples, error descriptions.',
       'BACKLOG',      'LOW',     '2026-07-04', '2026-07-06', 0,
       'priya.sharma@flowlink.dev',        'docs,backend'),
  (10, 'Monitoring (Prometheus + Grafana)',
       'Metrics export, a dashboard with RPS, p95 latency and error rate, PagerDuty alerts for an SLO below 99.9%.',
       'BACKLOG',      'MEDIUM',  '2026-07-16', '2026-07-18', 0,
       'marcus.webb@flowlink.dev',         'devops,monitoring'),
  (11, 'Load testing (JMeter)',
       'Scenarios for 50/200/1000 RPS, bottleneck analysis, connection pool tuning, results feeding the SLA report.',
       'BACKLOG',      'MEDIUM',  '2026-07-19', '2026-07-21', 0,
       'marcus.webb@flowlink.dev',         'performance,qa'),
  (12, 'Partner admin panel',
       'A partner-facing view: API usage stats, order history, key regeneration, incident reporting.',
       'BACKLOG',      'LOW',     '2026-07-05', '2026-07-07', 0,
       'priya.sharma@flowlink.dev',        'frontend,admin'),
  (13, 'CSV data export',
       'Generating order reports in CSV format, streaming for large datasets, file encryption.',
       'BACKLOG',      'LOWEST',  '2026-07-18', '2026-07-19', 0,
       'priya.sharma@flowlink.dev',        'export,backend'),
  (14, 'XML export (EDI standard)',
       'Support for the EDIFACT format (ORDERS orders, INVOIC invoices), schema validation, file archiving.',
       'BACKLOG',      'LOWEST',  '2026-07-19', '2026-07-20', 0,
       'priya.sharma@flowlink.dev',        'export,backend,edi'),
  (15, 'API v1.0 launch',
       'Final release, onboarding the first 3 pilot partners, monitoring the first 72 hours, team review.',
       'BACKLOG',      'HIGH',    '2026-07-22', '2026-07-24', 0,
       'daniel.brooks@flowlink.dev',       'release,backend,business-critical')
) AS v(tn, summary, description, status, priority, sd_offset, dd_offset, progress, assignee_email, labels)
WHERE p.project_key = 'B2B'
ON CONFLICT (project_id, task_number) DO NOTHING;

UPDATE tasks
SET updated = (due_date::timestamp) + INTERVAL '1 day'
WHERE status = 'DONE'
  AND project_id IN (SELECT id FROM projects WHERE project_key IN ('ECOM','MAPP','B2B'));

INSERT INTO task_dependencies (task_id, dependency_id)
SELECT t1.id, t2.id
FROM tasks t1
JOIN projects p ON t1.project_id = p.id
JOIN tasks t2 ON t2.project_id = p.id
WHERE (p.project_key, t1.task_number, t2.task_number) IN (
  ('ECOM', 3,  1),
  ('ECOM', 4,  3),
  ('ECOM', 8,  4),
  ('ECOM', 12, 7),
  ('ECOM', 15, 14),
  ('MAPP', 2,  1),
  ('MAPP', 4,  2),
  ('MAPP', 6,  5),
  ('MAPP', 8,  7),
  ('MAPP', 15, 14),
  ('B2B',  4,  2),
  ('B2B',  5,  3),
  ('B2B',  6,  5),
  ('B2B',  8,  4),
  ('B2B',  15, 11)
)
ON CONFLICT DO NOTHING;

INSERT INTO comments (content, task_id, author_id, timestamp)
SELECT
  'The beta wireframes are ready — could the designers review them by the end of the week? Key question: do we keep the sticky CTA on the product card?',
  t.id,
  u.id,
  NOW() - INTERVAL '2 days'
FROM tasks t
JOIN projects p ON t.project_id = p.id
CROSS JOIN users u
WHERE p.project_key = 'ECOM' AND t.task_number = 3
  AND u.email = 'daniel.brooks@flowlink.dev'
  AND NOT EXISTS (
    SELECT 1 FROM comments c
    WHERE c.task_id = t.id AND c.author_id = u.id AND c.parent_comment_id IS NULL
  );

INSERT INTO comments (content, task_id, author_id, parent_comment_id, timestamp)
SELECT
  'Took a look, looks good. Let''s keep the sticky CTA — analytics showed +7% conversion after we introduced it in v1. I added detailed notes in the Figma file.',
  t.id,
  u.id,
  (SELECT c.id FROM comments c
     JOIN users ua ON c.author_id = ua.id
    WHERE c.task_id = t.id
      AND ua.email = 'daniel.brooks@flowlink.dev'
      AND c.parent_comment_id IS NULL
    LIMIT 1),
  NOW() - INTERVAL '1 days'
FROM tasks t
JOIN projects p ON t.project_id = p.id
CROSS JOIN users u
WHERE p.project_key = 'ECOM' AND t.task_number = 3
  AND u.email = 'priya.sharma@flowlink.dev'
  AND EXISTS (
    SELECT 1 FROM comments c
      JOIN users ua ON c.author_id = ua.id
    WHERE c.task_id = t.id
      AND ua.email = 'daniel.brooks@flowlink.dev'
      AND c.parent_comment_id IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM comments c
    WHERE c.task_id = t.id AND c.author_id = u.id AND c.parent_comment_id IS NOT NULL
  );

INSERT INTO comments (content, task_id, author_id, timestamp)
SELECT
  'Question for a business decision — do we integrate with Stripe Checkout (hosted) or Stripe Elements (in our own UI)? Elements gives more control over styling, Checkout is faster to ship.',
  t.id,
  u.id,
  NOW() - INTERVAL '3 hours'
FROM tasks t
JOIN projects p ON t.project_id = p.id
CROSS JOIN users u
WHERE p.project_key = 'ECOM' AND t.task_number = 8
  AND u.email = 'marcus.webb@flowlink.dev'
  AND NOT EXISTS (
    SELECT 1 FROM comments c
    WHERE c.task_id = t.id AND c.author_id = u.id AND c.parent_comment_id IS NULL
  );

INSERT INTO comments (content, task_id, author_id, timestamp)
SELECT
  'Decision approved: OAuth2 Client Credentials + JWT with a short TTL (15 min), key rotation once a quarter. Spring Authorization Server 1.2.',
  t.id,
  u.id,
  NOW() - INTERVAL '5 hours'
FROM tasks t
JOIN projects p ON t.project_id = p.id
CROSS JOIN users u
WHERE p.project_key = 'B2B' AND t.task_number = 4
  AND u.email = 'daniel.brooks@flowlink.dev'
  AND NOT EXISTS (
    SELECT 1 FROM comments c
    WHERE c.task_id = t.id AND c.author_id = u.id AND c.parent_comment_id IS NULL
  );

INSERT INTO comments (content, task_id, author_id, timestamp)
SELECT
  'I''ll align the flow with the MAPP-4 decision (biometrics). Email/password first, then prompt to enable FaceID/TouchID after the first login.',
  t.id,
  u.id,
  NOW() - INTERVAL '1 days'
FROM tasks t
JOIN projects p ON t.project_id = p.id
CROSS JOIN users u
WHERE p.project_key = 'MAPP' AND t.task_number = 5
  AND u.email = 'priya.sharma@flowlink.dev'
  AND NOT EXISTS (
    SELECT 1 FROM comments c
    WHERE c.task_id = t.id AND c.author_id = u.id AND c.parent_comment_id IS NULL
  );

INSERT INTO comment_reactions (type, comment_id, user_id)
SELECT 'LIKE', c.id, reactor.id
FROM comments c
JOIN tasks t ON c.task_id = t.id
JOIN projects p ON t.project_id = p.id
JOIN users author ON c.author_id = author.id
CROSS JOIN users reactor
WHERE p.project_key = 'ECOM' AND t.task_number = 3
  AND author.email = 'daniel.brooks@flowlink.dev'
  AND c.parent_comment_id IS NULL
  AND reactor.email = 'demo@flowlink.dev'
ON CONFLICT DO NOTHING;

INSERT INTO comment_reactions (type, comment_id, user_id)
SELECT 'LIKE', c.id, reactor.id
FROM comments c
JOIN tasks t ON c.task_id = t.id
JOIN projects p ON t.project_id = p.id
JOIN users author ON c.author_id = author.id
CROSS JOIN users reactor
WHERE p.project_key = 'ECOM' AND t.task_number = 3
  AND author.email = 'daniel.brooks@flowlink.dev'
  AND c.parent_comment_id IS NULL
  AND reactor.email = 'priya.sharma@flowlink.dev'
ON CONFLICT DO NOTHING;

INSERT INTO comment_reactions (type, comment_id, user_id)
SELECT 'LIKE', c.id, reactor.id
FROM comments c
JOIN tasks t ON c.task_id = t.id
JOIN projects p ON t.project_id = p.id
JOIN users author ON c.author_id = author.id
CROSS JOIN users reactor
WHERE p.project_key = 'ECOM' AND t.task_number = 3
  AND author.email = 'priya.sharma@flowlink.dev'
  AND c.parent_comment_id IS NOT NULL
  AND reactor.email = 'daniel.brooks@flowlink.dev'
ON CONFLICT DO NOTHING;

INSERT INTO comment_reactions (type, comment_id, user_id)
SELECT 'LIKE', c.id, reactor.id
FROM comments c
JOIN tasks t ON c.task_id = t.id
JOIN projects p ON t.project_id = p.id
JOIN users author ON c.author_id = author.id
CROSS JOIN users reactor
WHERE p.project_key = 'B2B' AND t.task_number = 4
  AND author.email = 'daniel.brooks@flowlink.dev'
  AND c.parent_comment_id IS NULL
  AND reactor.email = 'demo@flowlink.dev'
ON CONFLICT DO NOTHING;

INSERT INTO comment_reactions (type, comment_id, user_id)
SELECT 'LIKE', c.id, reactor.id
FROM comments c
JOIN tasks t ON c.task_id = t.id
JOIN projects p ON t.project_id = p.id
JOIN users author ON c.author_id = author.id
CROSS JOIN users reactor
WHERE p.project_key = 'MAPP' AND t.task_number = 5
  AND author.email = 'priya.sharma@flowlink.dev'
  AND c.parent_comment_id IS NULL
  AND reactor.email = 'demo@flowlink.dev'
ON CONFLICT DO NOTHING;

INSERT INTO notifications (user_id, message, type, is_read, link, timestamp)
SELECT u.id,
       'Daniel Brooks commented on task ECOM-3 — Main view wireframes',
       'TASK_COMMENT', false, '/projects?selectedIssue=ECOM-3',
       NOW() - INTERVAL '2 days'
FROM users u
WHERE u.email = 'demo@flowlink.dev'
  AND NOT EXISTS (SELECT 1 FROM notifications n
                  WHERE n.user_id = u.id
                    AND n.message = 'Daniel Brooks commented on task ECOM-3 — Main view wireframes');

INSERT INTO notifications (user_id, message, type, is_read, link, timestamp)
SELECT u.id,
       'Priya Sharma replied to a comment thread on ECOM-3',
       'COMMENT_REPLY', false, '/projects?selectedIssue=ECOM-3',
       NOW() - INTERVAL '1 days'
FROM users u
WHERE u.email = 'demo@flowlink.dev'
  AND NOT EXISTS (SELECT 1 FROM notifications n
                  WHERE n.user_id = u.id
                    AND n.message = 'Priya Sharma replied to a comment thread on ECOM-3');

INSERT INTO notifications (user_id, message, type, is_read, link, timestamp)
SELECT u.id,
       'Marcus Webb commented on task ECOM-8 — New shopping cart',
       'TASK_COMMENT', false, '/projects?selectedIssue=ECOM-8',
       NOW() - INTERVAL '3 hours'
FROM users u
WHERE u.email = 'demo@flowlink.dev'
  AND NOT EXISTS (SELECT 1 FROM notifications n
                  WHERE n.user_id = u.id
                    AND n.message = 'Marcus Webb commented on task ECOM-8 — New shopping cart');

INSERT INTO notifications (user_id, message, type, is_read, link, timestamp)
SELECT u.id,
       'Daniel Brooks commented on task B2B-4 — OAuth2 + JWT authentication',
       'TASK_COMMENT', true, '/projects?selectedIssue=B2B-4',
       NOW() - INTERVAL '5 hours'
FROM users u
WHERE u.email = 'demo@flowlink.dev'
  AND NOT EXISTS (SELECT 1 FROM notifications n
                  WHERE n.user_id = u.id
                    AND n.message = 'Daniel Brooks commented on task B2B-4 — OAuth2 + JWT authentication');

INSERT INTO notifications (user_id, message, type, is_read, link, timestamp)
SELECT u.id,
       'Priya Sharma commented on task MAPP-5 — Sign-in and registration screen',
       'TASK_COMMENT', true, '/projects?selectedIssue=MAPP-5',
       NOW() - INTERVAL '1 days'
FROM users u
WHERE u.email = 'demo@flowlink.dev'
  AND NOT EXISTS (SELECT 1 FROM notifications n
                  WHERE n.user_id = u.id
                    AND n.message = 'Priya Sharma commented on task MAPP-5 — Sign-in and registration screen');

INSERT INTO notifications (user_id, message, type, is_read, link, timestamp)
SELECT u.id,
       'Task ECOM-3 was updated (status: IN_PROGRESS, progress: 50%)',
       'TASK_UPDATED', true, '/projects?selectedIssue=ECOM-3',
       NOW() - INTERVAL '2 days'
FROM users u
WHERE u.email = 'demo@flowlink.dev'
  AND NOT EXISTS (SELECT 1 FROM notifications n
                  WHERE n.user_id = u.id
                    AND n.message = 'Task ECOM-3 was updated (status: IN_PROGRESS, progress: 50%)');

UPDATE users SET version = 0
WHERE version IS NULL AND email LIKE '%@flowlink.dev';

UPDATE projects SET version = 0
WHERE version IS NULL AND project_key IN ('ECOM','MAPP','B2B');

UPDATE tasks SET version = 0
WHERE version IS NULL
  AND project_id IN (SELECT id FROM projects WHERE project_key IN ('ECOM','MAPP','B2B'));

UPDATE comments SET version = 0
WHERE version IS NULL
  AND task_id IN (SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
                  WHERE p.project_key IN ('ECOM','MAPP','B2B'));

COMMIT;
