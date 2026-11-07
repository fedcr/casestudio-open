# CaseStudio Open: guida d'uso del logo

## 1. Il logo
- **Idea:** l'angolo della cover ingrandito. Un bordo spesso (il bumper in TPU), una gola, la piastra (il retro in PLA).
- **Costruzione:** archi concentrici con un solo centro (136, 136) su un quadrato di 256, griglia da 4, 18 punti in tutto.
  Bordo spesso 52, gola 16, raggio esterno 120, angoli del quadrato r48.
- **Versioni:** orizzontale (principale), verticale, solo simbolo.

| File | Uso |
|---|---|
| `kit/casestudio-horizontal-color.svg` | Principale: siti, README, documenti |
| `kit/casestudio-stacked-color.svg` | Spazi stretti e quadrati |
| `kit/casestudio-symbol-color.svg` | Simbolo da 32 px in su |
| `kit/casestudio-symbol-small.svg` | Simbolo sotto i 32 px: gola larga 28, resta aperta a 16 px |
| `kit/*-white.svg` | Su fondi scuri: gola allargata a 18 per compensare l'effetto di irradiazione |
| `kit/*-black.svg`, `kit/*-mono-1c2328.svg` | A un colore: incisioni, timbri, stampa 3D in rilievo |
| `kit/web/` | favicon, icone app, `site.webmanifest` |

## 2. Spazio libero
Attorno al logo lascia sempre almeno **lo spessore del bordo del simbolo** (52/256 dell'altezza del simbolo, circa un
quinto). Lo spazio scala con il logo.

## 3. Dimensioni minime
| Versione | Schermo | Stampa |
|---|---|---|
| Orizzontale | 120 px di larghezza | 30 mm |
| Simbolo | 16 px, con il file `small` sotto i 32 px | 6 mm |

## 4. Colori
| Nome | HEX | RGB | CMYK (indicativo) | Contrasto su bianco |
|---|---|---|---|---|
| Blu TPU (bordo) | `#2F6BD8` | 47, 107, 216 | 78, 50, 0, 15 | 4,98:1 |
| Inchiostro (piastra, testo) | `#1C2328` | 28, 35, 40 | 30, 13, 0, 84 | 15,9:1 |

I due colori raccontano i due materiali. Il CMYK e' una conversione diretta: per la stampa professionale fai una prova
colore. Il Pantone non e' stato scelto.

**Abbinamenti approvati:** a colori su bianco o carta chiara; bianco su Blu TPU; bianco su Inchiostro; nero su bianco.
Su foto usa la versione bianca o nera su una zona calma.

## 5. Caratteri
- Wordmark: **Barlow Semi Condensed SemiBold**, gia' convertito in tracciati (non serve il font per usare il logo).
- Interfaccia: Barlow e Barlow Semi Condensed. Licenza SIL Open Font License 1.1, utilizzabile anche nei loghi.

## 6. Da evitare
Non deformarlo, non ruotarlo, non cambiarne i colori fuori dalla palette, non aggiungere ombre, contorni o sfumature.
Non separare o ridimensionare le parti di un lockup e non riscrivere il nome a mano con un altro font.
Sotto i 32 px non usare il simbolo normale: la gola si chiude.

## 7. Note
- Il nome "CaseStudio" coincide con quello di un progetto su MakerWorld: prima di registrare un marchio conviene una
  ricerca di anteriorita' e, se serve, un nome proprio. Il simbolo funziona anche da solo.
- Master e presentazione: `brand/kit/` e `brand/kit/presentation.html`.
