window.DEMOS["crop"] = {
  try: "turn the dial to 7°, flick it back to zero, then drag a corner in and let go",
  mount(root, { reduced }) {
    const css = `
.d-crop{position:relative;height:420px;display:flex;flex-direction:column;user-select:none;-webkit-user-select:none;font-family:var(--font)}
.d-crop .bar{height:52px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 12px;gap:8px}
.d-crop .stage{position:relative;flex:1;overflow:hidden;touch-action:pan-y}
.d-crop .img{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}
.d-crop .img svg{display:block;width:100%;height:100%}
.d-crop .hatch{position:absolute;left:0;top:0;background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--warn) 42%,transparent) 0 2px,transparent 2px 7px),color-mix(in srgb,var(--warn) 10%,var(--raise))}
.d-crop .frame{position:absolute;left:0;top:0;box-shadow:0 0 0 1px rgba(255,255,255,.85),0 0 0 999px color-mix(in srgb,var(--raise) 74%,transparent);pointer-events:none}
.d-crop .grid{position:absolute;inset:0;opacity:0;transition:opacity .35s ease .25s}
.d-crop .g3{opacity:1;background:linear-gradient(to right,transparent calc(33.333% - .5px),rgba(255,255,255,.5) calc(33.333% - .5px) calc(33.333% + .5px),transparent calc(33.333% + .5px) calc(66.666% - .5px),rgba(255,255,255,.5) calc(66.666% - .5px) calc(66.666% + .5px),transparent calc(66.666% + .5px)),linear-gradient(to bottom,transparent calc(33.333% - .5px),rgba(255,255,255,.5) calc(33.333% - .5px) calc(33.333% + .5px),transparent calc(33.333% + .5px) calc(66.666% - .5px),rgba(255,255,255,.5) calc(66.666% - .5px) calc(66.666% + .5px),transparent calc(66.666% + .5px))}
.d-crop .g9{background:linear-gradient(to right,rgba(255,255,255,.32) 1px,transparent 1px) 0 0/calc(100% / 9) 100%,linear-gradient(to bottom,rgba(255,255,255,.32) 1px,transparent 1px) 0 0/100% calc(100% / 9)}
.d-crop.fine .g9{opacity:1;transition-delay:0s;transition-duration:.15s}
.d-crop.fine .g3{opacity:0;transition-delay:0s;transition-duration:.15s}
.d-crop .c{position:absolute;width:44px;height:44px;pointer-events:auto;touch-action:none;cursor:nwse-resize}
.d-crop .c[data-c="1"],.d-crop .c[data-c="2"]{cursor:nesw-resize}
.d-crop .c::before{content:"";position:absolute;width:18px;height:18px;border:0 solid #fff;filter:drop-shadow(0 0 1px rgba(0,0,0,.35))}
.d-crop .c[data-c="0"]{left:-22px;top:-22px}.d-crop .c[data-c="0"]::before{left:19px;top:19px;border-left-width:3px;border-top-width:3px}
.d-crop .c[data-c="1"]{right:-22px;top:-22px}.d-crop .c[data-c="1"]::before{right:19px;top:19px;border-right-width:3px;border-top-width:3px}
.d-crop .c[data-c="2"]{left:-22px;bottom:-22px}.d-crop .c[data-c="2"]::before{left:19px;bottom:19px;border-left-width:3px;border-bottom-width:3px}
.d-crop .c[data-c="3"]{right:-22px;bottom:-22px}.d-crop .c[data-c="3"]::before{right:19px;bottom:19px;border-right-width:3px;border-bottom-width:3px}
.d-crop.now .c{display:none}
.d-crop .low{height:84px;flex:none;position:relative}
.d-crop .dial{position:absolute;left:50%;top:6px;transform:translateX(-50%);height:70px;touch-action:pan-y;cursor:ew-resize;outline:none;border-radius:10px}
.d-crop .dial:focus-visible{box-shadow:0 0 0 2px var(--accent)}
.d-crop .val{position:absolute;left:0;right:0;top:6px;text-align:center;font:500 12px/16px var(--mono);color:var(--muted);font-variant-numeric:tabular-nums;transition:color .2s}
.d-crop .val.on{color:var(--fg)}
.d-crop .tk{position:absolute;left:0;top:34px;width:1px;height:12px;background:var(--muted);will-change:transform,opacity;border-radius:1px}
.d-crop .tk.m{height:20px;top:30px;background:var(--fg)}
.d-crop .tk.z{height:24px;top:28px;width:2px;margin-left:-.5px}
.d-crop .ptr{position:absolute;left:50%;top:26px;width:2px;height:28px;margin-left:-1px;background:var(--accent);border-radius:1px;transform-origin:50% 100%}
.d-crop .ptr.k{animation:dcr-k .32s cubic-bezier(.2,.8,.2,1)}
@keyframes dcr-k{0%{transform:scaleY(1)}30%{transform:scaleY(1.35)}100%{transform:scaleY(1)}}
.d-crop .dot{position:absolute;left:50%;top:60px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--accent);opacity:0;transition:opacity .2s}
.d-crop .dot.on{opacity:1}
.d-crop .rng{position:absolute;left:16px;right:16px;top:12px;display:none}
.d-crop.now .rng{display:block}.d-crop.now .dial{display:none}
.d-crop .rh{display:flex;justify-content:space-between;font:13px/16px var(--font);color:var(--muted);font-variant-numeric:tabular-nums}
.d-crop .rh b{font-weight:500;color:var(--warn);opacity:0;transition:opacity .2s}
.d-crop .rh b.on{opacity:1}
.d-crop input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:32px;margin:6px 0 0;background:none;touch-action:pan-y}
.d-crop input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:var(--faint)}
.d-crop input[type=range]::-moz-range-track{height:4px;border-radius:2px;background:var(--faint)}
.d-crop input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;margin-top:-7px;border-radius:50%;background:var(--bg);box-shadow:0 0 0 1px var(--faint),0 1px 3px rgba(0,0,0,.18)}
.d-crop input[type=range]::-moz-range-thumb{width:18px;height:18px;border:0;border-radius:50%;background:var(--bg);box-shadow:0 0 0 1px var(--faint),0 1px 3px rgba(0,0,0,.18)}
.d-crop input[type=range]:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
`;
    const photo = `<svg viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true"><defs>
<linearGradient id="dcr-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#93abc6"/><stop offset=".62" stop-color="#d9c9c0"/><stop offset="1" stop-color="#efcfae"/></linearGradient>
<linearGradient id="dcr-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7590a8"/><stop offset=".5" stop-color="#4e6a80"/><stop offset="1" stop-color="#2f4555"/></linearGradient></defs>
<g transform="rotate(-7 150 100)">
<rect x="-160" y="-170" width="620" height="282" fill="url(#dcr-sky)"/>
<circle cx="92" cy="96" r="10" fill="#f8e6c9"/>
<path d="M-160 112L18 112Q46 99 78 106Q104 100 128 108Q150 104 176 112L460 112Z" fill="#8494a6" opacity=".8"/>
<rect x="-160" y="112" width="620" height="260" fill="url(#dcr-sea)"/>
<g fill="#f3dcbd" opacity=".55"><rect x="80" y="115" width="24" height="1.4"/><rect x="84" y="120" width="16" height="1.2"/><rect x="87" y="126" width="10" height="1"/><rect x="89" y="133" width="6" height="1"/></g>
<g fill="#9fb4c6" opacity=".35"><rect x="20" y="140" width="40" height="1"/><rect x="150" y="150" width="56" height="1"/><rect x="40" y="168" width="70" height="1.2"/><rect x="170" y="182" width="90" height="1.2"/></g>
<path d="M196 116Q204 104 216 106L232 105Q244 108 252 117L262 124L190 124Z" fill="#26313a"/>
<rect x="216" y="66" width="10" height="41" fill="#ece5da"/><rect x="216" y="78" width="10" height="5" fill="#b4573f"/><rect x="216" y="92" width="10" height="5" fill="#b4573f"/>
<rect x="214" y="61" width="14" height="5" fill="#2b343c"/><rect x="218" y="55" width="6" height="6" fill="#f6e2b4"/><path d="M217 55L221 50L225 55Z" fill="#2b343c"/>
<path d="M52 131L76 131L72 135L56 135Z" fill="#232c33"/><path d="M63 130L63 112L73 130Z" fill="#efe8dc"/><path d="M62 130L62 116L55 130Z" fill="#e2dacd"/>
</g></svg>`;
    root.innerHTML = `<style>${css}</style><div class="d-crop">
<div class="bar"><div class="dk-seg" role="group" aria-label="mode"><button type="button" data-m="now" aria-pressed="false">as it is</button><button type="button" data-m="dial" aria-pressed="true">with zriz</button></div><button type="button" class="dk-btn rs">replay</button></div>
<div class="stage"><div class="hatch"></div><div class="img">${photo}</div><div class="frame"><div class="grid g3"></div><div class="grid g9"></div><i class="c" data-c="0"></i><i class="c" data-c="1"></i><i class="c" data-c="2"></i><i class="c" data-c="3"></i></div></div>
<div class="low"><div class="dial" tabindex="0" role="slider" aria-label="straighten" aria-valuemin="-45" aria-valuemax="45" aria-valuenow="0" aria-valuetext="0 degrees"><div class="val">0°</div><div class="tks"></div><div class="ptr"></div><div class="dot on"></div></div>
<div class="rng"><div class="rh"><span>rotation <span class="rv">0°</span></span><b>empty corners</b></div><input type="range" min="-45" max="45" step="0.5" value="0" aria-label="rotation"></div></div>
</div>`;
    const el = root.querySelector(".d-crop"),
      stage = el.querySelector(".stage"),
      img = el.querySelector(".img"),
      frame = el.querySelector(".frame"),
      hatch = el.querySelector(".hatch");
    const dial = el.querySelector(".dial"),
      tks = el.querySelector(".tks"),
      val = el.querySelector(".val"),
      ptr = el.querySelector(".ptr"),
      dot = el.querySelector(".dot");
    const rng = el.querySelector("input"),
      rv = el.querySelector(".rv"),
      warn = el.querySelector(".rh b");
    const D = Math.PI / 180,
      M = 1.2;
    const ticks = [];
    for (let d = -45; d <= 45; d++) {
      const t = document.createElement("i");
      t.className = "tk" + (d % 5 === 0 ? " m" : "") + (d === 0 ? " z" : "");
      tks.appendChild(t);
      ticks.push(t);
    }
    let mode = "dial",
      L = {},
      th = 0,
      raw = 0,
      u = { x: 0, y: 0 },
      sBase = 1,
      s = 1,
      F = { x: 0, y: 0, w: 0, h: 0 },
      T = { x: 0, y: 0 };
    let raf = 0,
      dialAnim = null,
      rc = null,
      last = 0;
    const rot = (x, y, a) => {
      const c = Math.cos(a),
        n = Math.sin(a);
      return { x: x * c - y * n, y: x * n + y * c };
    };
    const disp = (r) => (Math.abs(r) < M ? 0 : r - Math.sign(r) * M);
    const undisp = (d) => (d === 0 ? 0 : d + Math.sign(d) * M);
    function layout() {
      const W = stage.clientWidth,
        H = stage.clientHeight;
      const fw = Math.min(W - 48, (H - 34) * 1.5);
      L = {
        W,
        H,
        fw,
        fh: fw / 1.5,
        Iw: fw,
        Ih: fw / 1.5,
        cx: W / 2,
        cy: H / 2,
      };
      img.style.width = L.Iw + "px";
      img.style.height = L.Ih + "px";
      const dw = Math.min(W - 24, 560);
      dial.style.width = dw + "px";
      L.R = dw / 2 - 10;
      L.P = 9;
      L.a = L.P / L.R;
      L.dw = dw;
    }
    function home() {
      th = 0;
      raw = 0;
      u = { x: 0, y: 0 };
      sBase = 1;
      F = { x: L.cx, y: L.cy, w: L.fw, h: L.fh };
      dialAnim = null;
      rc = null;
      rng.value = 0;
    }
    function sMin() {
      let m = 0;
      const hw = L.Iw / 2,
        hh = L.Ih / 2;
      for (const [sx, sy] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const q = rot((sx * F.w) / 2, (sy * F.h) / 2, -th * D);
        m = Math.max(
          m,
          q.x > 0
            ? q.x / Math.max(1e-3, hw - u.x)
            : -q.x / Math.max(1e-3, hw + u.x),
          q.y > 0
            ? q.y / Math.max(1e-3, hh - u.y)
            : -q.y / Math.max(1e-3, hh + u.y)
        );
      }
      return m;
    }
    function solve() {
      s = mode === "dial" ? Math.max(sBase, sMin()) : sBase;
      const p = rot(u.x * s, u.y * s, th * D);
      T = { x: F.x - p.x, y: F.y - p.y };
    }
    function render() {
      img.style.transform = `translate(${T.x}px,${T.y}px) rotate(${th}deg) scale(${s}) translate(${-L.Iw / 2}px,${-L.Ih / 2}px)`;
      const fr = `translate(${F.x - F.w / 2}px,${F.y - F.h / 2}px)`;
      frame.style.transform = fr;
      frame.style.width = F.w + "px";
      frame.style.height = F.h + "px";
      hatch.style.transform = fr;
      hatch.style.width = F.w + "px";
      hatch.style.height = F.h + "px";
      const z = Math.abs(th) < 0.05;
      for (let i = 0; i < ticks.length; i++) {
        const ph = (i - 45 - th) * L.a,
          t = ticks[i];
        if (Math.abs(ph) >= Math.PI / 2 - 0.02) {
          t.style.opacity = 0;
          continue;
        }
        const c = Math.cos(ph);
        t.style.opacity = (Math.pow(c, 1.6) * (i === 45 && z ? 0 : 1)).toFixed(
          3
        );
        t.style.transform = `translateX(${L.dw / 2 + L.R * Math.sin(ph) - 0.5}px) scaleX(${(0.4 + 0.6 * c).toFixed(3)})`;
      }
      const r = Math.round(th),
        txt = (r < 0 ? "−" : "") + Math.abs(r) + "°";
      val.textContent = txt;
      val.classList.toggle("on", !z);
      dot.classList.toggle("on", z);
      dial.setAttribute("aria-valuenow", r);
      dial.setAttribute(
        "aria-valuetext",
        Math.abs(r) + " degrees" + (r < 0 ? " left" : r > 0 ? " right" : "")
      );
      rv.textContent = txt;
      warn.classList.toggle("on", mode === "now" && Math.abs(th) > 0.3);
    }
    const draw = () => {
      solve();
      render();
    };
    const click = () => {
      ptr.classList.remove("k");
      void ptr.offsetWidth;
      ptr.classList.add("k");
    };
    function setTh(n) {
      const was = Math.abs(th) < 0.05;
      th = n;
      if (!was && Math.abs(th) < 0.05) click();
    }
    function loop(t) {
      raf = 0;
      const dt = Math.min(0.032, (t - (last || t)) / 1000 || 0.016);
      last = t;
      if (dialAnim) {
        const a = dialAnim,
          k = 240,
          c = 2 * Math.sqrt(k);
        for (let i = 0; i < 4; i++) {
          const h = dt / 4;
          a.v += (-k * (a.x - a.t) - c * a.v) * h;
          a.x += a.v * h;
        }
        if (Math.abs(a.x - a.t) < 0.005 && Math.abs(a.v) < 0.05) {
          a.x = a.t;
          dialAnim = null;
        }
        setTh(a.x);
        raw = undisp(th);
      }
      if (rc) {
        const k = 190,
          c = 2 * Math.sqrt(k) * 0.86;
        for (let i = 0; i < 4; i++) {
          const h = dt / 4;
          rc.v += (-k * (rc.p - 1) - c * rc.v) * h;
          rc.p += rc.v * h;
        }
        const p = rc.p,
          a = rc.a,
          b = rc.b;
        F = {
          x: a.x + (b.x - a.x) * p,
          y: a.y + (b.y - a.y) * p,
          w: a.w + (b.w - a.w) * p,
          h: a.h + (b.h - a.h) * p,
        };
        sBase = (rc.s0 * F.w) / a.w;
        if (Math.abs(rc.p - 1) < 0.0005 && Math.abs(rc.v) < 0.005) {
          F = { ...b };
          sBase = (rc.s0 * b.w) / a.w;
          rc = null;
        }
      }
      draw();
      if (dialAnim || rc) raf = requestAnimationFrame(loop);
      else last = 0;
    }
    const kick = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(loop);
      }
    };

    let dd = null;
    const dDown = (e) => {
      if (mode !== "dial" || (e.pointerType === "mouse" && e.button !== 0))
        return;
      dialAnim = null;
      raw = undisp(th);
      dd = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        live: e.pointerType === "mouse",
        hist: [{ t: e.timeStamp, v: th }],
      };
      if (dd.live) start(e);
    };
    function start(e) {
      dd.live = true;
      dial.setPointerCapture(e.pointerId);
      el.classList.add("fine");
    }
    const dMove = (e) => {
      if (!dd || e.pointerId !== dd.id) return;
      if (!dd.live) {
        if (
          Math.abs(e.clientX - dd.x) > 6 &&
          Math.abs(e.clientX - dd.x) > Math.abs(e.clientY - dd.y)
        )
          start(e);
        else return;
      }
      raw = Math.max(-45 - M, Math.min(45 + M, raw - (e.clientX - dd.x) / L.P));
      dd.x = e.clientX;
      setTh(disp(raw));
      dd.hist.push({ t: e.timeStamp, v: th });
      while (dd.hist.length > 2 && e.timeStamp - dd.hist[0].t > 90)
        dd.hist.shift();
      draw();
    };
    const dUp = (e) => {
      if (!dd || e.pointerId !== dd.id) return;
      const h = dd.hist,
        live = dd.live;
      dd = null;
      el.classList.remove("fine");
      if (!live) return;
      const f = h[0],
        l = h[h.length - 1],
        dt = (l.t - f.t) / 1000;
      const v = dt > 0.008 && e.timeStamp - l.t < 70 ? (l.v - f.v) / dt : 0;
      let tgt = Math.max(-45, Math.min(45, th + v * 0.16));
      if (Math.abs(tgt) < 2.5 || (Math.sign(tgt) !== Math.sign(th) && th !== 0))
        tgt = 0;
      if (reduced) {
        setTh(tgt);
        raw = undisp(th);
        draw();
        return;
      }
      if (Math.abs(tgt - th) < 0.01) return;
      dialAnim = { x: th, v: Math.max(-200, Math.min(200, v)), t: tgt };
      kick();
    };
    dial.addEventListener("pointerdown", dDown);
    dial.addEventListener("pointermove", dMove);
    dial.addEventListener("pointerup", dUp);
    dial.addEventListener("pointercancel", dUp);
    dial.addEventListener("keydown", (e) => {
      const st = e.shiftKey ? 5 : 1;
      let n = null;
      if (e.key === "ArrowRight" || e.key === "ArrowUp")
        n = Math.round(th) + st;
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown")
        n = Math.round(th) - st;
      else if (e.key === "Home") n = -45;
      else if (e.key === "End") n = 45;
      else if (e.key === "0") n = 0;
      if (n === null) return;
      e.preventDefault();
      dialAnim = null;
      n = Math.max(-45, Math.min(45, n));
      if (reduced) {
        setTh(n);
        raw = undisp(th);
        draw();
      } else {
        dialAnim = { x: th, v: 0, t: n };
        kick();
      }
    });

    let cd = null;
    const rub = (d, c) => c * (1 - 1 / ((d * 0.55) / c + 1));
    const cDown = (e) => {
      if (mode !== "dial" || (e.pointerType === "mouse" && e.button !== 0))
        return;
      e.preventDefault();
      e.stopPropagation();
      if (rc) {
        sBase = (rc.s0 * F.w) / rc.a.w;
        rc = null;
      }
      solve();
      sBase = s;
      const c = +e.currentTarget.dataset.c,
        sx = c % 2 ? 1 : -1,
        sy = c > 1 ? 1 : -1;
      const r0 = {
        l: F.x - F.w / 2,
        t: F.y - F.h / 2,
        r: F.x + F.w / 2,
        b: F.y + F.h / 2,
      };
      const b = stage.getBoundingClientRect();
      cd = {
        id: e.pointerId,
        sx,
        sy,
        r0,
        b,
        ox: (sx > 0 ? r0.r : r0.l) - (e.clientX - b.left),
        oy: (sy > 0 ? r0.b : r0.t) - (e.clientY - b.top),
        T0: { ...T },
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    };
    const cMove = (e) => {
      if (!cd || e.pointerId !== cd.id) return;
      const { sx, sy, r0, b } = cd,
        mw = L.fw * 0.3,
        mh = L.fh * 0.3;
      let x = e.clientX - b.left + cd.ox,
        y = e.clientY - b.top + cd.oy;
      let l = r0.l,
        r = r0.r,
        t = r0.t,
        bt = r0.b;
      if (sx > 0) r = x > r0.r ? r0.r + rub(x - r0.r, 28) : Math.max(x, l + mw);
      else l = x < r0.l ? r0.l - rub(r0.l - x, 28) : Math.min(x, r - mw);
      if (sy > 0)
        bt = y > r0.b ? r0.b + rub(y - r0.b, 28) : Math.max(y, t + mh);
      else t = y < r0.t ? r0.t - rub(r0.t - y, 28) : Math.min(y, bt - mh);
      F = { x: (l + r) / 2, y: (t + bt) / 2, w: r - l, h: bt - t };
      const q = rot(F.x - cd.T0.x, F.y - cd.T0.y, -th * D);
      u = { x: q.x / sBase, y: q.y / sBase };
      draw();
    };
    const cUp = (e) => {
      if (!cd || e.pointerId !== cd.id) return;
      cd = null;
      solve();
      sBase = s;
      const a = { ...F },
        asp = a.w / a.h,
        bw = Math.min(L.W - 48, (L.H - 34) * asp),
        b = { x: L.cx, y: L.cy, w: bw, h: bw / asp };
      if (reduced) {
        F = b;
        sBase = (s * b.w) / a.w;
        draw();
        return;
      }
      rc = { p: 0, v: 0, a, b, s0: s };
      kick();
    };
    el.querySelectorAll(".c").forEach((c) => {
      c.addEventListener("pointerdown", cDown);
      c.addEventListener("pointermove", cMove);
      c.addEventListener("pointerup", cUp);
      c.addEventListener("pointercancel", cUp);
    });

    rng.addEventListener("input", () => {
      th = +rng.value;
      draw();
    });
    const segs = el.querySelectorAll(".dk-seg button");
    const setMode = (m) => {
      mode = m;
      segs.forEach((b) => b.setAttribute("aria-pressed", b.dataset.m === m));
      el.classList.toggle("now", m === "now");
      const keep = th;
      home();
      th = keep;
      raw = undisp(Math.abs(th) < 0.05 ? 0 : th);
      rng.value = th;
      draw();
    };
    segs.forEach((b) =>
      b.addEventListener("click", () => setMode(b.dataset.m))
    );
    el.querySelector(".rs").addEventListener("click", () => {
      home();
      draw();
    });

    layout();
    home();
    draw();
    const ro = new ResizeObserver(() => {
      const w = stage.clientWidth;
      if (w && w !== L.W) {
        cancelAnimationFrame(raf);
        raf = 0;
        const k = th;
        layout();
        home();
        th = k;
        raw = undisp(th);
        draw();
      }
    });
    ro.observe(stage);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      root.innerHTML = "";
    };
  },
};
