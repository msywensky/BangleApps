(function(back) {
  var FILE = "iosfilter.settings.json";
  var settings = require("Storage").readJSON(FILE,1)||{};
  function updateSettings() {
    require("Storage").writeJSON(FILE, settings);
  }
  var modes = ["off","block","allow"];
  var modeLabels = ["Off","Block list","Allow list"];

  // minutes since midnight -> "10:30 PM"
  function fmtTime(mins) {
    var h = Math.floor(mins/60), m = mins%60;
    return ((h%12)||12) + ":" + (m<10?"0":"") + m + (h<12?" AM":" PM");
  }

  // short readable name from a bundle ID: com.apple.MobileSMS -> MobileSMS
  function shortName(id) {
    var l = id.split(".");
    return l[l.length-1];
  }

  function showAppsMenu() {
    var seen = require("Storage").readJSON("iosfilter.seen.json",1)||[];
    var list = settings.apps||[];
    // include listed apps that haven't been seen since a reset
    list.forEach(id => { if (seen.indexOf(id)<0) seen.push(id); });
    var m = {
      "" : { "title" : settings.filterMode=="allow" ? "Allowed apps" : "Blocked apps" },
      "< Back" : () => E.showMenu(mainmenu)
    };
    if (!seen.length) m[/*LANG*/"(none seen yet)"] = ()=>{};
    seen.forEach(id => {
      m[shortName(id)] = {
        value : (settings.apps||[]).indexOf(id)>=0,
        onchange : v => {
          var a = settings.apps||[];
          var i = a.indexOf(id);
          if (v && i<0) a.push(id);
          if (!v && i>=0) a.splice(i,1);
          settings.apps = a;
          updateSettings();
        }
      };
    });
    E.showMenu(m);
  }

  var mainmenu = {
    "" : { "title" : "iOS" },
    "< Back" : back,
    /*LANG*/"Filter" : {
      value : Math.max(0, modes.indexOf(settings.filterMode||"off")),
      min : 0, max : 2, wrap : true,
      format : v => modeLabels[v],
      onchange : v => {
        settings.filterMode = modes[v];
        updateSettings();
      }
    },
    /*LANG*/"Choose Apps" : showAppsMenu,
    /*LANG*/"Quiet Hours" : {
      value : !!settings.quiet,
      onchange : v => { settings.quiet = v; updateSettings(); }
    },
    /*LANG*/"Quiet Start" : {
      value : (settings.quietStart!==undefined ? settings.quietStart : 1320)/30,
      min : 0, max : 47, wrap : true,
      format : v => fmtTime(v*30),
      onchange : v => { settings.quietStart = v*30; updateSettings(); }
    },
    /*LANG*/"Quiet End" : {
      value : (settings.quietEnd!==undefined ? settings.quietEnd : 420)/30,
      min : 0, max : 47, wrap : true,
      format : v => fmtTime(v*30),
      onchange : v => { settings.quietEnd = v*30; updateSettings(); }
    },
    /*LANG*/"Quiet: Calls OK" : {
      value : settings.quietCalls!==false,
      onchange : v => { settings.quietCalls = v; updateSettings(); }
    },
    /*LANG*/"Forget Seen Apps" : () => {
      require("Storage").erase("iosfilter.seen.json");
      E.showAlert(/*LANG*/"Cleared").then(() => E.showMenu(mainmenu));
    },
    /*LANG*/"Time Sync" : {
      value : !!settings.timeSync,
      onchange: v => {
        settings.timeSync = v;
        updateSettings();
      }
    },
    /*LANG*/"Disable UTF8" : {
      value : !!settings.no_utf8,
      onchange: v => {
        settings.no_utf8 = v;
        updateSettings();
      }
    },
    /*LANG*/"Auto-Detect App Names" : {
      value : !settings.dontDetectNames,
      onchange: v => {
        settings.dontDetectNames = !v;
        updateSettings();
      }
    }
  };
  E.showMenu(mainmenu);
})
