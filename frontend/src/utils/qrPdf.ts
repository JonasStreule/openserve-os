import QRCode from 'qrcode';

export async function generateQrPdf(
  tables: Array<{ table_number: string; qr_token: string }>,
  baseUrl?: string
): Promise<void> {
  const origin = baseUrl || window.location.origin;

  const qrDataUrls = await Promise.all(
    tables.map((t) =>
      QRCode.toDataURL(`${origin}/guest?token=${t.qr_token}`, {
        width: 200,
        margin: 1,
      })
    )
  );

  const cards = tables
    .map(
      (t, i) => `
      <div class="card">
        <p class="restaurant">OpenServe OS</p>
        <img src="${qrDataUrls[i]}" width="200" height="200" />
        <p class="table-num">Tisch ${t.table_number}</p>
        <p class="scan-hint">Scannen zum Bestellen</p>
      </div>`
    )
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<title>QR-Codes - OpenServe OS</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .grid { display: flex; flex-wrap: wrap; }
  .card {
    width: 50%;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    border: 1px dashed #ccc;
    box-sizing: border-box;
  }
  .restaurant { font-size: 12px; color: #888; margin-bottom: 8px; }
  .table-num { font-size: 28px; font-weight: 700; margin-top: 10px; }
  .scan-hint { font-size: 11px; color: #999; margin-top: 4px; }
  @media print {
    body { margin: 0; }
    .card { border: 1px dashed #ccc; }
    .card:nth-child(6n+1) { page-break-before: always; }
  }
</style>
</head>
<body>
<div class="grid">
${cards}
</div>
<script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
