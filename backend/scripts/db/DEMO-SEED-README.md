# FlowLink — skrypt demonstracyjny

Plik `demo-seed.sql` wypełnia bazę danych kompletem danych dopasowanych do **studium demonstracyjnego opisanego w rozdziale 5 pracy magisterskiej** (sekcja *Studium demonstracyjne — pełny cykl optymalizacji w aplikacji*).

## Dane logowania

| Email                                | Hasło          | Rola w scenariuszu                |
|--------------------------------------|----------------|-----------------------------------|
| `demo@flowlink.pl`                   | `Demo1234!`  | Manager portfela (Anna Nowak) — **login demo** |
| `piotr.kowalski@flowlink.pl`         | `Demo1234!`  | Senior Developer (Piotr Kowalski)  |
| `marta.wisniewska@flowlink.pl`       | `Demo1234!`  | Mid Developer (Marta Wiśniewska)   |
| `tomasz.lewandowski@flowlink.pl`     | `Demo1234!`  | Full-stack Developer (Tomasz Lewandowski) |

> **Uwaga**: Hasło `Demo1234!` spełnia politykę `ValidationUtil` (≥8 znaków, duża i mała litera, cyfra, znak specjalny). Hash BCrypt (cost=10, prefiks `$2b$`) został wygenerowany lokalnie i zweryfikowany — akceptowany przez Spring Security `BCryptPasswordEncoder`.

## Co znajduje się w seed-data

| Pozycja                         | Ilość |
|---------------------------------|-------|
| Użytkownicy                     | 4     |
| Projekty (`ECOM`, `MAPP`, `B2B`) | 3     |
| Zadania (15 × 3)                | 45    |
| Zależności kolejnościowe        | 15    |
| Komentarze (z wątkami)          | 5     |
| Reakcje LIKE                    | 5     |
| Powiadomienia dla managera      | 6     |

### Rozkład priorytetów (zgodny z rozdziałem 5)

| Priorytet  | Liczba | Udział |
|------------|--------|--------|
| HIGHEST    | 5      | 11 %   |
| HIGH       | 9      | 20 %   |
| MEDIUM     | 18     | 40 %   |
| LOW        | 9      | 20 %   |
| LOWEST     | 4      |  9 %   |
| **Razem**  | 45     | 100 %  |

### Struktura projektów

1. **ECOM** — *Redesign platformy e-commerce* (15 zadań od audytu UX po release 2.0)
2. **MAPP** — *Aplikacja mobilna iOS/Android* (15 zadań od research stacku po publikację w sklepach)
3. **B2B** — *Integracja z API partnerów hurtowych* (15 zadań od analizy wymagań po publikację API v1.0)

Wszystkie projekty dzielą **tę samą pulę trzech developerów** — co generuje konflikty zasobowe (około 35–40 kolizji przy pierwotnym harmonogramie), będące materiałem wejściowym dla optymalizatora MORCPSP.

## Uruchamianie

### Opcja 1: PostgreSQL CLI

```bash
cd backend/src/main/resources
psql -U postgres -d flowlink -f demo-seed.sql
```

### Opcja 2: Z poziomu IntelliJ / DBeaver / pgAdmin

Otwórz plik `demo-seed.sql` i uruchom go jako zapytanie przeciwko bazie `flowlink`.

### Opcja 3: Automatyczne uruchamianie przy starcie Spring Boota

Dodaj do `application.properties`:

```properties
spring.sql.init.mode=always
spring.sql.init.data-locations=classpath:demo-seed.sql
spring.jpa.defer-datasource-initialization=true
```

> Uwaga: pamiętaj aby wyłączyć te linie po pierwszym uruchomieniu, inaczej seed będzie próbował się wkonać przy każdym starcie aplikacji (ON CONFLICT zapobiega duplikacji, ale niepotrzebnie obciąża start).

## Ponowne uruchomienie / resetowanie

Skrypt jest w pełni **powtarzalny**. Na samym początku (sekcja 0 *CZYSZCZENIE*) wykonuje pełny reset wszystkich danych demo:

- usuwa konta `@flowlink.pl`
- usuwa projekty `ECOM`, `MAPP`, `B2B` wraz z ich zadaniami, zależnościami, komentarzami, reakcjami, powiadomieniami i załącznikami
- usuwa tokeny odświeżające powiązane z demo-userami
- usuwa wpisy z logu aktywności (`task_activities`)

Dzięki temu typowy scenariusz pracy wygląda tak:

1. Uruchamiasz `demo-seed.sql` — otrzymujesz stan bazowy (konflikty zasobowe, 45 zadań).
2. Logujesz się jako `demo@flowlink.pl`, klikasz *Optimize Schedule* → sugestie się zapisują.
3. (Opcjonalnie) akceptujesz sugestie — harmonogram w bazie się zmienia.
4. Chcesz powtórzyć demo → **ponownie uruchamiasz `demo-seed.sql`** i wracasz do stanu 1.

Żadnych dodatkowych kroków ani odkomentowywania — sekcja czyszcząca działa zawsze.

## Zmiana hasła

Jeśli chcesz użyć innego hasła, wygeneruj nowy hash BCrypt i podmień go we wszystkich 4 miejscach w `demo-seed.sql`:

```bash
# macOS / Linux (wymaga htpasswd z apache2-utils)
htpasswd -bnBC 10 "" "Demo1234!" | tr -d ':\n'

# Alternatywa (Python, zawsze dostępne)
python3 -c 'import bcrypt; print(bcrypt.hashpw(b"Demo1234!", bcrypt.gensalt(10)).decode())'
```

Otrzymany napis (zaczyna się od `$2a$10$...` lub `$2y$10$...`) wklej zamiast `$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZRGdjGj/n3.c8H/ebTmAFPAQDW7Aq`.

## Jak to wygląda w aplikacji

Po zalogowaniu jako `demo@flowlink.pl`:

- **Dashboard** (`/dashboard`) — sekcja powitalna z liczbą projektów (3), zadań (45), zadań bliskich terminu; sekcja analityczna z wykresami.
- **Widok projektów** (`/projects`) — timeline Gantta z 45 zadaniami rozłożonymi na 3 wierszach projektów; widoczne nakładające się paski (konflikty); zależności jako krzywe strzałki.
- **Przycisk *Optimize Schedule*** w nagłówku timeline'u uruchamia algorytm MORCPSP (SSGS) — pojawiają się ghost bars i panel metryk.
- **Bell powiadomień** w headerze pokazuje 3 nieprzeczytane + 3 przeczytane powiadomienia.
- **Widoki zadań** — klikając w pasek otwiera się modal z komentarzami (zwłaszcza ECOM-3 z wątkiem) i historią.

## Powiązanie z pracą magisterską

Ten zestaw danych jest **zgodny ze scenariuszem opisanym w rozdz. 5**, sekcja *Studium demonstracyjne*:

- $N = 45$ zadań, $Q = 3$ projekty, $K = 3$ zasoby ✓
- rozkład priorytetów 10/20/40/20/10 % ✓
- ~33 % zadań z zależnością wewnątrzprojektową ✓
- horyzont ~50 dni roboczych (2026-04-20 → 2026-06-22) ✓

Metryki przed/po optymalizacji z tego zestawu można wstawić w miejscach oznaczonych `[wstawić ...]` w tabeli `tab:demo-summary` w pracy.
