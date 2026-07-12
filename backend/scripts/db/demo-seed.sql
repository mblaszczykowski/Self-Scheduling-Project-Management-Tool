-- ============================================================================
-- FlowLink — Dane demonstracyjne do pracy magisterskiej
-- ============================================================================
--
-- Skrypt tworzy spójny zestaw danych demonstracyjnych zgodny ze scenariuszem
-- opisanym w rozdziale 5 pracy ("Studium demonstracyjne"):
--
--   * 1 konto managera + 3 konta wykonawców (K = 3 zasoby)
--   * 3 projekty IT (e-commerce, mobile, B2B API)
--   * 45 zadań (15 na projekt) z rozkładem priorytetów 10/20/40/20/10 %
--   * 15 zależności kolejnościowych (~33 % zadań)
--   * 8 statusów cyklu życia zadania używanych w demo (BACKLOG, GATHERING_INTEREST,
--     TODO, IN_PROGRESS, TO_REVIEW, TO_TEST, IN_TEST, READY_TO_MERGE, DONE)
--     — pełen przekrój workflow widoczny w widoku TaskListView
--   * ~15 par konfliktów zasobowych w 6 świadomie zaprojektowanych klastrach (A–F)
--     — gotowy materiał demonstracyjny dla optymalizatora
--   * komentarze, reakcje, powiadomienia — dla wzbogacenia widoków
--
-- KONTO DEMO DO LOGOWANIA:
--   Email:  demo@flowlink.pl
--   Hasło:  Demo1234!
--
-- Identyczne hasło (Demo1234!) dla kont wykonawców:
--   piotr.kowalski@flowlink.pl
--   marta.wisniewska@flowlink.pl
--   tomasz.lewandowski@flowlink.pl
--
-- Hash BCrypt (cost=10) powyższego hasła:
--   $2b$10$mpV2p05Dv44wn2ELzedN6.q4zy9xoNyyHXoGm46kmX5TIQTpqpNzO
-- Wygenerowany przez:
--   python3 -c 'import bcrypt; print(bcrypt.hashpw(b"Demo1234!", bcrypt.gensalt(10)).decode())'
--
-- URUCHAMIANIE:
--   psql -U postgres -d flowlink -f demo-seed.sql
--
-- PONOWNE URUCHOMIENIE:
--   Skrypt jest w pełni powtarzalny. Na samym początku (sekcja 0)
--   wykonywane jest pełne czyszczenie wszystkich danych demo, a potem
--   wszystko jest ładowane od zera. Możesz więc uruchomić optymalizację
--   w aplikacji (zmiany w bazie), a kolejnym odpaleniem tego skryptu
--   wrócić do stanu bazowego i powtórzyć demo.
--
-- UWAGA: Hash hasła wygenerowany lokalnie i zweryfikowany — działa
-- z Spring Security BCryptPasswordEncoder (akceptuje zarówno prefiks $2a$
-- jak i $2b$). Hasło `Demo1234!` spełnia politykę walidacji `ValidationUtil`:
-- minimum 8 znaków, duża i mała litera, cyfra, znak specjalny.
--
-- ============================================================================
-- PRZEWIDYWANE WYNIKI OPTYMALIZACJI (narracyjny scenariusz dla pracy)
-- ============================================================================
-- Seed został zaprojektowany tak, by demonstrować tezę pracy krystalicznie:
--   * zadania HIGHEST/HIGH mają zarezerwowane sloty bez kolizji,
--   * konflikty zasobowe skumulowane są w zadaniach LOW/LOWEST,
--   * przesunięcia po optymalizacji są monotonicznie rosnące względem
--     priorytetu (HIGHEST = 0 dni → LOWEST = kilkanaście dni).
--
-- Spodziewane metryki po uruchomieniu "Optimize Schedule":
--   Konflikty zasobowe       :  ~12-15   →  0     (eliminacja 100 %)
--   Zadania przesunięte      :  ok.  15-20 / 40   (nie 40/40)
--   Średnie przesunięcie     :  ok.  5-8  dni
--   Maksymalne przesunięcie  :  ok.  15-20 dni    (dla LOW/LOWEST)
--   Zadania HIGH/HIGHEST     :  0 dni przesunięcia  (5 + 9 = 14 zadań)
--   Zadania MEDIUM           :  drobne przesunięcia (1-5 dni, 2-3 zadania)
--   Zadania LOW              :  10-15 dni przesunięcia
--   Zadania LOWEST           :  15-20 dni przesunięcia
--   Terminowość HIGH/HIGHEST :  100 %
--   Ogólna terminowość       :  >= 90 %
--
-- Horyzont scenariusza: 2026-05-31 → 2026-07-26 (57 dni kalendarzowych).
-- Kompaktowy układ pozwala zmieścić cały wykres Gantta na jednym zrzucie.
--
-- Kluczowe klastry konfliktów (gotowy materiał do "Show what changes"):
--   Klaster A (23.05 – 27.05, Marta) : ECOM-11, MAPP-12, B2B-9, B2B-12
--     — cztery zadania LOW nakładające się na Martę (5 par konfliktów).
--   Klaster B (07.06 – 09.06, Marta) : ECOM-10, B2B-13, B2B-14
--     — trzy zadania LOWEST, dwa eksporty danych + odświeżenie kontaktu.
--   Klaster C (06.06 – 07.06, Tomasz): MAPP-11, MAPP-13 + B2B-10 (MEDIUM)
--     — zadania LOW/LOWEST vs MEDIUM, LOW/LOWEST się przesuną.
--   Konflikt D (24.05 – 26.05, Piotr): ECOM-7 (MEDIUM) vs B2B-8 (MEDIUM)
--     — pokazuje, że MEDIUM też potrafią się przesunąć, ale niewiele.
--   Konflikt E (04.05 – 07.05, Tomasz): ECOM-6 (LOW) vs B2B-5 (HIGH)
--     — modelowy przykład: HIGH zachowuje swoją pozycję, LOW przesuwa się.
--   Konflikt F (30.04 – 01.05, Piotr): MAPP-2 (HIGH) vs B2B-3 (MEDIUM)
--     — kolejny dowód protekcji HIGH: MEDIUM ustępuje.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0a. NAPRAWA CHECK-CONSTRAINTÓW DLA ENUMÓW
-- ============================================================================
-- Hibernate z ddl-auto=update generuje CHECK-constrainty dla kolumn enum
-- (np. notifications.type, tasks.status), ale NIE aktualizuje ich, gdy
-- w kodzie Java pojawią się nowe wartości enum. W efekcie INSERT z nową
-- wartością (np. 'TASK_COMMENT' dodane do enum NotificationType po pierwszym
-- starcie aplikacji) zostaje odrzucony.
--
-- Poniższy blok DROP + ADD constraint synchronizuje check-constrainty
-- z aktualnym stanem enumów Java. Jest bezpieczny — DROP IF EXISTS działa
-- nawet gdy constraint nie istnieje.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'PROJECT_INVITATION','PROJECT_UPDATED','MEMBER_REMOVED',
    'TASK_ASSIGNED','TASK_UPDATED','TASK_COMMENT','TASK_DELETED',
    'COMMENT_REPLY','COMMENT_REACTION'
  ));

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN (
    'BACKLOG','GATHERING_INTEREST','TODO','WITHDRAWN',
    'IN_PROGRESS','TO_REVIEW','TO_TEST','IN_TEST',
    'READY_TO_MERGE','READY_TO_DEPLOY','RELEASED','DONE'
  ));

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check
  CHECK (priority IN ('LOWEST','LOW','MEDIUM','HIGH','HIGHEST'));

