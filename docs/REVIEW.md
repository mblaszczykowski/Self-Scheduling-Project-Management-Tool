# Kompleksowy przegląd aplikacji FlowLink

Przegląd z 15 października 2026 obejmuje kod frontendu i backendu, bezpieczeństwo, uprawnienia, spójność danych, współbieżność, harmonogramowanie, walidację, UX, dostępność, daty, obsługę błędów, zależności, kontenery, CI, kontrakt API oraz dokumentację i obrazy. Pracowały cztery równoległe role: trzy przeglądy obszarowe i integracja całości. Potwierdzone błędy zostały naprawione i objęte odpowiednimi regresjami. Warunki wdrożeniowe i ograniczenia modelu są wymienione osobno, aby nie przedstawiać nowych funkcji jako usterek.

## Pełna lista ustaleń

| Część | Lista problemów, miejsc, skutków, poprawek i testów |
|---|---|
| Sesje, JWT, CSRF, CORS, konta, pliki, SSE i rate limiting | [32 ustalenia bezpieczeństwa](review-backend-security.md) |
| Projekty, zadania, współpraca, wyszukiwanie, optymalizacja i współbieżność | [24 ustalenia domenowe](review-backend-domain.md) |
| Formularze, nawigacja, async, cache, dostępność, daty i interfejs | [Przegląd frontendu](review-frontend.md) |
| Zależności, budowanie, CI, dokumentacja i integracja | Tabela poniżej |

Listy obszarowe zawierają wspólne referencje do tych samych poprawek załączników. Ich sumy nie są liczbą niezależnych błędów.

## Zależności, wdrożenie i dokumentacja

