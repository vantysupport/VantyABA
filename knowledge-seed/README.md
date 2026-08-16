# knowledge-seed · Conocimiento del Cerebro IA (por código)

Carpeta para cargar conocimiento al **Cerebro IA de Vanty** de forma 100% confiable,
**sin depender de la extracción de PDF** (que puede fallar con escaneados/símbolos).

## Cómo usar

1. Pon aquí archivos **`.md`** o **`.txt`** con **texto real** (no PDF).
   - Un archivo = un documento en el cerebro.
   - El **nombre del archivo** se usa como título (ej: `guia-manejo-conductas.md` → "Guia manejo conductas").
2. Haz commit y despliega.
3. En la app: **Cerebro IA → Biblioteca → "Cargar conocimiento del código"**.
   - Indexa todos los archivos (chunks + embeddings) y quedan conectados al chat ARIA
     y al análisis predictivo, igual que cualquier documento subido.
   - Si un archivo ya estaba cargado, lo **reemplaza** (re-indexa la versión nueva).

## De PDF a texto (para PDFs digitales)

Si tienes un PDF **digital** (con texto seleccionable) y quieres su contenido aquí,
conviértelo a `.txt` una vez y pégalo en esta carpeta. Cualquier conversor de
"PDF a texto" sirve. Los PDF **escaneados** (solo imágenes) necesitan OCR primero.

## Recomendaciones

- Texto limpio y en español rinde mejor en la búsqueda semántica.
- Divide libros muy largos en varios archivos por tema (ej: `abllsr-lenguaje.md`,
  `abllsr-motricidad.md`) para que la IA recupere fragmentos más precisos.
- Los protocolos muy estructurados (como ABLLS-R) pueden ir como datos en
  `app/api/knowledge/data/` si quieres la máxima calidad de recuperación.