ALTER TABLE comment_reactions DROP CONSTRAINT IF EXISTS comment_reactions_type_check;
ALTER TABLE comment_reactions ADD CONSTRAINT comment_reactions_type_check
  CHECK (type IN ('LIKE','DISLIKE'));

ALTER TABLE task_activities DROP CONSTRAINT IF EXISTS task_activities_type_check;
ALTER TABLE task_activities ADD CONSTRAINT task_activities_type_check
  CHECK (type IN (
    'CREATED','STATUS_CHANGED','PRIORITY_CHANGED','ASSIGNEE_CHANGED',
    'PROGRESS_CHANGED','DATES_CHANGED','SUMMARY_CHANGED','DESCRIPTION_CHANGED',
    'LABELS_CHANGED','DEPENDENCIES_CHANGED','ATTACHMENTS_CHANGED',
    'COMMENT_ADDED','COMMENT_DELETED'
  ));


-- ============================================================================
-- 0.  CZYSZCZENIE — powrót do stanu bazowego
-- ============================================================================
-- Sekcja jest AKTYWNA (nie jest zakomentowana) — każde uruchomienie skryptu
-- najpierw usuwa wszystkie dane demo (konta @flowlink.pl oraz projekty
-- ECOM / MAPP / B2B wraz z ich zawartością), a następnie wstawia je od nowa.
--
-- Dzięki temu możesz:
--   1. Odpalić skrypt, żeby załadować dane demo.
--   2. Uruchomić optymalizację w aplikacji (zmiany zapisują się w bazie).
--   3. Ponownie odpalić ten skrypt — wraca stan bazowy, a optymalizację
--      można powtórzyć na świeżych danych.
--
-- Kolejność DELETE uwzględnia klucze obce (dziecko → rodzic).

-- Załączniki (jeśli użytkownik coś dodał przez UI)
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

-- Reakcje na komentarze
DELETE FROM comment_reactions
WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@flowlink.pl')
   OR comment_id IN (
     SELECT c.id FROM comments c
       JOIN tasks t ON c.task_id = t.id
       JOIN projects p ON t.project_id = p.id
     WHERE p.project_key IN ('ECOM','MAPP','B2B'));

-- Komentarze (self-ref parent_comment_id znika razem z całym zestawem)
DELETE FROM comments
WHERE author_id IN (SELECT id FROM users WHERE email LIKE '%@flowlink.pl')
   OR task_id IN (
     SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
     WHERE p.project_key IN ('ECOM','MAPP','B2B'));

-- Powiadomienia
DELETE FROM notifications
WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@flowlink.pl');

-- Aktywność zadań (historia zmian)
DELETE FROM task_activities
WHERE author_id IN (SELECT id FROM users WHERE email LIKE '%@flowlink.pl')
   OR task_id IN (
     SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
     WHERE p.project_key IN ('ECOM','MAPP','B2B'));

-- Zależności zadań
DELETE FROM task_dependencies
WHERE task_id IN (
     SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
     WHERE p.project_key IN ('ECOM','MAPP','B2B'))
   OR dependency_id IN (
     SELECT t.id FROM tasks t JOIN projects p ON t.project_id = p.id
     WHERE p.project_key IN ('ECOM','MAPP','B2B'));

-- Zadania
DELETE FROM tasks
WHERE project_id IN (SELECT id FROM projects WHERE project_key IN ('ECOM','MAPP','B2B'));

-- Członkowie projektów
DELETE FROM project_members
WHERE project_id IN (SELECT id FROM projects WHERE project_key IN ('ECOM','MAPP','B2B'))
   OR user_id IN (SELECT id FROM users WHERE email LIKE '%@flowlink.pl');

-- Zależności między projektami (jeśli utworzone w UI)
DELETE FROM project_dependencies
WHERE project_id IN (SELECT id FROM projects WHERE project_key IN ('ECOM','MAPP','B2B'))
   OR dependency_id IN (SELECT id FROM projects WHERE project_key IN ('ECOM','MAPP','B2B'));

-- Tokeny odświeżające (JWT refresh) — żeby stare sesje nie wisiały
DELETE FROM refresh_tokens
WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@flowlink.pl');

-- Projekty
DELETE FROM projects WHERE project_key IN ('ECOM','MAPP','B2B');

-- Użytkownicy demo
DELETE FROM users WHERE email LIKE '%@flowlink.pl';


-- ============================================================================
-- 1.  UŻYTKOWNICY
-- ============================================================================
-- Hash BCrypt (cost=10) dla hasła "Demo1234!":
--   $2b$10$mpV2p05Dv44wn2ELzedN6.q4zy9xoNyyHXoGm46kmX5TIQTpqpNzO

INSERT INTO users (first_name, last_name, email, password,
                   email_notifications_enabled, email_on_task_assigned,
                   email_on_comment_reply, email_on_project_invitation)
