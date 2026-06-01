/* ═══════════════════════════════════════════════
   ALEF-BET LABORATORY — App.js
   Cinematic Scroll Engine + Particles + Navigation
   ═══════════════════════════════════════════════ */

// === CONSTANTS ===
// TOTAL_FRAMES = real frame count after ffmpeg extraction
// Formula: N_sections × clip_duration_sec × fps
// When frames are ready, update this value
const TOTAL_FRAMES = 400;     // ← UPDATE after frame extraction
const PAGE_COUNT   = 4;       // Hero + 3 content sections
const LERP         = 0.02;    // Cinematic smoothness
const CONCURRENCY  = 48;      // Parallel frame loading

// === DEVICE DETECTION ===
const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent) || innerWidth < 768;
const FRAME_DIR = isMobile ? 'frames-mobile' : 'frames-webp';

// === CANVAS SETUP ===
const canvas = document.getElementById('gl-canvas');
const ctx = canvas.getContext('2d');

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, isMobile ? 1.5 : 2);
  canvas.width  = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width  = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// === FRAME LOADING ===
const frames = new Array(TOTAL_FRAMES);
let loadedCount = 0;
let isReady = false;
let hasFrames = false; // Will be set to true if frames directory exists

function frameName(i) {
  return `${FRAME_DIR}/frame_${String(i + 1).padStart(6, '0')}.webp`;
}

// Check if frames exist by trying to load the first frame
function checkFrames() {
  return new Promise((resolve) => {
    const testImg = new Image();
    testImg.onload = () => resolve(true);
    testImg.onerror = () => resolve(false);
    testImg.src = frameName(0);
  });
}

async function loadAll() {
  hasFrames = await checkFrames();

  if (!hasFrames) {
    // No frames yet - hide loader and use CSS animated background
    hideLoader();
    isReady = true;
    startAnim();
    return;
  }

  const queue = Array.from({length: TOTAL_FRAMES}, (_, i) => i);

  async function worker() {
    while (queue.length) {
      const i = queue.shift();
      await new Promise(resolve => {
        const img = new Image();
        img.onload = img.onerror = () => {
          frames[i] = img;
          loadedCount++;
          const pct = Math.round(loadedCount / TOTAL_FRAMES * 100);
          const bar = document.getElementById('progress-bar');
          if (bar) bar.style.width = pct + '%';
          if (loadedCount === 1) {
            isReady = true;
            startAnim();
          }
          if (loadedCount === TOTAL_FRAMES) hideLoader();
          resolve();
        };
        img.src = frameName(i);
      });
    }
  }

  await Promise.all(Array.from({length: CONCURRENCY}, worker));
}

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.transition = 'opacity 0.8s';
    loader.style.opacity = '0';
    setTimeout(() => loader.style.display = 'none', 800);
  }
}

// === ANIMATION LOOP ===
let currentFrame = 0;
let targetFrame  = 0;

window.addEventListener('scroll', () => {
  if (!isReady) return;
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  const progress  = maxScroll > 0 ? scrollY / maxScroll : 0;
  targetFrame = progress * (TOTAL_FRAMES - 1);
}, { passive: true });

function drawFrame(idx) {
  if (!hasFrames) return; // Skip if no frames

  const img = frames[Math.max(0, Math.min(idx, TOTAL_FRAMES - 1))];
  if (!img || !img.complete) return;

  const W = canvas.width / (devicePixelRatio || 1);
  const H = canvas.height / (devicePixelRatio || 1);

  // Cover-fit
  const r  = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const iw = img.naturalWidth * r;
  const ih = img.naturalHeight * r;
  const x  = (W - iw) / 2;
  const y  = (H - ih) / 2;

  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, x, y, iw, ih);

  // Radial vignette
  const vig = ctx.createRadialGradient(W/2, H/2, H*0.18, W/2, H/2, H*0.85);
  vig.addColorStop(0, 'rgba(6,4,10,0)');
  vig.addColorStop(1, 'rgba(6,4,10,0.78)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Bottom gradient
  const bot = ctx.createLinearGradient(0, H*0.6, 0, H);
  bot.addColorStop(0, 'rgba(6,4,10,0)');
  bot.addColorStop(1, 'rgba(6,4,10,0.88)');
  ctx.fillStyle = bot;
  ctx.fillRect(0, H*0.6, W, H*0.4);
}

