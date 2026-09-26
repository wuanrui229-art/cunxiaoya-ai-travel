// Runs before styles paint; theme changes never rerender the planning surface.
(() => {
  const root = document.documentElement;
  try {
    root.classList.toggle(
      "sidebar-collapsed",
      localStorage.getItem("sylvaplan-sidebar") === "collapsed",
    );
  } catch {}
  let theme = "light";
  try {
    if (localStorage.getItem("village-muse-theme") === "dark") theme = "dark";
  } catch {}
  function apply(next) {
    theme = next;
    root.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#fafaf7" : "#111312");
    document
      .getElementById("theme-toggle")
      ?.setAttribute("aria-pressed", String(theme === "light"));
  }
  apply(theme);
  document.addEventListener("DOMContentLoaded", () => {
    apply(theme);
    document.getElementById("theme-toggle")?.addEventListener("click", () => {
      apply(theme === "light" ? "dark" : "light");
      try {
        localStorage.setItem("village-muse-theme", theme);
      } catch {}
      window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
    });
  });
})();