VALUES
  ('Anna',   'Nowak',        'demo@flowlink.pl',
   '$2b$10$mpV2p05Dv44wn2ELzedN6.q4zy9xoNyyHXoGm46kmX5TIQTpqpNzO',
   true, true, true, true),
  ('Piotr',  'Kowalski',     'piotr.kowalski@flowlink.pl',
   '$2b$10$mpV2p05Dv44wn2ELzedN6.q4zy9xoNyyHXoGm46kmX5TIQTpqpNzO',
   true, true, true, true),
  ('Marta',  'Wiśniewska',   'marta.wisniewska@flowlink.pl',
   '$2b$10$mpV2p05Dv44wn2ELzedN6.q4zy9xoNyyHXoGm46kmX5TIQTpqpNzO',
   true, true, true, true),
  ('Tomasz', 'Lewandowski',  'tomasz.lewandowski@flowlink.pl',
   '$2b$10$mpV2p05Dv44wn2ELzedN6.q4zy9xoNyyHXoGm46kmX5TIQTpqpNzO',
   true, true, true, true)
ON CONFLICT (email) DO NOTHING;


-- ============================================================================
-- 2.  PROJEKTY
-- ============================================================================
-- next_task_number = 16 — po wstawieniu 15 zadań kolejne z API otrzyma nr 16.

INSERT INTO projects (project_key, summary, description, next_task_number, owner_id)
SELECT 'ECOM',
       'Redesign platformy e-commerce',
       'Kompleksowa modernizacja sklepu internetowego: nowy UX/UI, optymalizacja wydajności, wdrożenie nowego koszyka zakupowego oraz integracja z bramką płatności Stripe. Cel: wzrost konwersji o minimum 15 % w ciągu pierwszego kwartału po wdrożeniu.',
       16, u.id
FROM users u WHERE u.email = 'demo@flowlink.pl'
ON CONFLICT (project_key) DO NOTHING;

INSERT INTO projects (project_key, summary, description, next_task_number, owner_id)
SELECT 'MAPP',
       'Aplikacja mobilna iOS/Android',
       'Natywna aplikacja mobilna towarzysząca platformie webowej. Funkcje: logowanie biometryczne (FaceID/TouchID), push-notyfikacje o zamówieniach, tryb offline z lokalnym cache oraz skanowanie kodów kreskowych produktów.',
       16, u.id
FROM users u WHERE u.email = 'demo@flowlink.pl'
ON CONFLICT (project_key) DO NOTHING;

INSERT INTO projects (project_key, summary, description, next_task_number, owner_id)
SELECT 'B2B',
       'Integracja z API partnerów hurtowych',
       'Udostępnienie publicznego REST API dla partnerów B2B. OAuth2 z JWT, webhooks dla zdarzeń zamówień, rate limiting, dokumentacja OpenAPI 3.0, panel administracyjny dla partnerów oraz eksport danych w formatach CSV i XML (EDI).',
       16, u.id
FROM users u WHERE u.email = 'demo@flowlink.pl'
ON CONFLICT (project_key) DO NOTHING;


-- ============================================================================
-- 3.  CZŁONKOWIE PROJEKTÓW
-- ============================================================================
-- Wszyscy trzej wykonawcy pracują w każdym z trzech projektów — dzięki temu
-- algorytm MORCPSP operuje na wspólnej puli zasobów (K = 3).

INSERT INTO project_members (project_id, user_id)
SELECT p.id, u.id
FROM projects p
CROSS JOIN users u
WHERE p.project_key IN ('ECOM', 'MAPP', 'B2B')
  AND u.email IN ('piotr.kowalski@flowlink.pl',
                  'marta.wisniewska@flowlink.pl',
                  'tomasz.lewandowski@flowlink.pl')
ON CONFLICT DO NOTHING;


-- ============================================================================
-- 4.  ZADANIA — PROJEKT ECOM (e-commerce)
-- ============================================================================
-- Rozkład priorytetów: 2 HIGHEST, 3 HIGH, 6 MEDIUM, 3 LOW, 1 LOWEST.

INSERT INTO tasks (project_id, task_number, summary, description,
                   status, priority, start_date, due_date, progress,
                   assignee_id, labels, created, updated)
SELECT p.id, v.tn, v.summary, v.description,
       v.status, v.priority, v.sd::date, v.dd::date, v.progress,
       (SELECT id FROM users WHERE email = v.assignee_email),
       v.labels, NOW(), NOW()
