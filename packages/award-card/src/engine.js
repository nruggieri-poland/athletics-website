// The award card's tilt/glare/foil engine — React Bits' ProfileCard spring
// engine, unchanged in behavior: a card's x/y aim springs toward the
// pointer and a light value eases in/out, both written out as CSS
// variables card.css reads. Each card's loop only runs while something is
// moving, so a page of 40 idle cards costs nothing.
//
// Browser-only. The website runs it on every page with cards; the
// Instagram export (posterHtml in index.js) doesn't — it sets a fixed pose
// with poseStyle() instead, since a still image has no pointer.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const TILT = 12;
const PARALLAX = 8;

function initCard(root, reduced) {
  const size = { width: root.offsetWidth, height: root.offsetHeight };
  const x = { p: 0, v: 0, target: 0 };
  const y = { p: 0, v: 0, target: 0 };
  const light = { p: 0, target: 0 };
  let raf = 0;
  let last = 0;
  let slowUntil = 0;
  let touchId = null;

  const write = () => {
    const angle = reduced ? 0 : TILT;
    const depth = reduced ? 0 : PARALLAX;
    const tilt = Math.min(1, Math.hypot(x.p, y.p));
    const style = root.style;
    style.setProperty("--pc-light-x", `${((x.p + 1) * 0.5 * size.width).toFixed(1)}px`);
    style.setProperty("--pc-light-y", `${((y.p + 1) * 0.5 * size.height).toFixed(1)}px`);
    style.setProperty("--pc-pointer-x", `${((x.p + 1) * 50).toFixed(2)}%`);
    style.setProperty("--pc-pointer-y", `${((y.p + 1) * 50).toFixed(2)}%`);
    style.setProperty("--pc-band-x", `${(50 + x.p * 15).toFixed(2)}%`);
    style.setProperty("--pc-band-y", `${(50 + y.p * 15).toFixed(2)}%`);
    style.setProperty("--pc-rotate-x", `${(y.p * angle).toFixed(3)}deg`);
    style.setProperty("--pc-rotate-y", `${(-x.p * angle).toFixed(3)}deg`);
    style.setProperty("--pc-shift-x", `${(x.p * depth).toFixed(2)}px`);
    style.setProperty("--pc-shift-y", `${(y.p * depth).toFixed(2)}px`);
    style.setProperty("--pc-reach", tilt.toFixed(4));
    style.setProperty("--pc-tilt", (tilt * light.p).toFixed(4));
    style.setProperty("--pc-active", light.p.toFixed(4));
  };

  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    const slow = now < slowUntil;
    const stiffness = slow ? 24 : 120;
    const damping = slow ? 9 : 16;
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      for (const axis of [x, y]) {
        axis.v += (stiffness * (axis.target - axis.p) - damping * axis.v) * h;
        axis.p += axis.v * h;
      }
    }
    const tau = light.target > light.p ? 0.18 : slow ? 0.9 : 0.45;
    light.p += (light.target - light.p) * (1 - Math.exp(-dt / tau));
    write();
    const moving =
      Math.abs(x.target - x.p) > 0.0005 ||
      Math.abs(y.target - y.p) > 0.0005 ||
      Math.abs(x.v) > 0.0005 ||
      Math.abs(y.v) > 0.0005 ||
      Math.abs(light.target - light.p) > 0.002;
    if (moving) {
      raf = requestAnimationFrame(frame);
    } else {
      x.p = x.target;
      y.p = y.target;
      light.p = light.target;
      write();
      raf = 0;
    }
  };

  const wake = () => {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const aim = (nx, ny, on = true) => {
    x.target = clamp(nx, -1, 1);
    y.target = clamp(ny, -1, 1);
    light.target = on ? 1 : 0;
    slowUntil = 0;
    wake();
  };

  const aimAt = (event) => {
    const rect = root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    aim(((event.clientX - rect.left) / rect.width) * 2 - 1, ((event.clientY - rect.top) / rect.height) * 2 - 1);
  };
  const release = () => aim(0, 0, false);

  root.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") aimAt(event);
  });
  root.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse" || event.pointerId === touchId) aimAt(event);
  });
  root.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") release();
  });
  root.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    touchId = event.pointerId;
    aimAt(event);
  });
  const onUp = (event) => {
    if (event.pointerId !== touchId) return;
    touchId = null;
    release();
  };
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onUp);
  // Keyboard users tabbing to the card's Team link still see it catch the
  // light, just without a cursor to aim it.
  root.addEventListener("focusin", () => aim(0.35, -0.3));
  root.addEventListener("focusout", release);

  new ResizeObserver(() => {
    size.width = root.offsetWidth;
    size.height = root.offsetHeight;
    write();
  }).observe(root);

  write();

  return {
    // ProfileCard plays this on mount; here it waits until the card is
    // actually scrolled into view, so cards further down the page still
    // get their moment.
    playIntro() {
      if (reduced) return;
      x.p = 0.62;
      y.p = -0.55;
      light.p = 1;
      slowUntil = performance.now() + 1400;
      write();
      wake();
    },
  };
}

// Wires up every [data-award-card] under `scope` (once each).
export function initAwardCards(scope = document) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cards = new Map();

  const introObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        introObserver.unobserve(entry.target);
        const card = cards.get(entry.target);
        // Wait for the photo: catching the light over a still-empty card
        // flashes the bare foil pattern instead of the athlete.
        const photo = entry.target.querySelector(".award-card__art");
        if (photo && !photo.complete) {
          photo.addEventListener("load", () => card?.playIntro(), { once: true });
        } else {
          card?.playIntro();
        }
      }
    },
    { threshold: 0.35 },
  );

  scope.querySelectorAll("[data-award-card]").forEach((root) => {
    if (root.dataset.awardCardReady) return;
    root.dataset.awardCardReady = "true";
    cards.set(root, initCard(root, reduced));
    if (root.dataset.intro === "true") introObserver.observe(root);
  });
}
