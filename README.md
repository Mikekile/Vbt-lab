# vbt lab

vbt lab reads a Tendo MyUnit `.tpaf` export in the browser and draws the concentric velocity, power, and displacement for each rep. Tendo's app keeps that curve. The file already has it, in `<i_data>`.

Sessions stay in IndexedDB on the device. The site does not upload them.

## Import a session

1. Open the site in Safari.
2. Tap Import.
3. Choose the `.tpaf` file in the Files app.

The picker does not filter by extension. iPadOS turns that filter into system file types, and `.tpaf` has none, so the file was disabled. A file that is not a Tendo export is rejected after you choose it.

The session list is the home screen. Tap a rep for the curves. The line on each curve is the time to peak velocity.

To remove a session, open it and tap Delete session.

## Publish on GitHub Pages

The workflow `.github/workflows/pages.yml` deploys the site on every push to `main`. GitHub does not run it until Pages is set to GitHub Actions.

1. Open the repository on GitHub.
2. Go to Settings, then Pages.
3. Under Build and deployment, set Source to GitHub Actions.

After the first green run, the site is at `https://<owner>.github.io/<repo>/`.

The repository has to be public for free GitHub Pages.

## Check an export locally

The export used to check the model is not in this repository.

```
node --test
node scripts/verify.mjs /path/to/session.tpaf
```

`node --test` uses a synthetic file. `verify.mjs` prints computed values against Tendo's for mean velocity, peak velocity, peak power, and peak force.

## The impulse model

Tendo's FAQ says sampling is variable and speed dependent. At 2 m/s the rate is 200 Hz. The same answer says the device times small impulses of a known distance and does not need calibration.

https://www.tendosport.com/support/faq/

2 m/s divided by 200 Hz is 0.01 m. Each `<i_data>` count is the time to travel one centimetre.

Mean velocity on a 24-rep export matches Tendo's displayed 0.01 m/s on every rep when that time is `count * 8 µs`. 8 µs is a 125 kHz clock. The only scale factors that still round to those 24 means sit between 1249.1 and 1252.2, and `0.01 / 8e-6` is 1250, in the middle of that band.

```
velocity = 0.01 / (count * 8e-6)
mean velocity = (n * 0.01) / (sum(counts) * 8e-6)
```

A mean that borrows its scale from peak velocity is low by 2 to 3 percent. That scale is about 1218, because Tendo's peak is not the fastest single centimetre. The fastest centimetre is about 2.6 percent faster than the peak Tendo prints. The fastest 9 consecutive centimetres is the only integer width within 0.01 m/s of the printed peak on every rep of that export. Rounded to the hundredth, 13 of the 24 still differ by 0.01 m/s. The manuals do not state 9 cm. Another export could disagree. The curve on screen is still the raw 1 cm series, and the rep view also prints the fastest 1 cm.

`N_FILTER` is the minimum movement threshold in centimetres, not a smoothing window. The FAQ describes it that way. Reps shorter than the threshold are omitted from the file. The number is not used in the curve.

Mass comes from `N_LOAD_REP`, not the set-level `N_LOAD`. Pounds use the international pound, 0.45359237 kg. Gravity is the standard acceleration 9.80665 m/s².

Average power in the MyUnit manual is introduced as `F = m * g` and `P = F * v`, which is `m * g * mean velocity`.

https://www.tendosport.com/wp-content/uploads/2022/04/Tendo-MyUnit-manual-eng-1.2.pdf

Peak power and peak force use the manual's other equation, `P = F * v` where `F = (m * g) + (m * a)`. Acceleration is the change in the 1 cm velocities over the change in their times. The first and last samples reuse the nearest centered acceleration. Peak force is the maximum of that force from the start of the rep out to `N_PARTIAL_AVG_RANGE` percent of the rise. Manual section 4.5 defines that window. The manual's device default is 50 percent. If the export omits the attribute, peak force uses the full rise.

That derivative is noisier than Tendo's peak power and peak force. On the checked export, peak power sits several percent high, and one rep is farther off. The manual gives the equation and does not give the smoothing. This app does not add a smoothing constant to close the gap.

Time to peak velocity is the middle of the fastest 9 cm. Tendo does not export that time.