FROM projects p,
(VALUES
  (1,  'Audyt UX obecnej strony sklepu',
       'Przegląd ścieżek zakupowych, analiza heatmap Hotjar z ostatnich 6 miesięcy, wywiady z 8 klientami, raport z rekomendacjami.',
       'DONE',         'MEDIUM',  '2026-05-31', '2026-06-02', 100,
       'piotr.kowalski@flowlink.pl',       'research,ux'),
  (2,  'Research konkurencji i trendów e-commerce 2026',
       'Analiza 10 konkurencyjnych platform (Allegro, Amazon, eMAG, Shopee), tabela porównawcza funkcji, rekomendacje kierunkowe.',
       'DONE',         'LOW',     '2026-06-03', '2026-06-05', 100,
       'marta.wisniewska@flowlink.pl',     'research'),
  (3,  'Wireframes głównych widoków',
       'Wireframe strony głównej, listy produktów, karty produktu, koszyka i checkoutu. Narzędzie: Figma. 3 iteracje review z designem.',
       'TO_REVIEW',    'HIGH',    '2026-06-14', '2026-06-17', 80,
       'piotr.kowalski@flowlink.pl',       'design,ux'),
  (4,  'Projekt graficzny strony głównej',
       'Pełny design strony głównej w stylu minimalistycznym: hero section, grid produktów, testimonials, newsletter CTA. Zgodność z systemem designu.',
       'BACKLOG',      'HIGH',    '2026-06-21', '2026-06-24', 0,
       'marta.wisniewska@flowlink.pl',     'design'),
  (5,  'Projekt graficzny listy i karty produktu',
       'Szablony widoków listy produktów (grid + list) oraz karty produktu z galerią, wariantami, rekomendacjami.',
       'BACKLOG',      'MEDIUM',  '2026-06-25', '2026-06-28', 0,
       'marta.wisniewska@flowlink.pl',     'design'),
  (6,  'Migracja treści z obecnego CMS',
       'Eksport 1200+ opisów produktów z obecnego systemu, oczyszczenie HTML, import do nowej bazy z zachowaniem SEO-slug.',
       'IN_TEST',      'LOW',     '2026-06-14', '2026-06-17', 75,
       'tomasz.lewandowski@flowlink.pl',   'backend,migration'),
  (7,  'Implementacja komponentów UI w React',
       'Biblioteka komponentów: Button, Input, Modal, ProductCard, Cart, ImageGallery. TypeScript, Storybook, testy jednostkowe.',
       'TODO',         'MEDIUM',  '2026-07-02', '2026-07-06', 0,
       'piotr.kowalski@flowlink.pl',       'frontend'),
  (8,  'Nowy koszyk zakupowy z mini-widokiem',
       'Przebudowa koszyka: mini-widok w headerze, pełna strona koszyka, walidacja stanów magazynowych, przeliczanie promocji.',
       'BACKLOG',      'HIGHEST', '2026-06-28', '2026-07-01', 0,
       'tomasz.lewandowski@flowlink.pl',   'frontend,business-critical'),
  (9,  'Integracja bramki płatności Stripe',
       'Stripe Elements + Stripe Connect dla sprzedawców, 3D Secure, obsługa BLIK i kart, webhooks do zmian statusu zamówienia.',
       'BACKLOG',      'HIGH',    '2026-07-02', '2026-07-05', 0,
       'tomasz.lewandowski@flowlink.pl',   'backend,payments'),
  (10, 'Odświeżenie strony kontaktu',
       'Nowy formularz kontaktowy z integracją z CRM, mapa Google z placówkami, godziny otwarcia biura obsługi.',
       'BACKLOG',      'LOWEST',  '2026-07-18', '2026-07-20', 0,
       'marta.wisniewska@flowlink.pl',     'content'),
  (11, 'Nowy formularz zapisu na newsletter',
       'Pop-up exit-intent, sekcja w stopce, double opt-in, integracja z Mailchimp, segmentacja użytkowników.',
       'BACKLOG',      'LOW',     '2026-07-03', '2026-07-04', 0,
       'marta.wisniewska@flowlink.pl',     'marketing'),
  (12, 'Optymalizacja SEO (meta, sitemap, schema.org)',
       'Audyt techniczny SEO, uzupełnienie meta-tagów, generowanie sitemap.xml, mikroformaty schema.org dla produktów.',
       'BACKLOG',      'MEDIUM',  '2026-07-07', '2026-07-09', 0,
       'piotr.kowalski@flowlink.pl',       'seo,backend'),
  (13, 'Testy A/B nowej strategii cenowej',
       'Konfiguracja testów A/B (Optimize), dwie grupy eksperymentalne, analiza wpływu na konwersję i średnią wartość koszyka.',
       'BACKLOG',      'MEDIUM',  '2026-07-22', '2026-07-24', 0,
       'tomasz.lewandowski@flowlink.pl',   'analytics,business'),
  (14, 'Wdrożenie na środowisko staging',
       'Deploy pełnej wersji 2.0 na staging, testy regresji, load testing 1000 RPS, finalna akceptacja zespołu biznesowego.',
       'BACKLOG',      'MEDIUM',  '2026-07-13', '2026-07-15', 0,
       'piotr.kowalski@flowlink.pl',       'devops'),
  (15, 'Release produkcyjny wersji 2.0',
       'Finalny deploy na produkcję w oknie serwisowym (sobota 02:00), monitoring wskaźników przez 48h, rollback plan.',
       'BACKLOG',      'HIGHEST', '2026-07-25', '2026-07-26', 0,
       'piotr.kowalski@flowlink.pl',       'devops,business-critical')
) AS v(tn, summary, description, status, priority, sd, dd, progress, assignee_email, labels)
WHERE p.project_key = 'ECOM'
ON CONFLICT (project_id, task_number) DO NOTHING;


-- ============================================================================
-- 5.  ZADANIA — PROJEKT MAPP (mobile)
-- ============================================================================
-- Rozkład priorytetów: 2 HIGHEST, 3 HIGH, 6 MEDIUM, 3 LOW, 1 LOWEST.

INSERT INTO tasks (project_id, task_number, summary, description,
                   status, priority, start_date, due_date, progress,
                   assignee_id, labels, created, updated)
SELECT p.id, v.tn, v.summary, v.description,
       v.status, v.priority, v.sd::date, v.dd::date, v.progress,
       (SELECT id FROM users WHERE email = v.assignee_email),
       v.labels, NOW(), NOW()