| ID / ważność | Problem i skutek | Zrealizowana poprawka | Sprawdzenie |
|---|---|---|---|
| I01 / wysoka | Audyt npm wykazywał 116 zgłoszeń: 4 krytyczne, 87 wysokich, 19 umiarkowanych i 6 niskich. Obejmowały m.in. Axios i Tiptap oraz stary toolchain. | Aktualizacje zależności, React Router 7, Tailwind 4, Vite 8, Jest 30, TypeScript 5.9 i jawna konfiguracja lint/test/build. Usunięcie CRA i jego zależności; kompatybilne override parserów argparse i PostCSS. | `npm audit`: 0 zgłoszeń we wszystkich kategoriach, również dev; build, lint, testy i API types. CLI js-yaml sprawdzone po zmianie argparse. |
| I02 / wysoka | Pośrednie zależności Javy zawierały zgłoszenia bezpieczeństwa mimo podniesienia samego Spring Boot. | Boot 3.5.16, JJWT 0.12.7, jsoup 1.23.2, springdoc 2.8.17; wyrównane rodziny Jackson 2.21.7, Tomcat 10.1.61, Log4j 2.25.5, JDBC PostgreSQL 42.7.12 i Commons Lang 3.18.0. | Pełne testy i Docker; audyt 94 bibliotek runtime w OSV. Dwa pozostałe zgłoszenia Spring opisano niżej z oceną zastosowania. |
| I03 / średnia | Obraz i CI używały Node 20 po zakończeniu wsparcia; nginx pozostawał na starej gałęzi 1.27. | Node 24 w CI i Docker, zakres Node 22.12+ lub 24+ w package.json, nginx 1.30. | Budowanie i uruchomienie obrazów produkcyjnych. |
| I04 / średnia | `dependency:go-offline` pobierał również nieużywane BOM-y/pluginy i znacznie wydłużał czysty build backendu. | Jedno pakowanie Maven z cache BuildKit; testy wykonywane przed obrazami w CI. Konteksty Docker pomijają lokalne pliki środowiska, logi i raporty testów przeglądarkowych, które wcześniej unieważniały cache po każdym QA. | Czysty build i uruchomienie obrazu. |
| I05 / średnia | Hash CSP skryptu motywu zależał od wyniku minifikacji; aktualizacja narzędzi mogła blokować bootstrap i powodować błysk niewłaściwego motywu. | Skrypt `public/theme.js` ładowany przed aplikacją; `script-src 'self'` bez ręcznego hasha. | Przegląd nagłówków oraz rzeczywiste ekrany jasne i ciemne. |
| I06 / niska | `Cache-Control: immutable` obejmowało również odpowiedzi 404 brakujących bundli. | Nagłówek immutable tylko dla odpowiednich statusów statycznych odpowiedzi; ukrycie wersji nginx. | Nagłówki HTTP istniejących i brakujących assetów. |
| I07 / wysoka | Instrukcje proponowały `compose run db` do publikowania bazy, co tworzy drugi proces PostgreSQL na tym samym wolumenie. | `compose exec` dla psql, lokalny override portu dla GUI; zgodne README, compose i instrukcja demo. | Sprawdzenie komend na osobnym stacku. |
| I08 / wysoka | Seed usuwał dane według ogólnych kluczy projektów i całej domeny email, mimo obietnicy ochrony obcych danych. | Guard dedykowanej bazy przed resetem i dokładna lista czterech kont. Obce dane powodują odmowę przed kasowaniem. | Dwa testy PostgreSQL: dwukrotne wykonanie i odmowa na bazie z rzeczywistym kontem. |
| I09 / średnia | Flyway domyślnie przyjmował istniejącą bazę jako V1 bez sprawdzenia wszystkich ograniczeń schematu. | Baseline domyślnie wyłączony; świadoma jednorazowa adopcja przez `FLYWAY_BASELINE_ON_MIGRATE`, z opisem kopii i porównania schematu. | Start pustej bazy, Flyway i testy schematu. |
| I10 / średnia | Compose nie przekazywał udokumentowanych timeoutów SMTP; nowy limit pamięci limitera także wymagał forwarding. | Przekazanie trzech timeoutów maila, `RATE_LIMIT_MAX_KEYS` i ustawienia adopcji bazy; uzupełnienie szablonu środowiska. | Walidacja compose bez wypisywania sekretów. |
| I11 / średnia | Dziedziczony kontener PostgreSQL był zatrzymywany po klasie testowej; Spring mógł użyć cache kontekstu ze starym portem/bazą. | Jeden kontener na JVM i zamknięcie przy końcu procesu. | Wiele klas integracyjnych w jednym pełnym przebiegu Maven. |
| I12 / średnia | CI kończyło kontrolę wdrożenia na samym zbudowaniu obrazów; nie wykrywało błędów proxy, cookies i działania UI z realnym API. | Playwright z produkcyjnym stackiem, seedem, raportem i sprzątaniem izolowanego środowiska. | Logowanie, portfolio, szczegóły, logout, optymalizacja bez zapisu i ekran mobilny. |
| I13 / niska | README miało stare wersje, wyniki testów, liczby ze starego optymalizatora, nieaktualny opis filtrów i migracji oraz diagram uwierzytelniania. | Aktualizacja README, instrukcji demo, OpenAPI, typów klienta, źródeł Mermaid i SVG; powtarzalne nowe screenshoty i ich metadane. Dodanie sprawdzania lokalnych linków do CI. | Regeneracja kontraktu, weryfikacja linków i wizualna kontrola obrazów. |
| I14 / średnia | Probe frontendu pytał `localhost`, które w Alpine wybierało IPv6 `::1`, podczas gdy nginx nasłuchiwał IPv4. Działająca usługa była uznawana za unhealthy. | Probe odpytuje jednoznaczny adres `127.0.0.1`. | Potwierdzono odmowę dla IPv6, poprawne HTTP 200 po IPv4 i healthy dla całego compose. |
| I15 / niska | Handler wyjątków async wypisywał wszystkie argumenty wywołania, w tym odbiorców i treść wiadomości biznesowych. | Log zachowuje nazwę klasy/metody i wyjątek bez listy argumentów. | Przegląd wywołań `@Async`, kompilacja i pełny zestaw backendu. |
| I16 / średnia | OpenAPI nie deklarowało wymaganych cookies/Bearer ani CSRF, więc generowana dokumentacja sugerowała niezabezpieczone operacje. | Schematy uwierzytelniania i wymagania każdej operacji wynikają ze wspólnej polityki filtrów. Względny adres serwera zachowuje port aktualnego originu za proxy; login/rejestracja pozostają publiczne, refresh/logout wymagają CSRF. | Integracyjny test wymagań odczytu, zapisu, logowania, rejestracji i refresh; regeneracja specyfikacji. |
| I17 / średnia | Nginx rozwiązywał nazwę backendu przy starcie i mógł zachować stare IP po wymianie kontenera. | Współdzielony upstream z dynamicznym resolverem Docker DNS i TTL 5 s, obsługiwany przez nginx 1.30. | Kontrola konfiguracji i próba zmiany adresu backendu bez restartu nginx. |
| I18 / średnia | Ręczna kontrola zrzutów wykryła bardzo niski kontrast neutralnych słupków i linii wykresów w ciemnym motywie; canvas nie jest w pełni oceniany przez automatyczny skaner. | Neutralne dane wykresów korzystają z jasnego koloru w ciemnym motywie, zachowując dotychczasowy ciemny kolor w jasnym. | Build, lint, ponowny Axe i wizualna kontrola motywu ciemnego. |

