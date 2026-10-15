      // Apply the persisted/preferred theme before first paint to avoid a
      // light-mode flash (FOUC). Mirrors ThemeContext's getInitialTheme().
      (function () {
        try {
          var stored = localStorage.getItem('flowlink_theme');
          var isDark = stored
            ? stored === 'dark'
            : window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (isDark) document.documentElement.classList.add('dark');
        } catch (e) {}
      })();
