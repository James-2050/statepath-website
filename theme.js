(() => {
  const storageKey = 'statepath-theme';
  const gsapScriptPath = './assets/vendor/gsap/gsap.min.js';
  const scrollTriggerScriptPath = './assets/vendor/gsap/ScrollTrigger.min.js';
  const root = document.documentElement;
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  const buttons = Array.from(document.querySelectorAll('[data-theme-choice]'));
  const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  const reducedMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const motionSelector = [
    '.sp2-home-banner-image-full',
    '.sp2-home-title-group',
    '.sp2-prompt-panel',
    '.sp2-section-header',
    '.sp2-media-card',
    '.sp2-card',
    '.sp2-link-card',
    '.sp2-compare',
    '.sp2-step',
    '.sp2-stat',
    '.sp2-callout',
    '.sp2-page-form',
    '.sp2-footer-shell'
  ].join(',');

  function normalizeTheme(theme) {
    return ['light', 'dark', 'auto'].includes(theme) ? theme : 'auto';
  }

  function getStoredTheme() {
    try {
      return normalizeTheme(localStorage.getItem(storageKey) || 'auto');
    } catch (error) {
      return 'auto';
    }
  }

  function getEffectiveTheme(theme) {
    if (theme === 'auto') {
      return mediaQuery && mediaQuery.matches ? 'light' : 'dark';
    }

    return theme;
  }

  function setThemeColor(effectiveTheme) {
    if (!themeColorMeta) {
      return;
    }

    themeColorMeta.setAttribute('content', effectiveTheme === 'light' ? '#f5efe4' : '#0b1420');
  }

  function syncButtons(theme) {
    buttons.forEach((button) => {
      const pressed = button.dataset.themeChoice === theme;
      button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    });
  }

  function applyTheme(theme, options = {}) {
    const normalizedTheme = normalizeTheme(theme);
    const effectiveTheme = getEffectiveTheme(normalizedTheme);
    const persist = options.persist !== false;

    root.setAttribute('data-theme', normalizedTheme);
    root.setAttribute('data-effective-theme', effectiveTheme);
    syncButtons(normalizedTheme);
    setThemeColor(effectiveTheme);

    if (persist) {
      try {
        localStorage.setItem(storageKey, normalizedTheme);
      } catch (error) {
        // Ignore storage issues silently.
      }
    }
  }

  function motionEnabled() {
    return !(reducedMotionQuery && reducedMotionQuery.matches);
  }

  function updateMotionMode() {
    root.setAttribute('data-motion', motionEnabled() ? 'full' : 'reduced');
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = Array.from(document.querySelectorAll('script')).find((script) => {
        const scriptSrc = script.getAttribute('src') || '';
        return scriptSrc === src || scriptSrc.endsWith(src.replace(/^\.\//, ''));
      });

      if (existing) {
        if (
          existing.dataset.loaded === 'true' ||
          (src === gsapScriptPath && window.gsap) ||
          (src === scrollTriggerScriptPath && window.ScrollTrigger)
        ) {
          resolve();
          return;
        }

        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.loaded = 'pending';
      script.addEventListener(
        'load',
        () => {
          script.dataset.loaded = 'true';
          resolve();
        },
        { once: true }
      );
      script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      document.head.appendChild(script);
    });
  }

  async function tryLoadGsap() {
    try {
      await loadScript(gsapScriptPath);
      await loadScript(scrollTriggerScriptPath);

      if (!window.gsap || !window.ScrollTrigger) {
        return false;
      }

      window.gsap.registerPlugin(window.ScrollTrigger);
      return true;
    } catch (error) {
      return false;
    }
  }

  function revealAllTargets() {
    document.querySelectorAll('.sp2-motion-target').forEach((element) => {
      element.classList.add('is-visible');
    });
  }

  function createMotionTargets() {
    const targets = [];
    const seen = new Set();

    document.querySelectorAll(motionSelector).forEach((element) => {
      if (seen.has(element)) {
        return;
      }

      seen.add(element);
      element.classList.add('sp2-motion-target');
      element.style.setProperty('--sp2-motion-delay', `${(targets.length % 4) * 70}ms`);
      targets.push(element);
    });

    return targets;
  }

  function clearMotionInlineState(targets) {
    targets.forEach((element) => {
      element.classList.remove('is-visible');
      ['opacity', 'visibility', 'transform', 'filter', 'willChange'].forEach((property) => {
        element.style.removeProperty(property);
      });
    });

    [
      '.sp2-home-banner-image-full',
      '.sp2-home-title-group',
      '.sp2-prompt-panel',
      '.sp2-hero-symbol'
    ].forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        ['opacity', 'visibility', 'transform', 'filter', 'willChange'].forEach((property) => {
          element.style.removeProperty(property);
        });
      });
    });

    root.style.setProperty('--sp2-scroll-progress', '0');
  }

  function setupRevealObserver(targets) {
    if (!targets.length) {
      return null;
    }

    if (!motionEnabled() || typeof IntersectionObserver === 'undefined') {
      revealAllTargets();
      return null;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.18,
        rootMargin: '0px 0px -10% 0px'
      }
    );

    targets.forEach((element, index) => {
      if (index < 4) {
        requestAnimationFrame(() => {
          element.classList.add('is-visible');
        });
        return;
      }

      observer.observe(element);
    });

    return observer;
  }

  function updateScrollEffects() {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    root.setAttribute('data-scrolled', scrollY > 18 ? 'true' : 'false');

    if (!motionEnabled()) {
      root.style.setProperty('--sp2-scroll-progress', '0');
      return;
    }

    const hero = document.querySelector('.sp2-hero-home, .sp2-hero');
    if (!hero) {
      root.style.setProperty('--sp2-scroll-progress', '0');
      return;
    }

    const rect = hero.getBoundingClientRect();
    const distance = Math.max(rect.height * 0.85, 1);
    const progress = Math.min(1, Math.max(0, (0 - rect.top) / distance));
    root.style.setProperty('--sp2-scroll-progress', progress.toFixed(4));
  }

  function setupNativeMotion(targets) {
    root.setAttribute('data-motion-engine', 'native');

    const observer = setupRevealObserver(targets);
    let ticking = false;

    const requestScrollUpdate = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      requestAnimationFrame(() => {
        updateScrollEffects();
        ticking = false;
      });
    };

    updateScrollEffects();
    window.addEventListener('scroll', requestScrollUpdate, { passive: true });
    window.addEventListener('resize', requestScrollUpdate);

    return () => {
      if (observer && typeof observer.disconnect === 'function') {
        observer.disconnect();
      }

      window.removeEventListener('scroll', requestScrollUpdate);
      window.removeEventListener('resize', requestScrollUpdate);
    };
  }

  function setupGsapMotion(targets) {
    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;

    if (!gsap || !ScrollTrigger) {
      return setupNativeMotion(targets);
    }

    root.setAttribute('data-motion-engine', 'gsap');

    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    gsap.killTweensOf(targets);

    gsap.set(targets, {
      autoAlpha: 0,
      y: 28,
      filter: 'blur(10px)',
      willChange: 'transform, opacity, filter'
    });

    const introTargets = targets.slice(0, 4);
    const deferredTargets = targets.slice(4);

    if (introTargets.length) {
      gsap.to(introTargets, {
        autoAlpha: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 1.05,
        ease: 'power3.out',
        stagger: 0.12,
        overwrite: 'auto'
      });
    }

    deferredTargets.forEach((element) => {
      gsap.to(element, {
        autoAlpha: 1,
        y: 0,
        filter: 'blur(0px)',
        duration: 0.92,
        ease: 'power3.out',
        overwrite: 'auto',
        scrollTrigger: {
          trigger: element,
          start: 'top 84%',
          toggleActions: 'play none none none',
          once: true
        }
      });
    });

    const hero = document.querySelector('.sp2-hero-home, .sp2-hero');
    const heroBanners = Array.from(document.querySelectorAll('.sp2-home-banner-image-full'));
    const titleGroup = document.querySelector('.sp2-home-title-group');
    const promptPanel = document.querySelector('.sp2-prompt-panel');

    if (hero && heroBanners.length) {
      gsap.fromTo(
        heroBanners,
        { y: 0, scale: 1 },
        {
          y: 24,
          scale: 1.04,
          ease: 'none',
          overwrite: 'auto',
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.9
          }
        }
      );
    }

    if (hero && titleGroup) {
      gsap.fromTo(
        titleGroup,
        { y: 0 },
        {
          y: -18,
          ease: 'none',
          overwrite: 'auto',
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.85
          }
        }
      );
    }

    if (hero && promptPanel) {
      gsap.fromTo(
        promptPanel,
        { y: 0 },
        {
          y: 18,
          ease: 'none',
          overwrite: 'auto',
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.95
          }
        }
      );
    }

    let ticking = false;
    const requestScrollUpdate = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      requestAnimationFrame(() => {
        updateScrollEffects();
        ticking = false;
      });
    };

    updateScrollEffects();
    window.addEventListener('scroll', requestScrollUpdate, { passive: true });
    window.addEventListener('resize', requestScrollUpdate);
    requestAnimationFrame(() => ScrollTrigger.refresh());

    return () => {
      window.removeEventListener('scroll', requestScrollUpdate);
      window.removeEventListener('resize', requestScrollUpdate);

      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
      gsap.killTweensOf(targets);
      gsap.killTweensOf(heroBanners);

      [titleGroup, promptPanel].forEach((element) => {
        if (element) {
          gsap.killTweensOf(element);
        }
      });
    };
  }

  async function setupPremiumMotion() {
    const targets = createMotionTargets();
    let cleanupMotionEngine = () => {};
    let motionSetupToken = 0;

    const applyMotionEngine = async () => {
      const currentToken = ++motionSetupToken;

      cleanupMotionEngine();
      updateMotionMode();
      clearMotionInlineState(targets);

      if (!motionEnabled()) {
        root.setAttribute('data-motion-engine', 'reduced');
        revealAllTargets();
        updateScrollEffects();
        root.setAttribute('data-motion-ready', 'true');
        return;
      }

      const gsapAvailable = await tryLoadGsap();
      if (currentToken !== motionSetupToken) {
        return;
      }

      cleanupMotionEngine = gsapAvailable ? setupGsapMotion(targets) : setupNativeMotion(targets);
      root.setAttribute('data-motion-ready', 'true');
    };

    await applyMotionEngine();

    if (reducedMotionQuery) {
      const handleReducedMotionChange = () => {
        void applyMotionEngine();
      };

      if (typeof reducedMotionQuery.addEventListener === 'function') {
        reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
      } else if (typeof reducedMotionQuery.addListener === 'function') {
        reducedMotionQuery.addListener(handleReducedMotionChange);
      }
    }
  }

  const initialTheme = getStoredTheme();
  applyTheme(initialTheme, { persist: false });

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      applyTheme(button.dataset.themeChoice || 'auto');
    });
  });

  if (mediaQuery) {
    const handleChange = () => {
      if ((root.getAttribute('data-theme') || 'auto') === 'auto') {
        applyTheme('auto', { persist: false });
      }
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleChange);
    }
  }

  void setupPremiumMotion();
})();