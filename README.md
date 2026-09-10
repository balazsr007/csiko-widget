# Csikó Widget – telefonos app (PWA)

Ez a mappa egy telepíthető webapp (Progressive Web App): ugyanaz a
logika és kinézet, mint a Windows-os widgetnek, de telefonra (Android
és iOS) optimalizálva. Nincs szükség app store-ra vagy fejlesztői
fiókra.

## Fájlok

- `index.html` – az app fő oldala
- `styles.css` – sötét téma, mobilra optimalizálva
- `app.js` – a teljes logika (kanca-kezelés, kör, checklist, push-váz)
- `manifest.json` – ettől lesz "telepíthető" ikonként a kezdőképernyőn
- `sw.js` – service worker: offline működés + push-értesítések fogadása
- `icons/` – app-ikonok

## Fontos: HTTPS kell hozzá

A telepíthetőség és a push-értesítések **csak titkosított (HTTPS)
kapcsolaton, vagy `localhost`-on működnek** – ez böngésző-szabvány,
nem tudjuk megkerülni. Egyszerű megoldások:

1. **GitHub Pages** (ingyenes, a legegyszerűbb): tölsd fel ezt a
   mappát egy GitHub repóba, kapcsold be a Pages funkciót – kapsz egy
   `https://<felhasznalonev>.github.io/<repo>/` linket, amit a
   telefonon megnyitva már működik a telepítés és a push is.
2. **Saját Raspberry Pi** (mivel úgyis lesz egy a projekthez): egy
   egyszerű webszerver (pl. `nginx` vagy akár Python
   `http.server` egy Cloudflare Tunnel mögött) szintén megfelel, ha
   van rajta érvényes HTTPS-tanúsítvány (pl. Cloudflare Tunnel vagy
   Let's Encrypt ezt ingyen megoldja).
3. Bármilyen más ingyenes statikus tárhely (Netlify, Vercel stb.)
   ugyanígy megfelel.

## Telepítés a telefonon (miután van HTTPS-linked)

- **Android (Chrome)**: nyisd meg a linket, jobb felül a ⋮ menüben
  "Telepítés" vagy "Hozzáadás a kezdőképernyőhöz".
- **iPhone (Safari)**: nyisd meg a linket, kattints a "Megosztás"
  ikonra, majd "Kezdőképernyőhöz adás". **Fontos**: push-értesítés
  iOS-en csak 16.4-es verziótól, és csak akkor működik, ha az appot
  így, ikonként adtad hozzá (nem elég csak Safariban nyitva tartani).

## A push-értesítés jelenlegi állapota

Az app és a service worker **készen áll a push fogadására** – a
"Teszt-értesítés" gombbal ki is próbálható, szerver nélkül, helyben.

A **tényleges** riasztáshoz (amit majd a Raspberry Pi indít el) még
kell egy kis háttérszerver, ami:
1. eltárolja, mely telefonok kérnek értesítést (push-feliratkozás),
2. és amikor a Pi jelez, továbbküldi nekik az értesítést.

Ezt a következő lépésben építjük meg. Amikor kész, csak be kell
másolni két értéket az `app.js` tetején található két üres
konstansba:

```js
const VAPID_PUBLIC_KEY = ""; // <-- ide kerul majd a szerver VAPID kulcsa
const PUSH_SERVER_URL = "";  // <-- ide kerul majd pl. "https://sajat-szerver.hu/subscribe"
```

Utána az "Értesítések engedélyezése" gomb már automatikusan
összeköti a telefont a szerverrel is.

## Kancaregiszter-kereső

Új kanca hozzáadásakor kereshetsz a kisbérifelver.hu hivatalos,
évente frissülő kancaregiszterében (`kancaregiszter.json`, jelenleg
1281 bejegyzés) — gépeld be a nevet, és válassz a találatok közül
(név, születési év, tenyésztő), vagy koppints az "Egyéni név
megadása" gombra, ha a kancád nincs a nyilvántartásban.

Az adatbázis évente frissül a forrásoldalon
(https://kisberifelver.hu/index.php/tenyesztes/kancaregiszter) — ha
új évjáratot szeretnél, töltsd le onnan az új fájlt, töltsd fel a
Claude-beszélgetésbe, és kérd meg, hogy cserélje le a
`kancaregiszter.json`-t, majd töltsd fel újra a mappát GitHubra.

## Lófelügyelő-megjelenítés

**Két helyen is látszik**, ha a kanca a kancaregiszterből lett
kiválasztva:
1. Kereséskor minden találatnál egy kis, alapból összecsukott
   "▸ Lófelügyelő" sáv jelenik meg — koppints/kattints rá, hogy
   kinyíljon és megmutassa, ki az adott megyéhez tartozó lófelügyelő.
2. **A fő képernyőn is állandóan látszik** a kiválasztott kancánál, a
   "Trimeszter / nap" mellett — nem kell hozzá semmit kinyitni.

A megye a kancaregiszter-bejegyzés tenyésztő-adatából (megye-kód)
derül ki automatikusan, a fajtaegyesület által megadott lista alapján.
Kézzel megadott (nem a regiszterből választott) kancáknál nincs
lófelügyelő-információ, mert nincs hozzá megye-adat.

## Kanca-fénykép

A ⋮ menüben ("Kanca / beállítások") feltölthetsz egy fényképet az
aktuálisan kiválasztott kancához. A kép automatikusan tömörítve (kb.
20-100 KB méretűre kicsinyítve) mentődik a böngésző helyi
tárolójába, majd áttetsző háttérként jelenik meg az egész
alkalmazás mögött — a kártyák enyhén homályosított ("frosted
glass") üvegként ülnek rajta, hogy minden szöveg jól olvasható
maradjon. Kancánként külön kép tartozik; ha egy kancához nincs kép
feltöltve, a háttér egyszerűen sötét marad. A menüben "Fénykép
cserélése" / "Fénykép törlése" opciókkal bármikor módosíthatod.

## Adattárolás

A kanca-adatok (nevek, fedeztetési dátumok, kipipált teendők) a
telefon böngészőjének helyi tárolójában (`localStorage`) vannak, nem
kerülnek fel semmilyen szerverre. Ha törlöd a böngésző adatait, vagy
másik telefonon nyitod meg, nem lesznek ott – ez egy későbbi lépésben
(a háttérszerverrel együtt) bővíthető úgy, hogy több eszköz közt is
szinkronizáljon.
