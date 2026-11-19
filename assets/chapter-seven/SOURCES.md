# Chapter 7 · Live House assets and references

Downloaded / verified: 2026-11-14. The runtime has no external asset requests.

## Runtime music props — CC0

| Asset | Creator / collection | Source | Local file | Processing |
| --- | --- | --- | --- | --- |
| Speaker (64×64) | PhoxSillanpaa | https://opengameart.org/content/speaker | `source/speaker.png` | Used in speaker cabinets and battle background; scaled, without changing source pixels |
| Drums, electric guitar | AntumDeluge, **CC0 Music Icons**, OpenClipart collection | https://opengameart.org/content/cc0-music-icons | `source/music-icons/32x32/drums.png`, `guitar_electric.png` | Scaled into stage props and battle background |

Both OpenGameArt pages identify these assets as **CC0**: https://creativecommons.org/publicdomain/zero/1.0/ . Source pages are retained under `docs/research/chapter-seven/`.

The icon pack's own source list is retained as `source/music-icons/music-OCAL.txt`. It identifies the drum illustration as https://openclipart.org/detail/274 and the electric guitar as https://openclipart.org/detail/4444 . Original downloaded archive: `source/music-icons.zip` (music-ocal_20201227.zip). Other downloaded instrument archives are research material and are not loaded by the game.

Brick walls, floor, curtain folds, STARRY lettering, truss, lights, microphones, monitors, bar, mixing console, columns, cases, posters, cables and exit signage are newly drawn in `src/livehouse-art.js`. The same scene palette is used in map and battle views. No official anime frame, fan illustration, paid background or venue photograph is embedded as game scenery.

## Visual references

- 《孤独摇滚》STARRY: basement Live House setting and stage identity, as requested by the user. The Fandom page at https://bocchi-the-rock.fandom.com/wiki/STARRY returned HTTP 403 during research; its contents were not used as evidence.
- SHELTER official venue introduction: https://www.loft-prj.co.jp/schedule/shelter/about/ . Used as context for a live venue with performance / audience / drink-counter functions. The older `/SHELTER/` pages redirect to the current site. Saved reference HTML: `docs/research/chapter-seven/shelter-current-about.html`.

The tactical layout is original and adapted to readable square tiles; it does not claim an exact reconstruction of the anime floor plan.

## User-provided Nijika artwork

Five supplied JPG originals are preserved in `assets/characters/nijika-source/`: portrait, idle directions, walking directions, actions, and hurt / down. They are user-provided materials; the CC0 labels above apply to the downloaded music props, not to the supplied character art.

`tools/prepare-nijika-assets.py` removes the green backdrop, keeps a consistent foot anchor, extracts 47 action frames, builds four-direction map sheets, and removes exterior white from the portrait. Output details: `assets/characters/actions/nijika-actions.json`. No original user file is modified.

Existing party and enemy sprites retain their previous sources and attribution. No new enemy artwork pack is introduced by this chapter.

## Band camp

- The camp uses the same locally bundled CC0 drum, electric guitar and speaker artwork listed above. The instrument archive and speaker download were rechecked against the OpenGameArt originals on 2026-11-19. Both versions of the game load those props from local files or their embedded equivalents.
- The camp layout takes inspiration from the walkable facilities in Fire Emblem Fates’ My Castle. The three connected terraces, landscape, architecture and stage lighting are drawn for this project. [Nintendo’s overview](https://www.nintendo.com/en-gb/Games/Nintendo-3DS-games/Fire-Emblem-Fates-Birthright-1026071.html) · [Serenes Forest facility overview](https://serenesforest.net/fire-emblem-fates/my-castle/)
- The band areas use MyGO!!!!!’s live performance setup as a reference for the stage and rehearsal props. [BanG Dream! official artist page](https://bang-dream.com/mygo)