## Wyniki weryfikacji

Backend: `mvn clean test` — **684 testy, 0 failures, 0 errors, 0 skipped**, 45 zestawów, Java 21 i rzeczywisty PostgreSQL 16. Frontend: **211 testów w 21 zestawach** w strefach Europe/Warsaw i America/Los_Angeles; typecheck, ESLint bez ostrzeżeń i build przechodzą. Zestaw 211 testów przeszedł także na Node 24 w linuksowym obrazie Docker. npm audit: **0 podatności**. **6/6 testów przeglądarkowych** przeszło na rzeczywistym nginx i API, obejmując logowanie/logout, pełny CRUD projektu/zadania, komentarz bez przypadkowego submitu, niezapisane zmiany, symulację bez zapisu i zastosowanie dat z podglądu. **Axe: 0 automatycznych naruszeń w 11 stanach**, bez wyłączeń reguł, wraz z testem Tab/Shift+Tab w dialogach. Jawne przypadki wymagające oceny ręcznej zawiera [accessibility-audit.json](accessibility-audit.json). Wszystkie trzy kontenery są healthy; nginx przechodzi `nginx -t`. Wymuszona zmiana IP backendu została obsłużona przez proxy po 4,1 s bez restartu nginx. Gitleaks przeskanował bieżące źródła: brak wykrytych sekretów. Procedura odtworzenia znajduje się w [VERIFICATION.md](VERIFICATION.md). [Indeks zrzutów](screenshots/README.md) obejmuje 10 odświeżonych obrazów; parametry wykonania są w [capture.json](screenshots/capture.json).

## Zgłoszenia zależności wymagające kontekstu

OSV nadal identyfikuje dwa zgłoszenia dla Spring MVC 6.2.19. Nie są one ukryte ani przedstawiane jako naprawione aktualizacją innych bibliotek:

- [CVE-2026-47890](https://spring.io/security/cve-2026-47890/) dotyczy przesyłania fragmentów widoków przez SSE. FlowLink przesyła DTO powiadomień jako JSON i nie renderuje widoków do strumienia.
- [CVE-2026-47884](https://spring.io/security/cve-2026-47884/) wymaga `XsltView` i mapowania renderującego widok o niewskazanej nazwie. Aplikacja nie używa XSLT ani takiego renderowania; frontend jest serwowany przez nginx, a kontrolery Spring są REST.

Ocena braku zastosowania wynika z kodu aplikacji i warunków podanych przez producenta. Publicznie dostępna poprawka producenta jest w Spring 7; poprawka 6.2.20 wymaga Enterprise Support. Przejście do Spring Boot 4 jest odrębną migracją głównej wersji. Użycie któregokolwiek z wymienionych mechanizmów wymaga ponownej oceny przed wdrożeniem. Podsumowanie skanowania znajduje się w [dependency-audit.json](dependency-audit.json).

Podstawy aktualizacji narzędzi: [zakończenie CRA](https://react.dev/blog/2025/02/14/sunsetting-create-react-app), [cykl wsparcia Node](https://nodejs.org/en/about/eol), [wymagania Tailwind 4](https://tailwindcss.com/docs/upgrade-guide). Minimalne przeglądarki to Safari 16.4, Chrome 111 i Firefox 128.

## Granice obecnej aplikacji

Model planuje całe dni kalendarzowe i pojedynczego wykonawcę na zadanie. Nie zawiera urlopów, świąt, godzin roboczych ani części etatu. Optymalizator jest heurystyczny. Limiter i SSE są lokalne dla jednej instancji backendu. Przegląd i regresje nie stanowią pomiaru przepustowości docelowej infrastruktury ani niezależnego testu penetracyjnego. Te granice są zgodne z obecnym modelem i opisem aplikacji; nie dodawano nieuzgodnionych usług zewnętrznych, nowego systemu logowania czy fikcyjnych obietnic produktu.
