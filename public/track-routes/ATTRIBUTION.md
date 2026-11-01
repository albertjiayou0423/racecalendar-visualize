# Track route data

- Source: [Global Motorsport Circuits JSON](https://github.com/GameDev-Toolkit/global-motorsport-circuits-json)
- Pinned revision: `0c941730f3d3279da6a553f79c15e9ed62780b2c`
- License: Apache-2.0; full text is in [LICENSE-APACHE-2.0.txt](./LICENSE-APACHE-2.0.txt).
- Imported files: the source repository's `f1/active` records, resampled to 150 points and rounded to one decimal place. The JSON file is a transformed derivative.
- The upstream project says its geometry has no documented provenance or accuracy guarantee. The animation therefore labels these outlines as visual references, not authoritative event maps.
- Formula E and WRC routes are not included in this F1 dataset. The video renderer uses an explicitly labeled route illustration for events without a matched F1 outline.