FROM projects p,
(VALUES
  (1,  'Research technologii (Native vs React Native vs Flutter)',
       'Porównanie trzech podejść: natywne (Swift/Kotlin), React Native, Flutter. Benchmark wydajności, koszty utrzymania, dostępność bibliotek.',
       'DONE',         'MEDIUM',  '2026-05-31', '2026-06-02', 100,
       'marta.wisniewska@flowlink.pl',     'research,mobile'),
  (2,  'Projekt architektury aplikacji',
       'Diagram komponentów, wybór stacku (React Native + TypeScript + Redux Toolkit), struktura modułów, strategia nawigacji.',
       'READY_TO_MERGE','HIGH',   '2026-06-07', '2026-06-11', 100,
       'piotr.kowalski@flowlink.pl',       'architecture,mobile'),
  (3,  'Konfiguracja CI/CD z Fastlane',
       'Automatyczne buildy iOS i Android, znakowanie wersji, upload do TestFlight i internal track Google Play, Slack notifications.',
       'GATHERING_INTEREST', 'MEDIUM',  '2026-07-06', '2026-07-08', 0,
       'tomasz.lewandowski@flowlink.pl',   'devops,mobile'),
  (4,  'Implementacja logowania biometrycznego',
       'FaceID (iOS) + BiometricPrompt (Android), bezpieczne przechowywanie tokena w Keychain/Keystore, fallback do PIN.',
       'BACKLOG',      'HIGHEST', '2026-06-21', '2026-06-23', 0,
       'piotr.kowalski@flowlink.pl',       'mobile,security,business-critical'),
  (5,  'Ekran logowania i rejestracji',
       'Design i implementacja flow auth: email/hasło, OAuth (Google, Apple), rejestracja z weryfikacją email.',
       'BACKLOG',      'MEDIUM',  '2026-06-29', '2026-07-02', 0,
       'marta.wisniewska@flowlink.pl',     'mobile,frontend'),
  (6,  'Ekran listy produktów z infinite scroll',
       'Pobieranie listy z API z paginacją, infinite scroll, pull-to-refresh, skeleton loading, filtry kategorii.',
       'BACKLOG',      'HIGH',    '2026-07-08', '2026-07-11', 0,
       'marta.wisniewska@flowlink.pl',     'mobile,frontend'),
  (7,  'Ekran szczegółów produktu',
       'Galeria zdjęć z pinch-to-zoom, wybór wariantów (rozmiar, kolor), przycisk dodania do koszyka, rekomendacje.',
       'BACKLOG',      'MEDIUM',  '2026-07-09', '2026-07-11', 0,
       'tomasz.lewandowski@flowlink.pl',   'mobile,frontend'),
  (8,  'Koszyk mobilny z checkoutem',
       'Wdrożenie koszyka, integracja z Apple Pay / Google Pay, walidacja kodów rabatowych, przekazanie do Stripe.',
       'BACKLOG',      'HIGHEST', '2026-07-12', '2026-07-15', 0,
       'tomasz.lewandowski@flowlink.pl',   'mobile,business-critical'),
  (9,  'Push notyfikacje (FCM + APNS)',
       'Konfiguracja Firebase Cloud Messaging i Apple Push Notifications, segmentacja odbiorców, szablony wiadomości.',
       'BACKLOG',      'MEDIUM',  '2026-07-10', '2026-07-12', 0,
       'piotr.kowalski@flowlink.pl',       'mobile,backend'),
  (10, 'Tryb offline z lokalnym cache',
       'SQLite lokalna baza produktów, synchronizacja przy powrocie online, optymistyczne UI dla akcji offline.',
       'BACKLOG',      'MEDIUM',  '2026-07-12', '2026-07-14', 0,
       'marta.wisniewska@flowlink.pl',     'mobile,performance'),
  (11, 'Lokalizacja aplikacji (PL/EN)',
       'Wyciągnięcie wszystkich stringów do plików tłumaczeń, obsługa i18n, automatyczne przełączanie języka systemu.',
       'BACKLOG',      'LOW',     '2026-07-17', '2026-07-18', 0,
       'tomasz.lewandowski@flowlink.pl',   'mobile,i18n'),
  (12, 'Onboarding pierwszego użytkownika',
       '4-ekranowy tutorial po instalacji, prośba o zgody (notyfikacje, lokalizacja), przykładowy przepływ zakupu.',
       'BACKLOG',      'LOW',     '2026-07-03', '2026-07-05', 0,
       'marta.wisniewska@flowlink.pl',     'mobile,ux'),
  (13, 'Skanowanie kodu kreskowego (barcode)',
       'Integracja z kamerą urządzenia, biblioteka ZXing, wyszukiwanie produktu po EAN-13, dodanie do koszyka.',
       'BACKLOG',      'LOWEST',  '2026-07-17', '2026-07-18', 0,
       'tomasz.lewandowski@flowlink.pl',   'mobile,extra'),
  (14, 'Testy QA na różnych urządzeniach',
       'Testy manualne na 12 urządzeniach (iPhone 12/14/15, Samsung Galaxy S21/S23, Xiaomi, Pixel), Firebase Test Lab dla Android.',
       'BACKLOG',      'LOW',     '2026-07-14', '2026-07-15', 0,
       'tomasz.lewandowski@flowlink.pl',   'qa,mobile'),
  (15, 'Publikacja w App Store i Google Play',
       'Przygotowanie assetów marketingowych, screenshotów, opisów, obsługa procesu review, monitoring ocen pierwszego tygodnia.',
       'BACKLOG',      'HIGH',    '2026-07-16', '2026-07-18', 0,
       'piotr.kowalski@flowlink.pl',       'release,mobile,business-critical')
) AS v(tn, summary, description, status, priority, sd, dd, progress, assignee_email, labels)
WHERE p.project_key = 'MAPP'
ON CONFLICT (project_id, task_number) DO NOTHING;


-- ============================================================================
-- 6.  ZADANIA — PROJEKT B2B (API partnerów)
-- ============================================================================
-- Rozkład priorytetów: 1 HIGHEST, 3 HIGH, 6 MEDIUM, 3 LOW, 2 LOWEST.

INSERT INTO tasks (project_id, task_number, summary, description,
                   status, priority, start_date, due_date, progress,
                   assignee_id, labels, created, updated)
SELECT p.id, v.tn, v.summary, v.description,
       v.status, v.priority, v.sd::date, v.dd::date, v.progress,
       (SELECT id FROM users WHERE email = v.assignee_email),
       v.labels, NOW(), NOW()
