# FlowCast — esittelysivu (introduction)

Portfolio- ja esittelysivu GitHub Pagesiin: selainpelit, hyötyohjelmat ja
testausautomaation PoC:t.

- **Live:** https://teppoaland.github.io/introduction/ *(aktivoi Pages, kun sisältö on valmis)*
- **Tekniikka:** yksi `index.html` — HTML5 + CSS (Grid/Flex, custom properties) + vanilla JS. Ei frameworkkeja, ei build-vaihetta, ei ulkoisia fontteja, ei analytiikkaa.
- **Teema:** CRT/arcade-retro (musta + neon, scanlinet, boot-intro).

## Tiedostot

```
index.html    Koko sivusto: rakenne, tyylit ja skriptit samassa tiedostossa
assets/       Kuvakaappaukset (kategoria/peli tai työkalu)
.nojekyll     Estää Jekyllin käsittelyn GitHub Pagesissa
LICENSE       All rights reserved
README.md     Tämä ohje
```

### Kuvakaappaukset

```
assets/games/game-hub/          menu.jpg · blue-max-menu.jpg · blue-max-game.jpg
assets/games/ai-chaos-street/   menu.jpg · street-night.jpg · closeup.jpg
                                laser-shooting.jpg · morning-after.jpg
assets/games/pimea-katu/        jukebox.jpg
assets/tools/ai-tabtool/        pc-view.jpg · remote-play.jpg · remote-library.jpg
```

Kuvat on skaalattu niin, että pisin sivu on ≤ 1200 px ja JPEG-laatu 82
(yhteensä ~0,8 MB). Alkuperäiset kuvakaappaukset ovat kansiossa `D:\App_img`
eikä niitä ole repossa.

**Kuvan lisääminen korttiin:**

```html
<div class="shots" role="group" aria-label="Kuvakaappaukset: Projektin nimi">
  <button class="shot tall" type="button" data-cap="Kuvan otsikko">
    <img src="assets/games/peli/kuva.jpg" width="1080" height="1920"
         loading="lazy" decoding="async" alt="Mitä kuvassa näkyy">
    <span class="cap">Lyhyt</span>
  </button>
</div>
```

- `width`/`height` = kuvan todelliset pikselimitat (estää asettelun hyppimisen).
- `class="shot tall"` pystysuuntaisille kuville, `class="shot"` vaaka-kuville.
- Kuvat avautuvat lightboxiin: nuolet / `Esc` / taustan klikkaus.
- Samaan `.shots`-riviin lisätyt kuvat muodostavat oman selattavan sarjan.

## Paikallinen esikatselu

```powershell
cd D:\AI\introduction
python -m http.server 8000
# http://127.0.0.1:8000/
```

`index.html` toimii myös suoraan `file://`-polulta, mutta iframe-demot ja
leikepöytätoiminnot toimivat varmimmin paikallisen palvelimen kautta.

## Sisällön päivittäminen

### 1. Projektikortti

Kortit ovat tavallista HTML:ää osioissa `#pelit`, `#tyokalut` ja `#qa`:

```html
<article class="card reveal" id="oma-projekti">
  <div class="meta"><span class="tag live">LIVE</span><span>v1.0</span><span>2026</span></div>
  <h3>Projektin nimi</h3>
  <p class="desc">Yhden lauseen arvo lukijalle.</p>
  <ul class="shows">
    <li>Mitä tämä osoittaa osaamisesta.</li>
  </ul>
  <ul class="chips"><li>Python</li><li>vanilla JS</li></ul>
  <div class="actions">
    <button class="btn small primary" type="button" data-demo="oma">▶ Pelaa tässä</button>
    <a class="btn small" href="https://..." target="_blank" rel="noopener">↗ Uusi välilehti</a>
    <a class="btn small ghost" href="https://github.com/teppoaland/..." target="_blank" rel="noopener">Koodi</a>
    <button class="btn small ghost" type="button" data-copy="#oma-projekti" aria-label="Kopioi linkki">⧉</button>
  </div>
</article>
```

- `id` toimii deep linkkinä (`#oma-projekti`) ja kopiointinapin kohteena.
- `data-copy` kopioi sivun URL + ankkurin.
- Uusi kortti kannattaa lisätä myös `buildPalette()`-listaan automaattisesti — se
  lukee kaikki `article.card[id]`-elementit, joten erillistä rekisteröintiä ei tarvita.

### 2. Iframe-demo (pelilava)

Demot rekisteröidään skriptin `DEMOS`-objektiin:

```js
var DEMOS = {
  oma: { name: "OMA PELI", url: "https://teppoaland.github.io/oma-peli/", note: "v1.0" }
};
```

Tämän jälkeen `data-demo="oma"` lataa pelin pelilavaan klikkauksesta. Iframeä ei
ladata sivun avautuessa, joten sivu pysyy nopeana. Suora demo-linkki:
`?demo=oma`.

### 3. Linkit ja versiot

- Hero-osion `ticker` ja korttien `meta`-rivit kannattaa päivittää, kun projektien
  versiot vaihtuvat.
- Yhteystiedot ovat footerissa (`#yhteys`).

## Toiminnot

| Toiminto | Miten |
|---|---|
| Pikahaku | `/` tai `Ctrl`/`Cmd` + `K` |
| Recruiter mode | nappi herosta tai `?mode=cv` |
| Kopioi tiivistelmä | Recruiter moden nappi tai pikahaku |
| Deep link projektiin | `#gamehub`, `#flowcast`, `#sebitti` … |
| Suora demo | `?demo=gamehub`, `?demo=aistreet`, `?demo=pimeakatu`, `?demo=radiator` |
| Kuvakaappaukset | klikkaus → lightbox; `←`/`→` selaa, `Esc` sulkee |
| Ääni päälle/pois | footerin `♪`-nappi (WebAudio, oletuksena pois) |
| Easter egg | Konami-koodi `↑↑↓↓←→←→BA` |

## Saavutettavuus ja suorituskyky

- Semanttiset landmarkit, `skip`-linkki, `:focus-visible`, `aria-live`-alueet.
- `prefers-reduced-motion` kytkee animaatiot pois (myös boot-intron).
- Ei ulkoisia pyyntöjä ennen käyttäjän klikkausta; ei kolmannen osapuolen skriptejä.
- Tulostustyylit: `Ctrl+P` tuottaa siistin paperiversion.

## GitHub Pages

1. Puskaa `main`-haara.
2. Repo → **Settings → Pages**.
3. **Source:** *Deploy from a branch* → Branch: `main` / `/ (root)` → **Save**.
4. Sivu julkaistaan osoitteeseen `https://teppoaland.github.io/introduction/`.

Sivu on alipolussa, joten kaikki polut on pidettävä relatiivisina (`./`).

## Lisenssi

All rights reserved, Copyright 2026 Teppo Ålander. Ks. [LICENSE](LICENSE).
Linkitetyt projektit ovat omia repositorioitaan omilla lisensseillään.
