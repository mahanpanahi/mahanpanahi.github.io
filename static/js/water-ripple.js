(() => {
    "use strict";

    /*
     * MAHAN — Soft Waterlight
     * Lightweight Canvas 2D cursor effect.
     * A restrained warm glow with a few soft, organic ripples.
     */

    const canvas = document.getElementById("water-ripple-canvas");
    if (!canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");

    if (reducedMotion.matches || !finePointer.matches) {
        canvas.hidden = true;
        return;
    }

    const ctx = canvas.getContext("2d", {
        alpha: true,
        desynchronized: true
    });

    if (!ctx) {
        canvas.hidden = true;
        return;
    }

    const CONFIG = {
        maxRipples: 6,
        rippleLife: 1.35,
        rippleSpacing: 135,
        maxPixelRatio: 1.55,
        maxPixels: 2200000,
        glowRadius: 85,
        glowFade: 0.9
    };

    const state = {
        width: 0,
        height: 0,
        dpr: 1,
        raf: 0,
        lastFrame: 0,
        lastMove: 0,
        pointerActive: false,
        pointerInside: false,
        pointer: { x: 0, y: 0 },
        smooth: { x: 0, y: 0 },
        previous: null,
        distanceCarry: 0,
        ripples: []
    };

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    function resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const areaRatio = Math.sqrt(CONFIG.maxPixels / Math.max(1, w * h));
        state.dpr = Math.max(0.65, Math.min(
            window.devicePixelRatio || 1,
            CONFIG.maxPixelRatio,
            areaRatio
        ));

        state.width = w;
        state.height = h;

        const bw = Math.round(w * state.dpr);
        const bh = Math.round(h * state.dpr);

        if (canvas.width !== bw || canvas.height !== bh) {
            canvas.width = bw;
            canvas.height = bh;
        }

        ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
        requestDraw();
    }

    function addRipple(x, y, strength = 0.65) {
        state.ripples.push({
            x,
            y,
            born: performance.now(),
            strength: clamp(strength, 0.35, 0.8),
            seed: Math.random() * Math.PI * 2
        });

        if (state.ripples.length > CONFIG.maxRipples) {
            state.ripples.shift();
        }
        requestDraw();
    }

    function emitAlongPath(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 1) return;

        const total = state.distanceCarry + distance;
        const count = Math.floor(total / CONFIG.rippleSpacing);

        for (let i = 0; i < count; i++) {
            const along = CONFIG.rippleSpacing - state.distanceCarry +
                i * CONFIG.rippleSpacing;
            const t = clamp(along / distance, 0, 1);

            addRipple(
                from.x + dx * t,
                from.y + dy * t,
                0.48
            );
        }

        state.distanceCarry = total % CONFIG.rippleSpacing;
    }

    function onPointerMove(event) {
        if (event.pointerType === "touch") return;

        const now = performance.now();
        const point = { x: event.clientX, y: event.clientY };

        state.pointer.x = point.x;
        state.pointer.y = point.y;
        state.pointerActive = true;
        state.pointerInside = true;
        state.lastMove = now;

        if (state.previous) {
            emitAlongPath(state.previous, point);
        } else {
            state.smooth.x = point.x;
            state.smooth.y = point.y;
        }

        state.previous = point;
        requestDraw();
    }

    function drawGlow(strength) {
        if (strength <= 0.01) return;

        const x = state.smooth.x;
        const y = state.smooth.y;
        const r = CONFIG.glowRadius;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, `rgba(205, 245, 225, ${0.23 * strength})`);
        gradient.addColorStop(0.32, `rgba(165, 210, 195, ${0.13 * strength})`);
        gradient.addColorStop(0.68, `rgba(195, 250, 240, ${0.055 * strength})`);
        gradient.addColorStop(1, "rgba(91, 205, 190, 0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawRipple(ripple, now) {
        const age = (now - ripple.born) / 1000;
        const progress = age / CONFIG.rippleLife;
        if (progress >= 1) return false;

        // A natural ripple expands steadily, then gradually loses contrast.
        const expansion = 1 - Math.pow(1 - progress, 1.35);
        const fade = Math.pow(1 - progress, 2.15) * ripple.strength;
        const baseRadius = 4 + expansion * 48;

        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        function traceWaterRing(radius, phase, wobble) {
            ctx.beginPath();

            const segments = 72;
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;

                // Very small, slow variations avoid a mathematically perfect circle
                // without making the ripple look distorted or wobbly.
                const variation =
                    Math.sin(angle * 3 + ripple.seed + phase) * wobble +
                    Math.sin(angle * 5 - ripple.seed * 0.7 + phase) * wobble * 0.35;

                const r = radius + variation;
                const px = ripple.x + Math.cos(angle) * r;
                const py = ripple.y + Math.sin(angle) * r;

                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }

            ctx.closePath();
        }

        // Main crest.
        traceWaterRing(baseRadius, age * 0.65, 0.9);
        ctx.strokeStyle = `rgba(105, 220, 205, ${0.17 * fade})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // A softer inner wave gives the impression of water moving in layers.
        const innerRadius = baseRadius * 0.68;
        traceWaterRing(innerRadius, age * 0.45 + 1.1, 0.55);
        ctx.strokeStyle = `rgba(205, 240, 230, ${0.065 * fade})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();

        return true;
    }

    function render(timestamp) {
        state.raf = 0;

        const dt = state.lastFrame
            ? Math.min((timestamp - state.lastFrame) / 1000, 0.05)
            : 1 / 60;
        state.lastFrame = timestamp;

        const follow = 1 - Math.exp(-dt * 14);
        state.smooth.x += (state.pointer.x - state.smooth.x) * follow;
        state.smooth.y += (state.pointer.y - state.smooth.y) * follow;

        ctx.clearRect(0, 0, state.width, state.height);

        const idle = state.pointerActive
            ? (timestamp - state.lastMove) / 1000
            : Infinity;
        const glowStrength = state.pointerInside
            ? clamp(1 - idle / CONFIG.glowFade, 0, 1)
            : 0;

        drawGlow(glowStrength);

        const alive = [];
        for (const ripple of state.ripples) {
            if (drawRipple(ripple, timestamp)) alive.push(ripple);
        }
        state.ripples = alive;

        const lag = Math.hypot(
            state.pointer.x - state.smooth.x,
            state.pointer.y - state.smooth.y
        );

        if (alive.length || glowStrength > 0.01 || lag > 0.2) {
            requestDraw();
        } else {
            state.lastFrame = 0;
        }
    }

    function requestDraw() {
        if (!state.raf && !document.hidden) {
            state.raf = requestAnimationFrame(render);
        }
    }

    function stopPointer() {
        state.pointerInside = false;
        state.previous = null;
        state.distanceCarry = 0;
        requestDraw();
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });

    window.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "touch") return;
        addRipple(event.clientX, event.clientY, 0.72);
    }, { passive: true });

    document.documentElement.addEventListener("pointerleave", stopPointer);
    window.addEventListener("blur", stopPointer);
    window.addEventListener("resize", resize, { passive: true });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden && state.raf) {
            cancelAnimationFrame(state.raf);
            state.raf = 0;
        } else {
            requestDraw();
        }
    });

    reducedMotion.addEventListener?.("change", (event) => {
        if (event.matches) {
            if (state.raf) cancelAnimationFrame(state.raf);
            state.raf = 0;
            state.ripples.length = 0;
            ctx.clearRect(0, 0, state.width, state.height);
            canvas.hidden = true;
        } else {
            canvas.hidden = false;
            resize();
        }
    });

    resize();
})();