FROM projects p,
(VALUES
  (1,  'Analiza wymagań biznesowych partnerów hurtowych',
       'Warsztaty z 5 partnerami, spisanie use case''ów, priorytetyzacja endpointów, draft umowy SLA.',
       'DONE',         'LOW',     '2026-06-07', '2026-06-09', 100,
       'marta.wisniewska@flowlink.pl',     'business,research'),
  (2,  'Wybór stacku technologicznego',
       'Porównanie Spring Boot vs Quarkus vs Micronaut dla API, decyzja: Spring Boot 3.2 z Java 21 (spójność z istniejącym backendem).',
       'DONE',         'MEDIUM',  '2026-06-03', '2026-06-05', 100,
       'piotr.kowalski@flowlink.pl',       'architecture,backend'),
  (3,  'Model danych i schemat bazy',
       'Schemat ER dla partnerów, kontraktów, zamówień B2B. Migracje Liquibase, indeksy złożone dla zapytań raportowych.',
       'TO_TEST',      'MEDIUM',  '2026-06-10', '2026-06-12', 90,
       'piotr.kowalski@flowlink.pl',       'backend,database'),
  (4,  'Autentykacja OAuth2 + JWT',
       'Wdrożenie Spring Authorization Server, Client Credentials flow dla B2B, rotacja kluczy, obsługa scope''ów.',
       'BACKLOG',      'HIGHEST', '2026-06-28', '2026-07-01', 0,
       'piotr.kowalski@flowlink.pl',       'backend,security,business-critical'),
  (5,  'Endpointy CRUD produktów (REST)',
       'GET/POST/PUT/DELETE /api/v1/products, paginacja, filtrowanie, ETag dla cachowania, zgodność z RFC 7231.',
       'BACKLOG',      'HIGH',    '2026-06-14', '2026-06-17', 0,
       'tomasz.lewandowski@flowlink.pl',   'backend,rest'),
  (6,  'Endpointy CRUD zamówień',
       'Tworzenie zamówień partnerskich, zmiana statusu, historia, idempotencja przez Idempotency-Key header.',
       'BACKLOG',      'HIGH',    '2026-06-21', '2026-06-24', 0,
       'tomasz.lewandowski@flowlink.pl',   'backend,rest'),
  (7,  'Webhooks notyfikacji zdarzeń',
       'Dostawa zdarzeń order.created, order.shipped, order.cancelled do URL partnerów z exponential backoff (5 prób).',
       'BACKLOG',      'MEDIUM',  '2026-07-15', '2026-07-17', 0,
       'marta.wisniewska@flowlink.pl',     'backend,integrations'),
  (8,  'Rate limiting i throttling',
       'Token bucket per api_key, limity zależne od planu (Basic/Pro/Enterprise), nagłówki X-RateLimit-*.',
       'BACKLOG',      'MEDIUM',  '2026-07-04', '2026-07-06', 0,
       'piotr.kowalski@flowlink.pl',       'backend,security'),
  (9,  'Dokumentacja OpenAPI 3.0 (Swagger)',
       'Automatyczne generowanie z adnotacji, interaktywny Swagger UI, przykłady żądań, opis błędów.',
       'BACKLOG',      'LOW',     '2026-07-04', '2026-07-06', 0,
       'marta.wisniewska@flowlink.pl',     'docs,backend'),
  (10, 'Monitoring (Prometheus + Grafana)',
       'Eksport metryk, dashboard z RPS, p95 latency, error rate, alerty PagerDuty dla SLO < 99.9 %.',
       'BACKLOG',      'MEDIUM',  '2026-07-16', '2026-07-18', 0,
       'tomasz.lewandowski@flowlink.pl',   'devops,monitoring'),
  (11, 'Testy obciążeniowe (JMeter)',
       'Scenariusze dla 50/200/1000 RPS, analiza wąskich gardeł, optymalizacja pool connection, wyniki do raportu SLA.',
       'BACKLOG',      'MEDIUM',  '2026-07-19', '2026-07-21', 0,
       'tomasz.lewandowski@flowlink.pl',   'performance,qa'),
  (12, 'Panel administracyjny partnerów',
       'Widok dla partnerów: statystyki użycia API, historia zamówień, regeneracja kluczy, zgłaszanie incydentów.',
       'BACKLOG',      'LOW',     '2026-07-05', '2026-07-07', 0,
       'marta.wisniewska@flowlink.pl',     'frontend,admin'),
  (13, 'Eksport danych do CSV',
       'Generowanie raportów zamówień w formacie CSV, strumieniowanie dla dużych zbiorów, szyfrowanie plików.',
       'BACKLOG',      'LOWEST',  '2026-07-18', '2026-07-19', 0,
       'marta.wisniewska@flowlink.pl',     'export,backend'),
  (14, 'Eksport do XML (standard EDI)',
       'Wsparcie dla formatu EDIFACT (zamówienia ORDERS, faktury INVOIC), walidacja schematu, archiwizacja plików.',
       'BACKLOG',      'LOWEST',  '2026-07-19', '2026-07-20', 0,
       'marta.wisniewska@flowlink.pl',     'export,backend,edi'),
  (15, 'Publikacja API v1.0',
       'Finalny release, rejestracja pierwszych 3 partnerów pilotażowych, monitoring pierwszych 72 h, review z zespołem.',
       'BACKLOG',      'HIGH',    '2026-07-22', '2026-07-24', 0,
       'piotr.kowalski@flowlink.pl',       'release,backend,business-critical')
) AS v(tn, summary, description, status, priority, sd, dd, progress, assignee_email, labels)
WHERE p.project_key = 'B2B'
ON CONFLICT (project_id, task_number) DO NOTHING;


-- ============================================================================
-- 6a. NORMALIZACJA DAT `updated` DLA ZADAŃ UKOŃCZONYCH
-- ============================================================================
-- Bez tej operacji wszystkie DONE-zadania mają `updated = NOW()` (moment seedowania),
-- przez co wykres "Completion Trend" pokazuje pojedynczy słupek w bieżącym tygodniu.
-- Ustawiamy `updated` na due_date + 1 dzień, dzięki temu ukończenia rozkładają się
-- na kilka tygodni wstecz (zgodnie z datami ukończenia projektów ECOM/MAPP/B2B).

UPDATE tasks
SET updated = (due_date::timestamp) + INTERVAL '1 day'
WHERE status = 'DONE'
  AND project_id IN (SELECT id FROM projects WHERE project_key IN ('ECOM','MAPP','B2B'));


-- ============================================================================
-- 7.  ZALEŻNOŚCI MIĘDZYZADANIOWE (15 szt., ~33 % zadań)
-- ============================================================================

INSERT INTO task_dependencies (task_id, dependency_id)
SELECT t1.id, t2.id
FROM tasks t1
JOIN projects p ON t1.project_id = p.id
JOIN tasks t2 ON t2.project_id = p.id
WHERE (p.project_key, t1.task_number, t2.task_number) IN (
  -- ECOM: 3→1, 4→3, 8→4, 12→7, 15→14
  ('ECOM', 3,  1),
  ('ECOM', 4,  3),
  ('ECOM', 8,  4),
  ('ECOM', 12, 7),
  ('ECOM', 15, 14),
  -- MAPP: 2→1, 4→2, 6→5, 8→7, 15→14
  ('MAPP', 2,  1),
  ('MAPP', 4,  2),
  ('MAPP', 6,  5),
  ('MAPP', 8,  7),
  ('MAPP', 15, 14),
  -- B2B: 4→2, 5→3, 6→5, 8→4, 15→11
  ('B2B',  4,  2),
  ('B2B',  5,  3),
  ('B2B',  6,  5),
  ('B2B',  8,  4),
  ('B2B',  15, 11)
)
ON CONFLICT DO NOTHING;


-- ============================================================================
-- 8.  KOMENTARZE
-- ============================================================================
-- Komentarze identyfikujemy później jednoznacznie przez trójkę
--   (task, author, poziom_wątku)
-- — w ramach tego seed-a każda taka kombinacja jest unikalna.
-- Dzięki temu nie musimy używać PL/pgSQL ani znaczników w treści komentarza.

-- Komentarz C1 — ECOM-3 (Wireframes), autor: Piotr, top-level
INSERT INTO comments (content, task_id, author_id, timestamp)
SELECT
  'Wersja beta wireframów jest gotowa — proszę designerów o review do końca tygodnia. Kluczowe pytanie: czy zostawiamy sticky CTA w karcie produktu?',
  t.id,
  u.id,
  NOW() - INTERVAL '2 days'
FROM tasks t
JOIN projects p ON t.project_id = p.id
CROSS JOIN users u
WHERE p.project_key = 'ECOM' AND t.task_number = 3
  AND u.email = 'piotr.kowalski@flowlink.pl'
  AND NOT EXISTS (
    SELECT 1 FROM comments c
    WHERE c.task_id = t.id AND c.author_id = u.id AND c.parent_comment_id IS NULL
  );

