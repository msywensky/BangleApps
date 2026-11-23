(function (back) {
  var FILE = "wxclock.settings.json";
  var s = require("Storage").readJSON(FILE, 1) || {};
  function save() { require("Storage").writeJSON(FILE, s); }
  E.showMenu({
    "": { title: "Weather Clock" },
    "< Back": back,
    /*LANG*/"Time": {
      value: s.hour24 ? 1 : 0, min: 0, max: 1, wrap: true,
      format: v => v ? "24 hr" : "12 hr",
      onchange: v => { s.hour24 = !!v; save(); }
    },
    /*LANG*/"Temp": {
      value: s.unitC ? 1 : 0, min: 0, max: 1, wrap: true,
      format: v => v ? "\xB0C" : "\xB0F",
      onchange: v => { s.unitC = !!v; save(); }
    },
    /*LANG*/"Update (min)": {
      value: s.interval || 5, min: 1, max: 60, step: 1,
      onchange: v => { s.interval = v; save(); }
    },
    /*LANG*/"Demo Weather": {
      value: !!s.demo,
      onchange: v => { s.demo = v; save(); }
    }
  });
})