function startAnim() {
  function loop() {
    requestAnimationFrame(loop);
    currentFrame += (targetFrame - currentFrame) * LERP;
    if (isReady && hasFrames) drawFrame(Math.round(currentFrame));
  }
  loop();
}

// === PARTICLE SYSTEM ===
const particleCanvas = document.getElementById('particle-canvas');
const pCtx = particleCanvas.getContext('2d');

function resizeParticles() {
  particleCanvas.width = innerWidth;
  particleCanvas.height = innerHeight;
}
window.addEventListener('resize', resizeParticles);
resizeParticles();

const PARTICLE_COUNT = isMobile ? 30 : 55;
const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
  x: Math.random() * innerWidth,
  y: Math.random() * innerHeight,
  vx: (Math.random() - 0.5) * 0.25,
  vy: -(Math.random() * 0.3 + 0.05),
  r: Math.random() * 1.8 + 0.4,
  alpha: Math.random() * 0.45 + 0.1,
  gold: Math.random() > 0.45,
}));

function drawParticles() {
  pCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;

    // Wrap
    if (p.y < -10) { p.y = innerHeight + 10; p.x = Math.random() * innerWidth; }
    if (p.x < -10) p.x = innerWidth + 10;
    if (p.x > innerWidth + 10) p.x = -10;

    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    const color = p.gold ? `rgba(201, 168, 76, ${p.alpha})` : `rgba(255, 255, 255, ${p.alpha * 0.6})`;
    pCtx.fillStyle = color;

    // Glow for gold particles
    if (p.gold && p.r > 1) {
      pCtx.shadowColor = 'rgba(201, 168, 76, 0.4)';
      pCtx.shadowBlur = 6;
    } else {
      pCtx.shadowBlur = 0;
    }

    pCtx.fill();
    pCtx.shadowBlur = 0;
  });

  requestAnimationFrame(drawParticles);
}
drawParticles();

// === SECTION ACTIVATION (IntersectionObserver) ===
const pages    = Array.from(document.querySelectorAll('.page'));
const navLinks = Array.from(document.querySelectorAll('.nav-link'));

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const idx = pages.indexOf(entry.target);
      pages.forEach((p, i) => p.classList.toggle('is-active', i === idx));
      navLinks.forEach((l) => {
        const sectionIdx = parseInt(l.getAttribute('data-section'));
        l.classList.toggle('active', sectionIdx === idx);
      });
    }
  });
}, { rootMargin: '-30% 0px -30% 0px' });

pages.forEach(p => observer.observe(p));

// === NAVBAR SCROLL EFFECT ===
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (scrollY > 60) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
  lastScroll = scrollY;
}, { passive: true });

// === MOBILE DRAWER ===
const burger = document.getElementById('burger-btn');
const drawer = document.getElementById('nav-drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerClose = document.getElementById('drawer-close');

function openDrawer() {
  drawer.classList.add('open');
  drawerOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  drawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

burger.addEventListener('click', openDrawer);
drawerClose.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

// Close drawer on link click
document.querySelectorAll('.drawer-link').forEach(link => {
  link.addEventListener('click', closeDrawer);
});

// === SMOOTH SCROLL FOR NAV LINKS ===
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// === AUTO-HIDE LOADER IF NO FRAMES ===
// Initial quick-check loader timeout
setTimeout(() => {
  const loader = document.getElementById('loader');
  if (loader && loader.style.display !== 'none') {
    hideLoader();
  }
}, 3000);

// === START ===
loadAll();