-- Komentarz C2 — odpowiedź pod C1 (ECOM-3), autor: Marta
INSERT INTO comments (content, task_id, author_id, parent_comment_id, timestamp)
SELECT
  'Obejrzałam, wygląda dobrze. Sticky CTA zostawmy — w analityce mieliśmy +7 % konwersji po jego wprowadzeniu w v1. Uwagi szczegółowe dodałam w pliku Figma.',
  t.id,
  u.id,
  (SELECT c.id FROM comments c
     JOIN users ua ON c.author_id = ua.id
    WHERE c.task_id = t.id
      AND ua.email = 'piotr.kowalski@flowlink.pl'
      AND c.parent_comment_id IS NULL
    LIMIT 1),
  NOW() - INTERVAL '1 days'
FROM tasks t
JOIN projects p ON t.project_id = p.id
CROSS JOIN users u
WHERE p.project_key = 'ECOM' AND t.task_number = 3
  AND u.email = 'marta.wisniewska@flowlink.pl'
  AND EXISTS (
    SELECT 1 FROM comments c
      JOIN users ua ON c.author_id = ua.id
    WHERE c.task_id = t.id
      AND ua.email = 'piotr.kowalski@flowlink.pl'
      AND c.parent_comment_id IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM comments c
    WHERE c.task_id = t.id AND c.author_id = u.id AND c.parent_comment_id IS NOT NULL
  );

-- Komentarz C3 — ECOM-8 (Koszyk), autor: Tomasz, top-level
INSERT INTO comments (content, task_id, author_id, timestamp)
SELECT
  'Pytanie do decyzji biznesowej — integrujemy się ze Stripe Checkout (hostowany) czy Stripe Elements (w naszym UI)? Elements daje większą kontrolę nad stylem, Checkout jest szybszy do wdrożenia.',
  t.id,
  u.id,
  NOW() - INTERVAL '3 hours'
FROM tasks t
JOIN projects p ON t.project_id = p.id
CROSS JOIN users u
WHERE p.project_key = 'ECOM' AND t.task_number = 8
  AND u.email = 'tomasz.lewandowski@flowlink.pl'
  AND NOT EXISTS (
    SELECT 1 FROM comments c
    WHERE c.task_id = t.id AND c.author_id = u.id AND c.parent_comment_id IS NULL
  );

-- Komentarz C4 — B2B-4 (OAuth), autor: Piotr, top-level
INSERT INTO comments (content, task_id, author_id, timestamp)
SELECT
  'Zatwierdzona decyzja: OAuth2 Client Credentials + JWT z krótkim TTL (15 min), rotacja kluczy raz na kwartał. Spring Authorization Server 1.2.',
  t.id,
  u.id,
  NOW() - INTERVAL '5 hours'
FROM tasks t
JOIN projects p ON t.project_id = p.id
CROSS JOIN users u
WHERE p.project_key = 'B2B' AND t.task_number = 4
  AND u.email = 'piotr.kowalski@flowlink.pl'
  AND NOT EXISTS (
    SELECT 1 FROM comments c
    WHERE c.task_id = t.id AND c.author_id = u.id AND c.parent_comment_id IS NULL
  );

-- Komentarz C5 — MAPP-5 (Ekran logowania), autor: Marta, top-level
INSERT INTO comments (content, task_id, author_id, timestamp)
SELECT
  'Dopasuję flow do decyzji z MAPP-4 (biometria). Najpierw email/hasło, po pierwszym logowaniu propozycja włączenia FaceID/TouchID.',
  t.id,
  u.id,
  NOW() - INTERVAL '1 days'
FROM tasks t
JOIN projects p ON t.project_id = p.id
CROSS JOIN users u
WHERE p.project_key = 'MAPP' AND t.task_number = 5
  AND u.email = 'marta.wisniewska@flowlink.pl'
  AND NOT EXISTS (
    SELECT 1 FROM comments c
    WHERE c.task_id = t.id AND c.author_id = u.id AND c.parent_comment_id IS NULL
  );


-- ============================================================================
-- 9.  REAKCJE NA KOMENTARZE
-- ============================================================================
-- Każda reakcja znajduje komentarz po trójce (projekt, nr zadania, autor, poziom).

-- LIKE na C1 (Anna)
INSERT INTO comment_reactions (type, comment_id, user_id)
SELECT 'LIKE', c.id, reactor.id
FROM comments c
JOIN tasks t ON c.task_id = t.id
JOIN projects p ON t.project_id = p.id
JOIN users author ON c.author_id = author.id
CROSS JOIN users reactor
WHERE p.project_key = 'ECOM' AND t.task_number = 3
  AND author.email = 'piotr.kowalski@flowlink.pl'
  AND c.parent_comment_id IS NULL
  AND reactor.email = 'demo@flowlink.pl'
ON CONFLICT DO NOTHING;

-- LIKE na C1 (Marta)
INSERT INTO comment_reactions (type, comment_id, user_id)
SELECT 'LIKE', c.id, reactor.id
FROM comments c
JOIN tasks t ON c.task_id = t.id
JOIN projects p ON t.project_id = p.id
JOIN users author ON c.author_id = author.id
CROSS JOIN users reactor
WHERE p.project_key = 'ECOM' AND t.task_number = 3
  AND author.email = 'piotr.kowalski@flowlink.pl'
  AND c.parent_comment_id IS NULL
  AND reactor.email = 'marta.wisniewska@flowlink.pl'
ON CONFLICT DO NOTHING;

-- LIKE na C2 (Piotr — Piotr lubi odpowiedź Marty)
INSERT INTO comment_reactions (type, comment_id, user_id)
SELECT 'LIKE', c.id, reactor.id
FROM comments c
JOIN tasks t ON c.task_id = t.id
JOIN projects p ON t.project_id = p.id
JOIN users author ON c.author_id = author.id
CROSS JOIN users reactor
WHERE p.project_key = 'ECOM' AND t.task_number = 3
  AND author.email = 'marta.wisniewska@flowlink.pl'
  AND c.parent_comment_id IS NOT NULL
  AND reactor.email = 'piotr.kowalski@flowlink.pl'
ON CONFLICT DO NOTHING;

-- LIKE na C4 (Anna)
INSERT INTO comment_reactions (type, comment_id, user_id)
SELECT 'LIKE', c.id, reactor.id
FROM comments c
JOIN tasks t ON c.task_id = t.id
JOIN projects p ON t.project_id = p.id
JOIN users author ON c.author_id = author.id
CROSS JOIN users reactor
WHERE p.project_key = 'B2B' AND t.task_number = 4
  AND author.email = 'piotr.kowalski@flowlink.pl'
  AND c.parent_comment_id IS NULL
  AND reactor.email = 'demo@flowlink.pl'
