# PDFman: PDF Manipulator

A browser-based PDF workspace for merging, splitting, and organizing PDFs. No login, no paywall, no bullshit. Just PDF tools that do what they should. Files are processed locally; originals are never overwritten and every operation creates a separate download.

## Run with XAMPP

1. Copy this whole folder into your XAMPP `htdocs` directory, for example `htdocs/pdfman/`.
2. Start Apache in the XAMPP Control Panel.
3. Open `http://localhost/pdfman/`.

The app uses local copies of PDF.js and pdf-lib in `vendor/`. It does not require Node.js, a PHP backend, a build step, or a CDN at runtime.

## Tools

- **Merge:** combine two or more PDFs in the listed order. Use the up/down controls to change the order.
- **Split:** extract page numbers or ranges such as `1-3, 6`. Quick controls select all, odd, or even pages.
- **Organize:** select a PDF, drag pages to reorder, use arrow controls for precise movement, rotate pages, or remove them. Reset restores that PDF's original page arrangement.

Uploaded PDFs are held in browser memory for the current tab session. There is a 100 MB per-file limit. Exported files are named separately from their inputs. The bundled libraries are PDF.js 3.11.174 and pdf-lib 1.17.1.
