# CaseStudio Open

<img src="assets/logo.svg" width="72" alt="CaseStudio Open (logo provvisorio)"> &nbsp; <img src="assets/everythink.png" width="72" alt="EveryThink">

Generatore parametrico di cover per telefono, stampabili in 3D su **Bambu Lab A1 mini senza AMS**.
Gira interamente nel browser (nessun server): apri `index.html` da un server statico o da GitHub Pages.

## Lingue

Interfaccia in inglese (predefinito), italiano, tedesco, francese e spagnolo, con il selettore in alto a sinistra.
Le traduzioni stanno in `js/i18n.js` (chiave = testo italiano). Anche i nomi dei file esportati e i messaggi delle
pause nel 3MF seguono la lingua scelta.

## Come funziona la cover

| Pezzo | Materiale | Note |
|---|---|---|
| Bordo (bumper) | TPU 95A | Fronte sul piano, nessun supporto. Include fori, linguette per i tasti e scanalatura per la piastra. |
| Piastra posteriore | PLA | Si incastra nel bordo da dietro. Porta il motivo, il taglio fotocamera e i magneti. |

Cambiare stile = stampare un'altra piastra (circa 20-40 minuti), il bordo resta lo stesso.

- **Stili e motivi:** 59 motivi in 4 famiglie (geometrici, linee e tessuti, natura, organici a reazione-diffusione) con miniatura dal vivo, piu' immagine tua (PNG/JPG/SVG, anche trascinata o incollata) e testo.
- **Editor fotocamere e tasti:** disegno del retro del telefono dove trascini ogni lente e ogni tasto; puoi sovrapporre una foto per allinearli a occhio.
- **Tattile:** il rilievo arriva a 1,6 mm ed e' protetto dal bordo in TPU.
- **Due colori senza AMS:** il rilievo e' un secondo colore; il 3MF contiene gia' il cambio filamento al layer giusto.
- **MagSafe:** tasca per anello magnetico o dischetti, chiusa dentro la piastra. Il 3MF contiene la pausa per inserire i magneti.
- **Tasti laterali:** pad in rilievo su membrana flessibile di TPU (nessun foro) con perno interno che preme il tasto. Piu' lungo del tasto del telefono, quindi fa da leva e si trova al tatto. Nessuna parte da comprare, spessore invariato.
- **Esportazione:** STL, 3MF per Bambu Studio (A1 mini), ZIP con preset di processo e filamento (TPU e PLA), anello di prova della misura.

## Da dove vengono le misure

Profilo, raggio degli angoli, fotocamere, tasti e fori inferiori di Galaxy S24, S25, S26 e iPhone 15-18 sono stati
**misurati automaticamente** da cover in STL pubblicate su Printables, sezionando le mesh e leggendo cavita', fori e
pareti. I file originali non sono inclusi nel progetto: qui ci sono solo le misure ricavate.

| Serie | Fonte |
|---|---|
| Galaxy S24, S24+, S24 Ultra | Victronix, Printables #1034176 |
| Galaxy S25, S25+, S25 Ultra, S25 Edge (profilo) | Victronix, Printables #1166535 |
| Galaxy S26, S26+, S26 Ultra | Victronix, Printables #1621022 |
| iPhone 16, 16 Plus, 16 Pro, 16 Pro Max | Victronix, Printables #1012139 |
| iPhone 17, Air, 17 Pro, 17 Pro Max | Victronix, Printables #1412457 |
| iPhone 18 Pro, 18 Pro Max | Victronix, Printables #1839716 |
| iPhone 15, 15 Plus | Flipper3DPrints #592404 e TyChi04 #1156348 (Printables) |

Le dimensioni esterne (larghezza, altezza, spessore) vengono dalle schede ufficiali. Pixel 9 e 10 sono ancora stimati.

## Logo

`assets/logo.svg` e' **provvisorio**: e' il concept C ("Percorso") della prima tornata (`brand/concepts/`). La seconda
tornata, sul tema "Incastro" (cornice + piastra), e' in `brand/concepts/round2/`, in attesa della scelta definitiva. Il kit completo (colori, lockup, favicon, guida d'uso) si prepara dopo la scelta.

## Da verificare prima del primo uso

- Le misure ricavate dalle cover hanno l'incertezza della cover di partenza (circa 0,2 mm). **Stampa l'anello di prova** prima della cover intera, e correggi con l'editor se serve.
- Il 3MF e i preset sono scritti seguendo il formato di Bambu Studio ma non sono stati aperti in Bambu Studio durante lo sviluppo. Se le impostazioni non si applicano, importa i preset JSON; se mancano le pause, aggiungile a mano ai layer indicati nella scheda Stampa.
- Le linguette dei tasti e le fessure vanno provate: spessore parete e fessura dipendono dal TPU.

## Sviluppo

```
node serve.mjs        # http://localhost:5173
```

- `js/geometry.js` costruisce i solidi con [Manifold](https://github.com/elalish/manifold) (WASM, in `vendor/`).
- `js/patterns.js` genera le mappe di altezza dei motivi.
- `js/worker.js` esegue il calcolo fuori dal thread della UI.
- `js/export.js` scrive STL, 3MF e preset.
- Viewer: three.js. Icone: Lucide (ISC). Tutto e' vendorizzato, nessuna CDN tranne i font.

Loghi: `assets/logo.svg` e' il logo del progetto; `assets/everythink.png` e' il logo EveryThink.

Licenza: MIT per il codice. Le librerie in `vendor/` mantengono le proprie licenze (MIT/Apache-2.0).
