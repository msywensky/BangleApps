/* Weather Clock - Bangle.js 2
   Layout: time, date, a sunrise / moon phase / sunset strip, then weather icon + temperature.
   Settings (wxclock.settings.json): hour24 (false), unitC (false), interval minutes (5), demo (false),
   sun (true: show the sunrise / moon / sunset strip; false: original larger-time layout) */
(function () {
  var SETTINGS_FILE = "wxclock.settings.json";
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var S = {};
  function loadSettings() {
    var s = require("Storage").readJSON(SETTINGS_FILE, 1) || {};
    S = {
      hour24: !!s.hour24,                       // default 12-hour
      unitC: !!s.unitC,                         // default Fahrenheit
      interval: Math.max(1, s.interval || 5),   // minutes between weather refreshes
      demo: !!s.demo,                           // cycle fake weather (for emulator testing)
      sun: s.sun !== false                      // sunrise / moon phase / sunset strip, default on
    };
  }

  // ---------- sun and moon ----------
  // Worked out once per calendar day from the date and the location saved by the My Location app.
  // The suncalc module is loaded only for that calculation and dropped again to free RAM.
  var sunCache = null, sunKey = "";
  function pad2(n) { return ("0" + n).slice(-2); }
  function clockText(t) {
    if (!t || isNaN(t.getTime())) return "--"; // no sunrise/sunset (polar day/night)
    var h = t.getHours(), m = pad2(t.getMinutes());
    if (S.hour24) return pad2(h) + ":" + m;
    return (h % 12 || 12) + ":" + m + (h >= 12 ? "p" : "a");
  }
  function sunMoon(d) {
    var key = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
    if (sunCache && sunKey === key) return sunCache;
    var res = { rise: "--", set: "--", illum: 0, litRight: true };
    try {
      var loc = require("Storage").readJSON("mylocation.json", 1) || {};
      if (S.demo && typeof loc.lat !== "number") loc = { lat: 40.7, lon: -74 }; // so the emulator shows something
      var SunCalc = require("suncalc");
      var mi = SunCalc.getMoonIllumination(d), north = !(loc.lat < 0);
      res.illum = mi.fraction;
      // phase < 0.5 is waxing. Waxing shows the lit side on the right in the northern hemisphere, left in the south.
      res.litRight = (mi.phase < 0.5) === north;
      if (typeof loc.lat === "number" && typeof loc.lon === "number") {
        var t = SunCalc.getTimes(d, loc.lat, loc.lon);
        res.rise = clockText(t.sunrise);
        res.set = clockText(t.sunset);
      }
    } catch (e) { /* leave the "--" placeholders */ }
    try { Modules.removeCached("suncalc"); } catch (e) { /* not cached, or not supported */ }
    sunKey = key;
    sunCache = res;
    return res;
  }

  // ---------- weather ----------
  var DEMO = [
    { temp: 295.37, code: 800, txt: "Clear" },
    { temp: 288.15, code: 803, txt: "Clouds" },
    { temp: 283.15, code: 501, txt: "Rain" },
    { temp: 277.15, code: 771, txt: "Squalls" },
    { temp: 270.15, code: 601, txt: "Snow" },
    { temp: 290.15, code: 211, txt: "Thunderstorm" }
  ];
  var demoIdx = 0;
  var cached = null, lastRead = 0;

  function readWeather() {
    if (S.demo) return DEMO[demoIdx++ % DEMO.length];
    try { return require("weather").get() || null; } catch (e) { return null; }
  }
  function weather() {
    if (!lastRead || Date.now() - lastRead >= S.interval * 60000) {
      cached = readWeather();
      lastRead = Date.now();
    }
    return cached;
  }

  // map an OpenWeatherMap code (or text, if the code isn't numeric) to an icon name
  function category(w) {
    var c = +w.code, t = (w.txt || "").toLowerCase();
    if (c === c) { // numeric
      if (c >= 200 && c < 300) return "storm";
      if (c >= 300 && c < 600) return "rain";
      if (c >= 600 && c < 700) return "snow";
      if (c === 771 || c === 781) return "wind";
      if (c === 800) return "sun";
      if (c > 800 && c < 900) return "cloud";
      if (c >= 700 && c < 800) return "cloud"; // mist, fog, haze
    }
    if (/thunder|storm/.test(t)) return "storm";
    if (/rain|drizzle|shower/.test(t)) return "rain";
    if (/snow|sleet|ice/.test(t)) return "snow";
    if (/wind|squall|breez|gust/.test(t)) return "wind";
    if (/clear|sun/.test(t)) return "sun";
    return "cloud";
  }

  function tempText(w) {
    if (!w || typeof w.temp !== "number") return "--";
    var c = w.temp - 273.15;
    return "" + Math.round(S.unitC ? c : c * 9 / 5 + 32);
  }

  // ---------- drawing ----------
  // Colours follow the watch theme. fg/bg come from g.theme; accents are chosen so they
  // stay readable on the background (cyan on dark themes, blue on light ones).
  var YELLOW = "#ff0";
  var T = { fg: "#fff", bg: "#000", dark: true, accent: "#0ff", sun: YELLOW, moonLit: "#fff", moonDark: "#333" };
  function loadTheme() {
    var th = g.theme || {};
    var dark = th.dark !== undefined ? !!th.dark : true;
    T = {
      fg: th.fg !== undefined ? th.fg : (dark ? "#fff" : "#000"),
      bg: th.bg !== undefined ? th.bg : (dark ? "#000" : "#fff"),
      dark: dark,
      accent: dark ? "#0ff" : "#00f",
      sun: dark ? YELLOW : "#f80",             // amber: yellow vanishes on white
      moonLit: dark ? "#fff" : "#f80",
      moonDark: dark ? "#333" : "#ccc"
    };
  }

  // small filled triangle: up = sunrise, down = sunset
  function tri(x, y, up) {
    g.setColor(T.sun).fillPoly(up
      ? [x, y - 4, x - 4, y + 3, x + 4, y + 3]
      : [x, y + 4, x - 4, y - 3, x + 4, y - 3]);
  }
  // moon disc, f = fraction lit (0..1). Drawn row by row: the lit part runs from the terminator to the limb.
  function moon(x, y, r, f, litRight) {
    g.setColor(T.moonDark).fillCircle(x, y, r);
    g.setColor(T.moonLit);
    for (var dy = -r; dy <= r; dy++) {
      var w = Math.sqrt(r * r - dy * dy), xt = (1 - 2 * f) * w;
      var x1 = Math.round(litRight ? xt : -w), x2 = Math.round(litRight ? w : -xt);
      if (x2 > x1) g.fillRect(x + x1, y + dy, x + x2, y + dy);
    }
    g.setColor(T.fg).drawCircle(x, y, r);
  }
  var SUN_Y = 109;
  function drawSun(d, cx) {
    var m = sunMoon(d), size = 14;
    for (; size > 11; size--) { // shrink so "10:52a" and the moon do not collide
      g.setFont("Vector", size);
      if (Math.max(g.stringWidth(m.rise), g.stringWidth(m.set)) <= 38) break;
    }
    g.setFont("Vector", size).setColor(T.fg);
    g.setFontAlign(-1, 0).drawString(m.rise, 36, SUN_Y);
    g.setFontAlign(1, 0).drawString(m.set, 140, SUN_Y);
    tri(30, SUN_Y, true);
    tri(146, SUN_Y, false);
    moon(cx, SUN_Y, 9, m.illum, m.litRight);
  }

  function cloud(ox, oy, s, dy) {
    g.setColor(T.fg);
    g.fillCircle(ox + 15 * s, oy + (29 + dy) * s, 7 * s);
    g.fillCircle(ox + 26 * s, oy + (22 + dy) * s, 10 * s);
    g.fillCircle(ox + 36 * s, oy + (29 + dy) * s, 7 * s);
    g.fillRect(ox + 15 * s, oy + (22 + dy) * s, ox + 36 * s, oy + (36 + dy) * s);
  }
  function icon(type, ox, oy, size) {
    var s = size / 48, i;
    if (type === "sun") {
      g.setColor(YELLOW).fillCircle(ox + 24 * s, oy + 24 * s, 9 * s);
      // yellow alone vanishes on a white background, so outline it and use fg rays on light themes
      g.setColor(T.fg).drawCircle(ox + 24 * s, oy + 24 * s, 9 * s);
      g.setColor(T.dark ? YELLOW : T.fg);
      for (i = 0; i < 8; i++) {
        var a = i * Math.PI / 4, c = Math.cos(a), n = Math.sin(a);
        g.drawLine(ox + (24 + 14 * c) * s, oy + (24 + 14 * n) * s, ox + (24 + 20 * c) * s, oy + (24 + 20 * n) * s);
      }
    } else if (type === "cloud") {
      cloud(ox, oy, s, 4);
    } else if (type === "rain") {
      cloud(ox, oy, s, -4);
      g.setColor(T.accent);
      [16, 25, 34].forEach(function (x) { g.drawLine(ox + x * s, oy + 34 * s, ox + (x - 3) * s, oy + 43 * s); });
    } else if (type === "snow") {
      cloud(ox, oy, s, -6);
      g.setColor(T.accent);
      [[16, 33], [25, 38], [34, 33], [20, 43], [30, 44]].forEach(function (p) {
        g.fillCircle(ox + p[0] * s, oy + p[1] * s, Math.max(1, 2.5 * s));
      });
    } else if (type === "storm") {
      cloud(ox, oy, s, -4);
      var bolt = [
        ox + 26 * s, oy + 28 * s, ox + 18 * s, oy + 38 * s, ox + 24 * s, oy + 38 * s,
        ox + 21 * s, oy + 46 * s, ox + 31 * s, oy + 34 * s, ox + 25 * s, oy + 34 * s];
      g.setColor(YELLOW).fillPoly(bolt);
      if (!T.dark) g.setColor(T.fg).drawPoly(bolt, true); // outline so yellow shows on white
    } else if (type === "wind") {
      g.setColor(T.accent);
      [[16, 6, 30], [25, 6, 38], [34, 6, 24]].forEach(function (l) {
        g.fillRect(ox + l[1] * s, oy + (l[0] - 1) * s, ox + l[2] * s, oy + (l[0] + 1) * s);
        g.fillCircle(ox + l[2] * s, oy + (l[0] - 3) * s, 3 * s);
      });
    }
  }

  function timeParts(d) {
    var h = d.getHours(), m = ("0" + d.getMinutes()).slice(-2), ap = "";
    if (!S.hour24) { ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; }
    return { t: (S.hour24 ? ("0" + h).slice(-2) : "" + h) + ":" + m, ap: ap };
  }
  function dateText(d) { return DAYS[d.getDay()] + " " + MONTHS[d.getMonth()] + " " + d.getDate(); }

  function draw() {
    var R = Bangle.appRect || { x: 0, y: 24, x2: 175, y2: 175 };
    var W = g.getWidth(), cx = W / 2, d = new Date(), tp = timeParts(d), w = weather();

    loadTheme();
    g.reset().clearRect(R.x, R.y, R.x2, R.y2); // reset() = theme fg/bg, so this clears to the theme background

    // with the sun strip the time is smaller and sits higher to make room
    var L = S.sun ? { size: 44, min: 32, ty: 54, dy: 87, wy: 130 } : { size: 56, min: 40, ty: 84, dy: 114, wy: 129 };

    // time (+ AM/PM): shrink the font until the whole group fits
    var size = L.size, tw, aw = 0, gap = 4;
    for (; size >= L.min; size -= 4) {
      g.setFont("Vector", size);
      tw = g.stringWidth(tp.t);
      if (tp.ap) { g.setFont("Vector", 18); aw = g.stringWidth(tp.ap); }
      if (tw + (tp.ap ? gap + aw : 0) <= W - 8) break;
    }
    var x0 = cx - (tw + (tp.ap ? gap + aw : 0)) / 2;
    g.setFontAlign(-1, 0).setColor(T.fg).setFont("Vector", size).drawString(tp.t, x0, L.ty);
    if (tp.ap) g.setColor(T.accent).setFont("Vector", 18).drawString(tp.ap, x0 + tw + gap, L.ty + Math.round(size * 0.18));

    // date
    g.setFontAlign(0, 0).setColor(T.accent).setFont("Vector", 20).drawString(dateText(d), cx, L.dy);

    // sunrise / moon phase / sunset
    if (S.sun) drawSun(d, cx);

    // divider
    g.setColor(T.fg).drawLine(24, 126, W - 24, 126);

    // weather row: icon, temperature, small unit
    var ICON = 40, numStr = tempText(w), unit = S.unitC ? "C" : "F";
    g.setFont("Vector", 32);
    var nw = g.stringWidth(numStr);
    g.setFont("Vector", 14);
    var uw = g.stringWidth(unit), degW = 8;
    var rowW = ICON + 8 + nw + 2 + degW + uw, rx = cx - rowW / 2;
    if (w) icon(category(w), rx, L.wy, ICON);
    var nx = rx + ICON + 8;
    g.setFontAlign(-1, 0).setColor(T.fg).setFont("Vector", 32).drawString(numStr, nx, L.wy + 21);
    g.drawCircle(nx + nw + 5, L.wy + 12, 2); // degree sign
    g.setFont("Vector", 14).drawString(unit, nx + nw + 2 + degW, L.wy + 14);

    queueDraw();
  }

  // ---------- scheduling ----------
  var drawTimeout;
  function queueDraw() {
    if (drawTimeout) clearTimeout(drawTimeout);
    drawTimeout = undefined;
    if (!Bangle.isLCDOn()) return;
    drawTimeout = setTimeout(function () { drawTimeout = undefined; draw(); }, 60000 - (Date.now() % 60000));
  }

  loadSettings();
  g.reset().clear(); // theme background
  Bangle.setUI("clock");
  Bangle.loadWidgets();
  Bangle.drawWidgets();
  Bangle.on("lcdPower", function (on) {
    if (on) draw();
    else if (drawTimeout) { clearTimeout(drawTimeout); drawTimeout = undefined; }
  });
  draw();
})();
