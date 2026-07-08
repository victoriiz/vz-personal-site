const HASH_TO_TAB = { lounge: 'personal', research: 'research', dev: 'dev', ledger: 'writing' };
const TAB_TO_HASH = { personal: 'lounge', research: 'research', dev: 'dev', writing: 'ledger' };
 
function openTab(tabName, updateHash = true) {
    const section = document.getElementById(tabName);
    if (!section) return;
 
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
 
    section.classList.add('active');
    const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');
 
    window.scrollTo(0, 0);
 
    if (updateHash) history.replaceState(null, '', '#' + TAB_TO_HASH[tabName]);
 
    // Canvas only lives on the lounge tab; re-measure when returning to it
    if (tabName === 'personal') resizeCanvas();
}
 
document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => openTab(btn.dataset.tab));
});
 
window.addEventListener('hashchange', () => {
    const tab = HASH_TO_TAB[location.hash.replace('#', '')];
    if (tab) openTab(tab, false);
});
 
/* ------------------------------------------------------------------ */
/* 2. THEME TOGGLE                                                     */
/* ------------------------------------------------------------------ */
 
const themeToggleBtn = document.getElementById('theme-toggle');
 
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const dark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    themeToggleBtn.textContent = dark ? '☀️' : '🌙';
}
 
themeToggleBtn.addEventListener('click', toggleTheme);
 
/* ------------------------------------------------------------------ */
/* 3. AMBIENT SIMULATION ENGINE (frame-bound, theme-aware)             */
/* ------------------------------------------------------------------ */
 
const canvas = document.getElementById('physics-canvas');
const ctx = canvas.getContext('2d');
const frame = document.querySelector('.profile-hero-frame');
 
const mouse = { x: null, y: null, radius: 140 };
 
frame.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
});
 
frame.addEventListener('mouseleave', () => {
    mouse.x = null;
    mouse.y = null;
});
 
/* Accent color, read from <body> so dark-mode overrides actually apply */
function accentRGB() {
    const hex = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#8a9a5b';
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16)
    };
}
 
/* --------------------- MODE A: CONSTELLATION ---------------------- */
 
const constellation = {
    particles: [],
    CONNECTION_DISTANCE: 110,
 
    init(w, h) {
        this.particles = [];
        const n = Math.floor((w * h) / 6500);
        for (let i = 0; i < n; i++) {
            this.particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                size: Math.random() * 2 + 0.8,
                vx: (Math.random() - 0.5) * 0.9,
                vy: (Math.random() - 0.5) * 0.9,
                density: Math.random() * 25 + 12
            });
        }
    },
 
    interact() { // click: jolt
        this.particles.forEach(p => {
            p.vx += (Math.random() - 0.5) * 16;
            p.vy += (Math.random() - 0.5) * 16;
        });
    },
 
    step(w, h, c) {
        // connections
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const dist = Math.hypot(dx, dy);
                if (dist < this.CONNECTION_DISTANCE) {
                    const opacity = (1 - dist / this.CONNECTION_DISTANCE) * 0.22;
                    ctx.beginPath();
                    ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${opacity})`;
                    ctx.lineWidth = 0.6;
                    ctx.stroke();
                }
            }
        }
        // particles
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > w) p.vx *= -1;
            if (p.y < 0 || p.y > h) p.vy *= -1;
            p.vx *= 0.993;
            p.vy *= 0.993;
 
            if (mouse.x !== null) {
                const dx = mouse.x - p.x;
                const dy = mouse.y - p.y;
                const distance = Math.hypot(dx, dy);
                if (distance < mouse.radius && distance > 0) {
                    const force = (mouse.radius - distance) / mouse.radius;
                    p.x -= (dx / distance) * force * p.density * 0.38;
                    p.y -= (dy / distance) * force * p.density * 0.38;
                }
            }
 
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, 0.6)`;
            ctx.fill();
        }
    }
};
 