ON CONFLICT DO NOTHING;

-- LIKE na C5 (Anna)
INSERT INTO comment_reactions (type, comment_id, user_id)
SELECT 'LIKE', c.id, reactor.id
FROM comments c
JOIN tasks t ON c.task_id = t.id
JOIN projects p ON t.project_id = p.id
JOIN users author ON c.author_id = author.id
CROSS JOIN users reactor
WHERE p.project_key = 'MAPP' AND t.task_number = 5
  AND author.email = 'marta.wisniewska@flowlink.pl'
  AND c.parent_comment_id IS NULL
  AND reactor.email = 'demo@flowlink.pl'
ON CONFLICT DO NOTHING;


-- ============================================================================
-- 10. POWIADOMIENIA DLA MANAGERA (Anny)
-- ============================================================================

-- Każde powiadomienie chronione jest guardem NOT EXISTS dopasowującym po
-- (user_id, message) — ponowne uruchomienie skryptu nie zduplikuje wpisów.

INSERT INTO notifications (user_id, message, type, is_read, link, timestamp)
SELECT u.id,
       'Piotr Kowalski skomentował zadanie ECOM-3 — Wireframes głównych widoków',
       'TASK_COMMENT', false, '/projects?selectedIssue=ECOM-3',
       NOW() - INTERVAL '2 days'
FROM users u
WHERE u.email = 'demo@flowlink.pl'
  AND NOT EXISTS (SELECT 1 FROM notifications n
                  WHERE n.user_id = u.id
                    AND n.message = 'Piotr Kowalski skomentował zadanie ECOM-3 — Wireframes głównych widoków');

INSERT INTO notifications (user_id, message, type, is_read, link, timestamp)
SELECT u.id,
       'Marta Wiśniewska odpowiedziała w wątku komentarza w ECOM-3',
       'COMMENT_REPLY', false, '/projects?selectedIssue=ECOM-3',
       NOW() - INTERVAL '1 days'
FROM users u
WHERE u.email = 'demo@flowlink.pl'
  AND NOT EXISTS (SELECT 1 FROM notifications n
                  WHERE n.user_id = u.id
                    AND n.message = 'Marta Wiśniewska odpowiedziała w wątku komentarza w ECOM-3');

INSERT INTO notifications (user_id, message, type, is_read, link, timestamp)
SELECT u.id,
       'Tomasz Lewandowski skomentował zadanie ECOM-8 — Nowy koszyk zakupowy',
       'TASK_COMMENT', false, '/projects?selectedIssue=ECOM-8',
       NOW() - INTERVAL '3 hours'
FROM users u
WHERE u.email = 'demo@flowlink.pl'
  AND NOT EXISTS (SELECT 1 FROM notifications n
                  WHERE n.user_id = u.id
                    AND n.message = 'Tomasz Lewandowski skomentował zadanie ECOM-8 — Nowy koszyk zakupowy');

INSERT INTO notifications (user_id, message, type, is_read, link, timestamp)
SELECT u.id,
       'Piotr Kowalski skomentował zadanie B2B-4 — Autentykacja OAuth2 + JWT',
       'TASK_COMMENT', true, '/projects?selectedIssue=B2B-4',
       NOW() - INTERVAL '5 hours'
FROM users u
WHERE u.email = 'demo@flowlink.pl'
  AND NOT EXISTS (SELECT 1 FROM notifications n
                  WHERE n.user_id = u.id
                    AND n.message = 'Piotr Kowalski skomentował zadanie B2B-4 — Autentykacja OAuth2 + JWT');

INSERT INTO notifications (user_id, message, type, is_read, link, timestamp)
SELECT u.id,
       'Marta Wiśniewska skomentowała zadanie MAPP-5 — Ekran logowania i rejestracji',
       'TASK_COMMENT', true, '/projects?selectedIssue=MAPP-5',
       NOW() - INTERVAL '1 days'
FROM users u
WHERE u.email = 'demo@flowlink.pl'
  AND NOT EXISTS (SELECT 1 FROM notifications n
                  WHERE n.user_id = u.id
                    AND n.message = 'Marta Wiśniewska skomentowała zadanie MAPP-5 — Ekran logowania i rejestracji');

INSERT INTO notifications (user_id, message, type, is_read, link, timestamp)
SELECT u.id,
       'Zadanie ECOM-3 zostało zaktualizowane (status: IN_PROGRESS, postęp: 50 %)',
       'TASK_UPDATED', true, '/projects?selectedIssue=ECOM-3',
       NOW() - INTERVAL '2 days'
FROM users u
WHERE u.email = 'demo@flowlink.pl'
  AND NOT EXISTS (SELECT 1 FROM notifications n
                  WHERE n.user_id = u.id
                    AND n.message = 'Zadanie ECOM-3 zostało zaktualizowane (status: IN_PROGRESS, postęp: 50 %)');


COMMIT;


-- ============================================================================
-- PODSUMOWANIE (wykonaj ręcznie po zakończeniu, żeby zobaczyć statystyki)
-- ============================================================================
-- SELECT
--   (SELECT COUNT(*) FROM users     WHERE email LIKE '%@flowlink.pl')           AS uzytkownicy,
--   (SELECT COUNT(*) FROM projects  WHERE project_key IN ('ECOM','MAPP','B2B')) AS projekty,
--   (SELECT COUNT(*) FROM tasks t JOIN projects p ON t.project_id = p.id
--          WHERE p.project_key IN ('ECOM','MAPP','B2B'))                        AS zadania,
--   (SELECT COUNT(*) FROM task_dependencies td
--          JOIN tasks t ON td.task_id = t.id
--          JOIN projects p ON t.project_id = p.id
--          WHERE p.project_key IN ('ECOM','MAPP','B2B'))                        AS zaleznosci,
--   (SELECT COUNT(*) FROM comments c
--          JOIN tasks t ON c.task_id = t.id
--          JOIN projects p ON t.project_id = p.id
--          WHERE p.project_key IN ('ECOM','MAPP','B2B'))                        AS komentarze,
--   (SELECT COUNT(*) FROM notifications n JOIN users u ON n.user_id = u.id
--          WHERE u.email = 'demo@flowlink.pl')                                  AS powiadomienia;
