try {
    const theme = localStorage.getItem('theme') || 'dark';
    if (theme === 'system') {
        if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    } else {
        document.documentElement.setAttribute('data-theme', theme);
    }
} catch {
    // Ignore errors in theme loading
}
