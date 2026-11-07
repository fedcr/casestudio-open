# CaseStudio Open

Generatore parametrico di cover per telefono, stampabili in 3D su **Bambu Lab A1 mini senza AMS**.
Gira interamente nel browser (nessun server): apri `index.html` da un server statico o da GitHub Pages.

## Come funziona la cover

| Pezzo | Materiale | Note |
|---|---|---|
| Bordo (bumper) | TPU 95A | Fronte sul piano, nessun supporto. Include fori, linguette per i tasti e scanalatura per la piastra. |
| Piastra posteriore | PLA | Si incastra nel bordo da dietro. Porta il motivo, il taglio fotocamera e i magneti. |

Cambiare stile = stampare un'altra piastra (circa 20-40 minuti), il bordo resta lo stesso.

- **Stili e motivi:** labirinto (reazione-diffusione), onde, esagoni, zigrinatura, punti, nervature, curve di livello, Voronoi, immagine tua, testo.
- **Tattile:** il rilievo arriva a 1,6 mm ed e' protetto dal bordo in TPU.
- **Due colori senza AMS:** il rilievo e' un secondo colore; il 3MF contiene gia' il cambio filamento al layer giusto.
- **MagSafe:** tasca per anello magnetico o dischetti, chiusa dentro la piastra. Il 3MF contiene la pausa per inserire i magneti.
- **Tasti laterali:** linguetta flessibile in TPU con perno interno e pad esterno piu' grande (cupola, piatto, zigrinato). Nessuna parte da comprare, spessore invariato. E' l'equivalente "stampato" dei tasti aggiuntivi: una leva piu' lunga del tasto del telefono.
- **Esportazione:** STL, 3MF per Bambu Studio (A1 mini), ZIP con preset di processo e filamento (TPU e PLA), anello di prova della misura.

## Da verificare prima del primo uso

- Le misure dei telefoni sono da schede tecniche, arrotondate; i modelli marcati *(stima)* sono provvisori. Posizione di fotocamera e tasti e' approssimata: correggila nei campi e **stampa l'anello di prova**.
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

Licenza: MIT per il codice. Le librerie in `vendor/` mantengono le proprie licenze (MIT/Apache-2.0).
