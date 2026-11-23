# Weather Clock

Layout: time, date (`Mon Nov 23`), a sun and moon strip, then a weather icon with the temperature. The °F/°C marker is deliberately small.

## Sun and moon
The strip under the date shows sunrise (up triangle, left), the moon phase (centre) and sunset (down triangle, right). Times follow the 12/24 hr setting (`6:52a` / `06:52`).
- Sunrise and sunset come from your saved location in the **My Location** app. Without one the times show `--`; the moon still shows.
- The moon is drawn lit on the right while waxing and on the left while waning in the northern hemisphere, and mirrored in the southern hemisphere (it follows the latitude of your saved location).
- Calculated once per day with the `suncalc` module, which is unloaded again straight after, so it costs almost no battery or RAM.
- Turn it off with **Sun & Moon** in settings to get the original layout with a larger time.

## Theme
The face follows the watch theme (`g.theme`): text and the background use the theme's colours. Accent colours (date, AM/PM, rain, snow, wind) are cyan on dark themes and blue on light themes. The sun and lightning bolt are yellow, with a dark outline on light themes so they stay visible on white.

## Settings (Settings -> Apps -> Weather Clock)
- **Time**: 12 hr (default) or 24 hr
- **Sun & Moon**: show the sunrise / moon / sunset strip (default on)
- **Temp**: °F (default) or °C
- **Update (min)**: how often the face re-reads the stored weather (default 5)
- **Demo Weather**: cycles fake weather each minute, for the emulator

## Weather data
The face reads weather from the Bangle `weather` module. It does not fetch weather itself: the phone has to push it (iOS Shortcuts via the iOS Integration app, or Gadgetbridge on Android). "Update" controls how often the watch re-reads what is stored, not how often the phone sends new data. With no data the temperature shows `--`.

## Known gaps
- No `app.png` / `app-icon.js` yet (needed for the App Loader, not for running from the IDE).
- "Windy" is shown only when the weather code or text says so (squall codes or the words wind/gust/breeze); wind speed alone is not used.

## Test
`node watch/tests/wxclock.test.js` runs the app against a mocked display.