/* ----------------------- MODE B: CAVITY FLOW ----------------------
   Tracer particles advected along an analytic stream function
   (a single recirculating vortex cell — the primary vortex of
   lid-driven cavity flow, the same problem NS-PINN solves).       */
 
const flow = {
    particles: [],
    TRAIL: 7,
    SPEED: 30, // px per unit velocity per second-ish
 
    init(w, h) {
        this.particles = [];
        const n = Math.floor((w * h) / 3800);
        for (let i = 0; i < n; i++) this.particles.push(this.spawn(w, h));
    },
 
    spawn(w, h) {
        return {
            x: Math.random() * w,
            y: Math.random() * h,
            kx: 0, ky: 0,           // click-impulse kick
            trail: [],
            life: 300 + Math.random() * 500
        };
    },
 
    interact() { // click: turbulence burst
        this.particles.forEach(p => {
            p.kx += (Math.random() - 0.5) * 10;
            p.ky += (Math.random() - 0.5) * 10;
        });
    },
 
    // psi = sin^2(pi x) sin^2(pi y)  =>  u = d(psi)/dy, v = -d(psi)/dx
    velocity(nx, ny, t) {
        const wob = 0.05 * Math.sin(t * 0.25);
        const x = Math.min(Math.max(nx + wob, 0.001), 0.999);
        const y = Math.min(Math.max(ny - wob * 0.6, 0.001), 0.999);
        const sx = Math.sin(Math.PI * x);
        const sy = Math.sin(Math.PI * y);
        return {
            u:  Math.PI * sx * sx * Math.sin(2 * Math.PI * y),
            v: -Math.PI * Math.sin(2 * Math.PI * x) * sy * sy
        };
    },
 
    step(w, h, c, t) {
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            const vel = this.velocity(p.x / w, p.y / h, t);
 
            let dx = vel.u * this.SPEED / 60 + p.kx;
            let dy = vel.v * this.SPEED / 60 + p.ky;
            p.kx *= 0.9;
            p.ky *= 0.9;
 
            // gentle mouse repulsion
            if (mouse.x !== null) {
                const mdx = mouse.x - p.x;
                const mdy = mouse.y - p.y;
                const md = Math.hypot(mdx, mdy);
                if (md < mouse.radius && md > 0) {
                    const force = (mouse.radius - md) / mouse.radius;
                    dx -= (mdx / md) * force * 1.6;
                    dy -= (mdy / md) * force * 1.6;
                }
            }
 
            p.x += dx;
            p.y += dy;
            p.life--;
 
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > this.TRAIL) p.trail.shift();
 
            // respawn tracers that stall near stagnation points or expire
            const slow = Math.hypot(dx, dy) < 0.05;
            if (p.life <= 0 || slow || p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) {
                this.particles[i] = this.spawn(w, h);
                continue;
            }
 
            // draw fading streakline
            for (let s = 1; s < p.trail.length; s++) {
                const alpha = (s / p.trail.length) * 0.4;
                ctx.beginPath();
                ctx.moveTo(p.trail[s - 1].x, p.trail[s - 1].y);
                ctx.lineTo(p.trail[s].x, p.trail[s].y);
                ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, 0.55)`;
            ctx.fill();
        }
    }
};
 
/* ---------------------- MODE C: QUANTUM SCARS ---------------------
   A PXP-style chain: sites oscillate between the two Néel patterns
   (even/odd sites out of phase). A slow coherence envelope lets the
   chain "thermalize" into disorder, then revive — the signature of
   quantum many-body scars. Click = measurement (decoheres the chain);
   hover excites nearby sites.                                       */
 
const scars = {
    sites: [],
    OMEGA: 2.2,   // Néel oscillation frequency (rad/s)
    REV: 0.32,    // revival envelope frequency (rad/s)
 
    init(w, h) {
        const n = Math.max(12, Math.min(26, Math.floor(w / 46)));
        this.sites = [];
        for (let i = 0; i < n; i++) {
            this.sites.push({
                jitter: (Math.random() - 0.5) * 0.5,
                drift: (Math.random() - 0.5) * 2
            });
        }
    },
 
    interact() { // click: "measurement" scrambles the phases
        this.sites.forEach(s => { s.jitter += (Math.random() - 0.5) * 5; });
    },
 
    step(w, h, c, t) {
        const n = this.sites.length;
        if (n < 2) return;
 
        const coherence = 0.5 + 0.5 * Math.cos(t * this.REV); // 1 = revival, 0 = thermal
        const margin = Math.max(40, w * 0.06);
        const span = w - 2 * margin;
 
        // compute positions + excitations
        const pts = [];
        for (let i = 0; i < n; i++) {
            const s = this.sites[i];
            // phases wander while decohered, relax back at each revival
            s.jitter += s.drift * 0.004 * (1 - coherence);
            s.jitter *= (1 - 0.02 * coherence);
 
            const phase = (i % 2) * Math.PI + s.jitter;
            let exc = 0.5 + 0.5 * Math.cos(this.OMEGA * t + phase);
 
            const x = margin + (span * i) / (n - 1);
            const y = h * 0.52
                - Math.sin((i / (n - 1)) * Math.PI) * h * 0.08   // gentle arc
                + Math.sin(t * 0.8 + i * 1.7) * 3;               // small bob
 
            if (mouse.x !== null) {
                const d = Math.hypot(mouse.x - x, mouse.y - y);
                if (d < 90) exc = Math.min(1, exc + (1 - d / 90) * 0.6);
            }
            pts.push({ x, y, exc });
        }
 
        // bonds (entanglement-ish links between neighbors)
        for (let i = 0; i < n - 1; i++) {
            const a = pts[i], b = pts[i + 1];
            const alpha = 0.06 + 0.3 * a.exc * b.exc;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }
 
        // sites
        for (const p of pts) {
            const radius = 1.8 + 4.2 * p.exc;
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${0.25 + 0.55 * p.exc})`;
            ctx.fill();
 
            if (p.exc > 0.85) { // revival halo
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${(p.exc - 0.85) * 1.4})`;
                ctx.lineWidth = 0.7;
                ctx.stroke();
            }
        }
    }
};
 
/* ----------------------- ENGINE PLUMBING -------------------------- */
 
const SIMS = { constellation, flow, scars };
 
let simMode = localStorage.getItem('simMode');
if (!SIMS[simMode]) {
    // no saved preference: surprise the visitor with one of the three
    const keys = Object.keys(SIMS);
    simMode = keys[Math.floor(Math.random() * keys.length)];
}
 
function setSimMode(mode, persist = false) {
    if (!SIMS[mode]) return;
    simMode = mode;
    if (persist) localStorage.setItem('simMode', mode);
    document.querySelectorAll('.sim-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.sim === mode));
    SIMS[simMode].init(canvas.width, canvas.height);
}
 
document.querySelectorAll('.sim-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation(); // don't also trigger the frame's click interaction
        setSimMode(btn.dataset.sim, true);
    });
});
 
frame.addEventListener('click', () => SIMS[simMode].interact());
 
function resizeCanvas() {
    if (!frame) return;
    canvas.width = frame.offsetWidth;
    canvas.height = frame.offsetHeight;
    SIMS[simMode].init(canvas.width, canvas.height);
}
 
window.addEventListener('resize', () => {
    if (document.getElementById('personal').classList.contains('active')) {
        resizeCanvas();
    }
});
 
let simTime = 0;
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    simTime += 1 / 60;
    SIMS[simMode].step(canvas.width, canvas.height, accentRGB(), simTime);
    requestAnimationFrame(animate);
}
 
/* ----------------------------- BOOT ------------------------------- */
/* script is loaded with `defer`, so the DOM is already parsed here   */
 
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggleBtn.textContent = '☀️';
}
 
const initialTab = HASH_TO_TAB[location.hash.replace('#', '')];
if (initialTab) openTab(initialTab, false);
 
resizeCanvas();
setSimMode(simMode); // sets active button + (re)inits particles
animate();