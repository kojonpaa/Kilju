# Kiljumestari

Kiljuaiheinen selainpeli, jota pelataan puhelimella tai tietokoneella. Tavoitteena on valmistaa
25 litran ämpärissä mahdollisimman **vahvaa** ja **herkullista** kiljua.

## Pelaaminen

Avaa `index.html` selaimessa. Peli on pelkkää HTML:ää, CSS:ää ja JavaScriptiä, joten mitään
asennusta tai käännöstä ei tarvita. Puhelimella pelaamista varten sivun voi julkaista esim.
GitHub Pagesissa (Settings → Pages → Deploy from branch).

1. **Resepti**: valitse hedelmät, makuaineet, sokerin määrä, hiivalaji ja -määrä, hiivaravinne,
   veden alkulämpö, huoneen lämpö, puhtaus ja ilmalukko.
2. **Käyminen**: seuraa päivä päivältä alkoholia, sokeria ja lämpöä. Voit säätää huoneen lämpöä,
   sekoittaa ja lisätä sokeria kesken käymisen.
3. **Pullotus**: päätä milloin pullotat. Tuomaristo arvioi vahvuuden, maun ja kirkkauden.

## Rakenne

- `js/sim.js` – käymisen simulaatio ja arviointi (ei riippuvuutta DOMiin)
- `js/game.js` – käyttöliittymä
- `test/balance.js` – ajaa joukon reseptejä simulaation läpi tasapainotusta varten: `node test/balance.js`
