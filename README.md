# Kiljumestari

Kiljuaiheinen selainpeli, jota pelataan puhelimella tai tietokoneella. Tavoitteena on valmistaa
25 litran ämpärissä mahdollisimman **vahvaa** ja **herkullista** kiljua **mahdollisimman halvalla**.

## Pelaaminen

Avaa `index.html` selaimessa. Peli on pelkkää HTML:ää, CSS:ää ja JavaScriptiä, joten mitään
asennusta tai käännöstä ei tarvita. Puhelimella pelaamista varten sivun voi julkaista esim.
GitHub Pagesissa (Settings → Pages → Deploy from branch).

1. **Resepti**: valitse hedelmät, makuaineet, sokerin määrä, hiivalaji ja -määrä, hiivaravinne,
   veden alkulämpö, huoneen lämpö, puhtaus ja ilmalukko.
2. **Käyminen**: seuraa päivä päivältä alkoholia, sokeria ja lämpöä. Voit säätää huoneen lämpöä,
   sekoittaa ja lisätä sokeria kesken käymisen.
3. **Pullotus**: päätä milloin pullotat. Tuomaristo arvioi vahvuuden, maun, kirkkauden ja hinta-laadun
   (mitä litra puhdasta alkoholia maksoi). Pisteet: vahvuus 40, maku 40, hinta-laatu 20.
4. **Tilitys**: päätä paljonko myyt ja paljonko juot itse. Myynnistä tulee rahaa seuraavaan erään,
   itse juominen antaa kokemusta ja taitopisteitä taitopuuhun. Alkubudjetti on 15 €, ja jos rahat
   eivät riitä enää halvimpaankaan erään, tulee konkurssi.

Raaka-aineilla, hiivalla, puhdistusaineilla ja ilmalukolla (kertaosto) on hinta. Huoneen lämmittäminen
tai viilentäminen 18 °C:sta maksaa sähköä päivittäin.

## Rakenne

- `js/sim.js` – käymisen simulaatio ja arviointi (ei riippuvuutta DOMiin)
- `js/economy.js` – hinnat, myynti, kokemus ja taitopuu
- `js/game.js` – käyttöliittymä
- `test/economy.js` – talouden tasapaino ja taitopuun säännöt: `node test/economy.js`
- `test/balance.js` – ajaa joukon reseptejä simulaation läpi tasapainotusta varten: `node test/balance.js`
